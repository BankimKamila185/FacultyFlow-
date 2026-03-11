import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { GmailIntegration } from '../integrations/gmail';
import { DriveIntegration } from '../integrations/drive';
import { SheetsIntegration } from '../integrations/sheets';
import { FirestoreService } from '../services/FirestoreService';
import fetch from 'node-fetch';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) return '';
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
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
        console.error('Gemini fetch error:', e);
        return '';
    }
}

export class AIController {
    static async suggestAssignments(req: Request, res: Response, next: NextFunction) {
        try {
            const facultyStats = await AnalyticsService.getFacultyProductivity();
            const suggestions = [...facultyStats].sort((a, b) => (a as any).activeTasks - (b as any).activeTasks);
            res.status(200).json({ success: true, data: suggestions, bestSuggestion: suggestions[0] });
        } catch (error) { next(error); }
    }

    static async getGlobalHealth(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const filter = user?.role === 'FACULTY' ? { userId: user.id, email: user.email } : undefined;
            const metrics = await AnalyticsService.getDashboardMetrics(filter);
            const { tasks } = metrics;
            const total = tasks.pending + tasks.inProgress + (tasks as any).inReview + tasks.completed + tasks.overdue;
            const completionRate = total > 0 ? (tasks.completed / total) * 100 : 0;
            
            let status = 'HEALTHY';
            let summary = `Project is performing well with a ${completionRate.toFixed(1)}% completion rate.`;
            
            if (tasks.overdue > 5) {
                status = 'AT_RISK';
                summary = `Action required: ${tasks.overdue} tasks are overdue.`;
            }

            res.status(200).json({ success: true, data: { status, summary, metrics: { completionRate, overdueCount: tasks.overdue } } });
        } catch (error) { next(error); }
    }

    static async draftPromptEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const userToken = (req as any).user;
            const userEmail = userToken?.email;
            const userName = userToken?.name || userEmail?.split('@')[0] || 'Faculty Member';
            if (!userEmail) return res.status(401).json({ success: false, message: 'Not authenticated' });

            const { prompt, audienceRole, recipients: rawRecipients } = req.body;
            let targetEmails: string[] = Array.isArray(rawRecipients) ? rawRecipients.filter(Boolean) : [];

            if (targetEmails.length === 0 && audienceRole) {
                const users = await FirestoreService.query('users', [{ field: 'role', operator: '==', value: audienceRole.toUpperCase() }]);
                targetEmails = users.map(u => u.email).filter(email => email && email !== userEmail);
            }

            let recipients = targetEmails;

            if (!GEMINI_API_KEY) {
                // Simplified offline fallback
                return res.status(200).json({
                    success: true,
                    data: {
                        subject: 'Faculty Announcement',
                        body: `Dear All,\n\n${prompt}\n\nBest regards,\n${userName}`,
                        recipients,
                        scheduledAt: null
                    }
                });
            }

            const aiPrompt = `Draft a professional email for prompt: "${prompt}". Return JSON: {"subject": "...", "body": "...", "audience": "STUDENT|HOD|FACULTY|null", "scheduledAt": "ISO or null"}`;
            const raw = await callGemini(aiPrompt);
            let subject = 'Faculty Announcement', bodyText = '', scheduledAt = null, detectedAudience = null;

            try {
                let jsonStr = raw;
                const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (match) jsonStr = match[1];
                const parsed = JSON.parse(jsonStr.trim());
                subject = parsed.subject || subject;
                bodyText = parsed.body || bodyText;
                scheduledAt = parsed.scheduledAt || null;
                detectedAudience = parsed.audience || null;
            } catch (e) { bodyText = raw; }

            const roleToLookup = audienceRole || detectedAudience;
            if (recipients.length === 0 && roleToLookup) {
                const users = await FirestoreService.query('users', [{ field: 'role', operator: '==', value: roleToLookup.toUpperCase() }]);
                recipients = users.map(u => u.email).filter(email => email && email !== userEmail);
            }

            res.status(200).json({ success: true, data: { subject, body: bodyText, recipients, scheduledAt, detectedAudience } });
        } catch (error) { next(error); }
    }

    static async sendPromptEmail(req: Request, res: Response, next: NextFunction) {
        return AIController.draftPromptEmail(req, res, next);
    }

    static async confirmSendEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const userToken = (req as any).user;
            const { subject, body, recipients, scheduledAt } = req.body;

            if (scheduledAt) {
                await FirestoreService.createDoc('scheduledEmails', {
                    userId: userToken.id,
                    fromEmail: userToken.email,
                    toEmails: recipients,
                    subject,
                    body,
                    scheduledAt: new Date(scheduledAt)
                });
                return res.status(200).json({ success: true, message: 'Email scheduled' });
            }

            for (const to of recipients) {
                await GmailIntegration.sendEmail(userToken.email, to, subject, body);
            }
            res.status(200).json({ success: true, message: `Sent to ${recipients.length} recipient(s).` });
        } catch (error) { next(error); }
    }

    static async universalChat(req: Request, res: Response, next: NextFunction) {
        try {
            const userToken = (req as any).user;
            const userEmail = userToken?.email;
            const userName = userToken?.name || userEmail?.split('@')[0] || 'Faculty Member';
            const { prompt } = req.body;

            const classifyPrompt = `Detect intent for: "${prompt}". Return JSON: {"type": "EMAIL|SHEET|DOC|FORM|SUMMARY|CHAT|TASK", "audience": "...", "title": "...", "scheduledAt": "...", "subject": "...", "body": "...", "response": "..."}`;
            const raw = await callGemini(classifyPrompt);
            let parsed: any = { type: 'CHAT' };
            try {
                let jsonStr = raw;
                const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (match) jsonStr = match[1];
                parsed = JSON.parse(jsonStr.trim());
            } catch (e) {}

            const type = parsed.type || 'CHAT';
            let recipients: string[] = [];
            if (parsed.audience) {
                const users = await FirestoreService.query('users', [{ field: 'role', operator: '==', value: parsed.audience.toUpperCase() }]);
                recipients = users.map(u => u.email).filter(e => e && e !== userEmail);
            }

            if (type === 'CHAT') {
                return res.json({ success: true, data: { type: 'CHAT', response: parsed.response || "How can I help you?" } });
            }

            if (type === 'TASK') {
                const task = await FirestoreService.createDoc('tasks', {
                    title: parsed.title || 'New Task',
                    description: parsed.body || 'AI created',
                    deadline: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
                    status: 'PENDING',
                    assignedToId: userToken.id,
                    createdById: userToken.id
                });
                return res.json({ success: true, data: { type: 'TASK', ...task } });
            }

            if (type === 'EMAIL') {
                return res.json({ success: true, data: { type: 'EMAIL', subject: parsed.subject, body: parsed.body, recipients, scheduledAt: parsed.scheduledAt } });
            }

            if (type === 'SHEET') {
                const sheet = await SheetsIntegration.createSheet(userEmail, parsed.title || 'Untitled Sheet');
                return res.json({ success: true, data: { type: 'SHEET', url: `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`, recipients } });
            }

            // Fallback
            res.json({ success: true, data: { type: 'CHAT', response: "Drafting intended action..." } });
        } catch (error) { next(error); }
    }
}
