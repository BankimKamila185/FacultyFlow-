import { Request, Response, NextFunction } from 'express';
import { prisma } from '../models/prisma';
import { AnalyticsService } from '../services/AnalyticsService';
import { GmailIntegration } from '../integrations/gmail';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) {
        return '';
    }

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 512 }
    };

    try {
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json() as any;
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (e) {
        console.error('Gemini prompt-email error:', e);
        return '';
    }
}

export class AIController {
    static async suggestAssignments(req: Request, res: Response, next: NextFunction) {
        try {
            // Get all faculty with their current loads
            const facultyStats = await AnalyticsService.getFacultyProductivity();
            
            // Sort by active tasks (ascending) to find the least burdened
            const suggestions = [...facultyStats].sort((a, b) => (a as any).activeTasks - (b as any).activeTasks);
            
            res.status(200).json({ 
                success: true, 
                data: suggestions,
                bestSuggestion: suggestions[0]
            });
        } catch (error) {
            next(error);
        }
    }

    static async getGlobalHealth(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const filter = user?.role === 'FACULTY' ? { userId: user.id, email: user.email } : undefined;
            const metrics = await AnalyticsService.getDashboardMetrics(filter);
            
            // Logic for a "Smart" health summary
            const { tasks } = metrics;
            const total = tasks.pending + tasks.inProgress + (tasks as any).inReview + tasks.completed + tasks.overdue;
            const completionRate = total > 0 ? (tasks.completed / total) * 100 : 0;
            
            let status = 'HEALTHY';
            let summary = `Project is performing well with a ${completionRate.toFixed(1)}% completion rate.`;
            
            if (tasks.overdue > 5) {
                status = 'AT_RISK';
                summary = `Action required: ${tasks.overdue} tasks are overdue. High potential for delay.`;
            } else if (tasks.inProgress > tasks.completed * 2) {
                status = 'CONGESTED';
                summary = 'Observation: High volume of work in progress compared to completions.';
            }

            res.status(200).json({
                success: true,
                data: {
                    status,
                    summary,
                    metrics: {
                        completionRate,
                        overdueCount: tasks.overdue
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/ai/draft-email
     * 
     * Body:
     *  - prompt: string
     *  - audienceRole?: string
     *  - recipients?: string[]
     * 
     * Returns a draft (subject, body, recipients, detected scheduledAt)
     */
    static async draftPromptEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const userEmail = user?.email;

            if (!userEmail) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const { prompt, audienceRole, recipients } = req.body;

            if (!prompt || typeof prompt !== 'string') {
                res.status(400).json({ success: false, message: 'prompt is required' });
                return;
            }

            let targetEmails: string[] = Array.isArray(recipients) ? recipients.filter(Boolean) : [];

            if (targetEmails.length === 0 && audienceRole) {
                const users = await prisma.user.findMany({
                    where: { role: audienceRole.toUpperCase() }
                });
                targetEmails = users
                    .map(u => u.email)
                    .filter(email => email && email !== userEmail);
            }

            const now = new Date().toISOString();
            const aiPrompt = `You are a faculty email assistant. 
Current time: ${now}

Task:
1. Write a professional academic email based on: "${prompt}"
2. Detect if the user specified a time/date to send this email. If so, convert it to an ISO string.

Output ONLY valid JSON with this shape:
{
  "subject": "<short subject>",
  "body": "<email body text>",
  "scheduledAt": "<ISO string or null>"
}

Rules:
- Body polite, under 180 words.
- Output ONLY JSON. No markdown.`;

            const raw = await callGemini(aiPrompt);
            let subject = 'Faculty Announcement';
            let bodyText = prompt;
            let scheduledAt: string | null = null;

            if (raw) {
                try {
                    const cleanJson = raw.replace(/```json|```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    subject = parsed.subject || subject;
                    bodyText = parsed.body || bodyText;
                    scheduledAt = parsed.scheduledAt || null;
                } catch (e) {
                    console.warn('Draft Gemini JSON fail', e);
                }
            }

            res.status(200).json({
                success: true,
                data: {
                    subject,
                    body: bodyText,
                    recipients: targetEmails,
                    scheduledAt
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/ai/confirm-send
     * 
     * Body: { subject, body, recipients, scheduledAt }
     */
    static async confirmSendEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const { subject, body, recipients, scheduledAt } = req.body;

            if (!subject || !body || !recipients || !recipients.length) {
                return res.status(400).json({ success: false, message: 'Missing subject, body, or recipients' });
            }

            if (scheduledAt) {
                await (prisma as any).scheduledEmail.create({
                    data: {
                        userId: user.id,
                        fromEmail: user.email,
                        toEmails: recipients,
                        subject,
                        body,
                        scheduledAt: new Date(scheduledAt)
                    }
                });
                return res.status(200).json({ success: true, message: 'Email scheduled successfully' });
            }

            // Send immediately
            let sentCount = 0;
            for (const to of recipients) {
                try {
                    await GmailIntegration.sendEmail(user.email, to, subject, body);
                    sentCount++;
                } catch (e) {
                    console.error('Send failed for', to, e);
                }
            }

            res.status(200).json({
                success: true,
                message: `Sent to ${sentCount} recipient(s).`
            });
        } catch (error) {
            next(error);
        }
    }

    static async sendPromptEmail(req: Request, res: Response, next: NextFunction) {
        // Keeping for backward compatibility, redirecting to draft logic basically
        return AIController.draftPromptEmail(req, res, next);
    }
}
