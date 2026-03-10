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
     * POST /api/ai/prompt-email
     *
     * Body:
     *  - prompt: string (what kind of email to write)
     *  - audienceRole?: string (e.g. "STUDENT", "HOD", "FACULTY")
     *  - recipients?: string[] (explicit list of email addresses)
     *
     * It uses Gemini to turn the prompt into { subject, body },
     * then sends the email via the logged‑in faculty's Gmail.
     */
    static async sendPromptEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const userEmail = user?.email as string | undefined;

            if (!userEmail) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const { prompt, audienceRole, recipients } = req.body as {
                prompt?: string;
                audienceRole?: string;
                recipients?: string[];
            };

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

            if (targetEmails.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'No recipients found. Provide recipients[] or a valid audienceRole.'
                });
                return;
            }

            // Ask Gemini to create subject + body
            const aiPrompt = `You are a faculty email assistant.

Write a clear, professional academic email based on this instruction:
"${prompt}"

Output ONLY valid JSON with this exact shape (no markdown, no extra text):
{"subject":"<short subject>","body":"<email body text>"}

Rules:
- Body should be polite, under 180 words.
- Do not invent specific dates or marks; speak generally if needed.
- Do not include any JSON code fences.`;

            const raw = await callGemini(aiPrompt);

            let subject = 'Faculty Announcement';
            let bodyText = prompt;

            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.subject && typeof parsed.subject === 'string') {
                        subject = parsed.subject;
                    }
                    if (parsed.body && typeof parsed.body === 'string') {
                        bodyText = parsed.body;
                    }
                } catch (e) {
                    console.warn('Failed to parse Gemini JSON for prompt-email. Using fallback.', e);
                    bodyText = prompt;
                }
            }

            let sentCount = 0;
            for (const to of targetEmails) {
                try {
                    await GmailIntegration.sendEmail(userEmail, to, subject, bodyText);
                    sentCount++;
                } catch (e) {
                    console.error('Error sending prompt-email to', to, e);
                }
            }

            res.status(200).json({
                success: true,
                message: `Email sent to ${sentCount} recipient(s).`,
                data: {
                    subject,
                    body: bodyText,
                    recipients: targetEmails
                }
            });
        } catch (error) {
            next(error);
        }
    }
}
