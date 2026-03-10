import { Request, Response, NextFunction } from 'express';
import { prisma } from '../models/prisma';
import { AnalyticsService } from '../services/AnalyticsService';
import { GmailIntegration } from '../integrations/gmail';
import fetch from 'node-fetch';

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

            const { prompt, audienceRole, recipients: rawRecipients } = req.body;

            if (!prompt || typeof prompt !== 'string') {
                res.status(400).json({ success: false, message: 'prompt is required' });
                return;
            }

            let targetEmails: string[] = Array.isArray(rawRecipients) ? rawRecipients.filter(Boolean) : [];

            if (targetEmails.length === 0 && audienceRole) {
                const users = await prisma.user.findMany({
                    where: { role: audienceRole.toUpperCase() }
                });
                targetEmails = users
                    .map(u => u.email)
                    .filter(email => email && email !== userEmail);
            }

            let recipients = targetEmails;

            // Performance: If prompt is just for lookup, skip Gemini
            if (prompt === 'Lookup only' && audienceRole) {
                const users = await prisma.user.findMany({
                    where: { role: audienceRole.toUpperCase() }
                });
                recipients = users.map(u => u.email).filter(email => email && email !== userEmail);
                return res.status(200).json({
                    success: true,
                    data: { subject: '', body: '', recipients, detectedAudience: audienceRole }
                });
            }

            const now = new Date().toISOString();
            const aiPrompt = `You are an elite faculty email assistant. 

Instruction: "${prompt}"
Current time context: ${now}

Task:
1. Write a professional, concise academic email. DO NOT just repeat the instruction. Use a formal tone.
2. Detect the intended Audience:
   - If the user mentions students/class/learners, output "STUDENT".
   - If heads/HOD/chairs, output "HOD".
   - If faculty/teachers/colleagues, output "FACULTY".
   - Else if unclear, output null.
3. Extract any specific send time/date mentioned. Convert to ISO string.

Output ONLY a JSON object:
{
  "subject": "...",
  "body": "...",
  "audience": "STUDENT | HOD | FACULTY | null",
  "scheduledAt": "ISO String | null"
}

Rules:
- Subject: Compelling and clear.
- Body: Professional, well-formatted, under 150 words. No intro like "Sure, here is your email".
- NO markdown code fences. NO extra text.`;

            const raw = await callGemini(aiPrompt);
            let subject = 'Faculty Announcement';
            let bodyText = '';
            let scheduledAt: string | null = null;
            let detectedAudience: string | null = null;

            if (raw) {
                try {
                    const cleanJson = raw.replace(/```json|```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    subject = parsed.subject || subject;
                    bodyText = parsed.body || bodyText;
                    scheduledAt = parsed.scheduledAt || null;
                    detectedAudience = parsed.audience || null;
                } catch (e) {
                    console.warn('Draft Gemini JSON fail', e);
                }
            }

            // Fallback body if parsing fails or AI is empty
            if (!bodyText) bodyText = `Regarding: ${prompt}`;

            // Smarter recipient lookup
            // 1. If audienceRole was passed (override), use it.
            // 2. Else if AI detected an audience, use it.
            const roleToLookup = audienceRole || detectedAudience;
            if (recipients.length === 0 && roleToLookup) {
                const users = await prisma.user.findMany({
                    where: { role: roleToLookup.toUpperCase() }
                });
                recipients = users
                    .map(u => u.email)
                    .filter(email => email && email !== userEmail);
            }

            res.status(200).json({
                success: true,
                data: {
                    subject,
                    body: bodyText,
                    recipients,
                    scheduledAt,
                    detectedAudience: detectedAudience || audienceRole
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
                await prisma.scheduledEmail.create({
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
