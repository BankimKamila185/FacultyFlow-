import { Request, Response, NextFunction } from 'express';
import { prisma } from '../models/prisma';
import { AnalyticsService } from '../services/AnalyticsService';
import { GmailIntegration } from '../integrations/gmail';
import fetch from 'node-fetch';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is missing');
        return '';
    }

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
    };

    try {
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json() as any;
        if (data.error) {
            console.error('Gemini API Error:', JSON.stringify(data.error, null, 2));
            return '';
        }
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (e) {
        console.error('Gemini fetch error:', e);
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
            const userName = user?.name || userEmail?.split('@')[0] || 'Faculty Member';

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

            // Fast offline fallback if Gemini API key is missing.
            // This avoids ugly "Regarding your request..." drafts in local/dev.
            if (!GEMINI_API_KEY) {
                const normalized = String(prompt).trim();
                const lower = normalized.toLowerCase();

                let detectedAudience: string | null = null;
                if (lower.match(/\bstudent|class|exam|lecture|semester\b/)) {
                    detectedAudience = 'STUDENT';
                } else if (lower.match(/\bhod\b|head of department|chair\b/)) {
                    detectedAudience = 'HOD';
                } else if (lower.match(/\bfaculty|colleague|professor|staff\b/)) {
                    detectedAudience = 'FACULTY';
                }

                // Subject: first sentence or a truncated version of the prompt
                const firstSentence = normalized.split(/[.?!]/)[0].trim();
                let subject = firstSentence
                    ? firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1)
                    : 'Faculty Announcement';
                if (subject.length > 90) {
                    subject = subject.slice(0, 87).trimEnd() + '...';
                }

                // Simple polite email body
                let greeting = 'Dear All,';
                if (detectedAudience === 'STUDENT') greeting = 'Dear Students,';
                else if (detectedAudience === 'HOD') greeting = 'Dear Head of Department,';
                else if (detectedAudience === 'FACULTY') greeting = 'Dear Faculty,';

                const bodyText =
`${greeting}

${normalized.charAt(0).toUpperCase() + normalized.slice(1)}

Thank you.

Best regards,
${userName}`;

                const roleToLookup = audienceRole || detectedAudience;
                if (recipients.length === 0 && roleToLookup) {
                    const users = await prisma.user.findMany({
                        where: { role: roleToLookup.toUpperCase() }
                    });
                    recipients = users
                        .map(u => u.email)
                        .filter(email => email && email !== userEmail);
                }

                return res.status(200).json({
                    success: true,
                    data: {
                        subject,
                        body: bodyText,
                        recipients,
                        scheduledAt: null,
                        detectedAudience: detectedAudience || audienceRole
                    }
                });
            }

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
            const aiPrompt = `You are a professional university assistant.

Instruction: "${prompt}"
Current time: ${now}

Task:
1. Write a concise, professional academic email draft.
2. Identify intended Audience EXACTLY as one of: "STUDENT", "HOD", "FACULTY", or null.
   - Mention of students/exams/classes/learners -> "STUDENT"
   - Mention of HOD/Heads/Chairs -> "HOD"
   - Mention of teachers/professors/colleagues -> "FACULTY"
3. Extract specific send time if mentioned (ISO string).

CRITICAL FORMAT RULES:
- Return ONLY a single JSON object.
- Do NOT include Markdown, backticks, or code fences.
- Do NOT include any explanatory text before or after the JSON.

The JSON shape MUST be exactly:
{
  "subject": "string - clear email subject line",
  "body": "string - full email body, with line breaks as needed",
  "audience": "STUDENT" | "HOD" | "FACULTY" | null,
  "scheduledAt": "ISO-8601 datetime string or null"
}`;

            const raw = await callGemini(aiPrompt);
            console.log('Gemini Raw Output:', raw);

            let subject = 'Faculty Announcement';
            let bodyText = '';
            let scheduledAt: string | null = null;
            let detectedAudience: string | null = null;

            if (raw) {
                try {
                    // Robust JSON extraction (handles both plain JSON and fenced JSON)
                    let jsonStr = raw;
                    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
                    if (jsonMatch) {
                        jsonStr = jsonMatch[1];
                    }

                    const parsed = JSON.parse(jsonStr.trim());
                    subject = parsed.subject || subject;
                    bodyText = parsed.body || bodyText;
                    scheduledAt = parsed.scheduledAt || null;
                    detectedAudience = parsed.audience || null;
                } catch (e) {
                    console.error('Draft JSON parse failed:', e, 'Raw was:', raw);

                    // Graceful degradation: if JSON parsing fails but Gemini
                    // still produced a reasonable email-looking text, use it.
                    if (!bodyText && typeof raw === 'string') {
                        // Try to extract a "Subject:" line if present
                        const subjectMatch = raw.match(/^[Ss]ubject\s*:\s*(.+)$/m);
                        if (subjectMatch) {
                            subject = subjectMatch[1].trim() || subject;
                            const withoutSubjectLine = raw.replace(subjectMatch[0], '').trim();
                            bodyText = withoutSubjectLine || bodyText;
                        } else if (raw.trim().length > 40) {
                            // Treat the whole thing as the body if it's long enough
                            bodyText = raw.trim();
                        }
                    }
                }
            }

            // Final ultra-safe fallback if everything else fails
            if (!bodyText) {
                const normalized = String(prompt).trim();
                const lower = normalized.toLowerCase();

                if (!detectedAudience) {
                    if (lower.match(/\bstudent|class|exam|lecture|semester\b/)) {
                        detectedAudience = 'STUDENT';
                    } else if (lower.match(/\bhod\b|head of department|chair\b/)) {
                        detectedAudience = 'HOD';
                    } else if (lower.match(/\bfaculty|colleague|professor|staff\b/)) {
                        detectedAudience = 'FACULTY';
                    }
                }

                const firstSentence = normalized.split(/[.?!]/)[0].trim();
                if (firstSentence) {
                    let safeSubject = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
                    if (safeSubject.length > 90) {
                        safeSubject = safeSubject.slice(0, 87).trimEnd() + '...';
                    }
                    subject = safeSubject;
                }

                let greeting = 'Dear All,';
                if (detectedAudience === 'STUDENT') greeting = 'Dear Students,';
                else if (detectedAudience === 'HOD') greeting = 'Dear Head of Department,';
                else if (detectedAudience === 'FACULTY') greeting = 'Dear Faculty,';

                bodyText =
`${greeting}

${normalized.charAt(0).toUpperCase() + normalized.slice(1)}

Thank you.

Best regards,
${userName}`;
            }

            // Smarter recipient lookup
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
