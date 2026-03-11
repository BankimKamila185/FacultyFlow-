import { Request, Response } from 'express';
import { google } from 'googleapis';
import { getGoogleOAuthClient } from '../integrations/google/oauth';
import { FirestoreService } from '../services/FirestoreService';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string): Promise<string> {
    try {
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 512 }
        };
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json() as any;
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (e) {
        console.error('Gemini API error:', e);
        return '';
    }
}

async function categorizeEmail(subject: string, body: string): Promise<{ category: string; summary: string }> {
    if (!GEMINI_API_KEY) {
        return { category: 'other', summary: subject };
    }

    const prompt = `Categorize this email into EXACTLY ONE: student_query, leave_request, permission, faculty_mail, hod_mail, other.
Also write a single sentence summary (max 15 words).
Subject: ${subject}
Body: ${body.substring(0, 400)}
Respond in JSON: {"category":"<category>","summary":"<summary>"}`;

    const raw = await callGemini(prompt);
    try {
        const parsed = JSON.parse(raw);
        return {
            category: parsed.category || 'other',
            summary: parsed.summary || subject
        };
    } catch {
        return { category: 'other', summary: subject };
    }
}

async function generateEmailDraft(category: string, originalBody: string, originalSubject: string): Promise<string> {
    if (!GEMINI_API_KEY) {
        return 'Thank you for your email. I will get back to you shortly.';
    }

    const prompt = `Write a polite, professional reply. Category: ${category}. Subject: ${originalSubject}. Body: ${originalBody.substring(0, 400)}`;
    return await callGemini(prompt);
}

function decodeBase64(data: string): string {
    try {
        const buff = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
        return buff.toString('utf-8');
    } catch {
        return '';
    }
}

function getEmailBody(payload: any): string {
    if (!payload) return '';
    if (payload.body?.data) return decodeBase64(payload.body.data);
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64(part.body.data);
        }
        for (const part of payload.parts) {
            const body = getEmailBody(part);
            if (body) return body;
        }
    }
    return '';
}

export const syncInbox = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Not authenticated' }); return; }

        const dbUser = await FirestoreService.findFirst('users', 'email', '==', userEmail.toLowerCase());
        if (!dbUser) { res.status(404).json({ success: false, message: 'User not found' }); return; }

        const auth = await getGoogleOAuthClient(userEmail);
        const gmail = google.gmail({ version: 'v1', auth });

        const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 50, q: 'in:inbox' });
        const messages = listRes.data.messages || [];
        let synced = 0;
        let categorized = 0;

        for (const msg of messages) {
            if (!msg.id) continue;

            const existing = await FirestoreService.findFirst('inboxEmails', 'gmailId', '==', msg.id);
            if (existing) continue;

            const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
            const headers = fullMsg.data.payload?.headers || [];
            const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

            const fromHeader = getHeader('From');
            let fromEmail = fromHeader;
            let fromName = fromHeader;

            const nameMatch = fromHeader.match(/^(.*?)\s*<.*?>/);
            const emailMatch = fromHeader.match(/<(.*?)>/);
            if (nameMatch) fromName = nameMatch[1].replace(/"/g, '').trim();
            if (emailMatch) fromEmail = emailMatch[1].trim();

            const subject = getHeader('Subject') || '(No Subject)';
            const dateStr = getHeader('Date');
            const sentAt = dateStr ? new Date(dateStr) : new Date();

            const fullBody = getEmailBody(fullMsg.data.payload);
            const bodySnippet = fullMsg.data.snippet || fullBody.substring(0, 300);

            const { category, summary } = await categorizeEmail(subject, fullBody || bodySnippet);

            await FirestoreService.createDoc('inboxEmails', {
                gmailId: msg.id,
                fromEmail,
                fromName,
                toEmail: getHeader('To'),
                subject,
                bodySnippet,
                fullBody: fullBody.substring(0, 5000),
                category,
                aiSummary: summary,
                sentAt: isNaN(sentAt.getTime()) ? new Date() : sentAt,
                userId: dbUser.id,
                isRead: false
            });

            synced++;
            if (category !== 'other') categorized++;
        }

        res.json({ success: true, message: `Synced ${synced} new emails`, data: { synced, categorized } });
    } catch (error: any) {
        console.error('Inbox sync error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getInbox = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Not authenticated' }); return; }

        const dbUser = await FirestoreService.findFirst('users', 'email', '==', userEmail.toLowerCase());
        if (!dbUser) { res.status(404).json({ success: false, message: 'User not found' }); return; }

        const { category, limit = '50' } = req.query as any;

        const constraints: any[] = [{ field: 'userId', operator: '==', value: dbUser.id }];
        if (category && category !== 'all') {
             // Firestore doesn't support 'in' easily via my simple utility yet, but I'll use equality if single.
             // For multiple, I'll filter in-memory for simplicity.
        }

        let emails = await FirestoreService.query('inboxEmails', constraints);
        if (category && category !== 'all') {
            const categories = category.split(',');
            emails = emails.filter((e: any) => categories.includes(e.category));
        }

        emails = emails.sort((a: any, b: any) => {
            const dateA = a.sentAt?.toDate ? a.sentAt.toDate().getTime() : new Date(a.sentAt).getTime();
            const dateB = b.sentAt?.toDate ? b.sentAt.toDate().getTime() : new Date(b.sentAt).getTime();
            return dateB - dateA;
        }).slice(0, parseInt(limit, 10));

        // Group counts for badges
        const allUserEmails = await FirestoreService.query('inboxEmails', [{ field: 'userId', operator: '==', value: dbUser.id }, { field: 'isRead', operator: '==', value: false }]);
        const categoryCounts: Record<string, number> = {};
        for (const e of allUserEmails) {
            categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
        }

        res.json({ success: true, data: emails, counts: categoryCounts });
    } catch (error: any) {
        console.error('Get inbox error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const generateAutoReply = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const email = await FirestoreService.getDoc<any>('inboxEmails', id);
        if (!email) { res.status(404).json({ success: false, message: 'Email not found' }); return; }

        if (email.aiDraft) { res.json({ success: true, draft: email.aiDraft }); return; }

        const draft = await generateEmailDraft(email.category, email.fullBody || email.bodySnippet, email.subject);
        await FirestoreService.updateDoc('inboxEmails', id, { aiDraft: draft });

        res.json({ success: true, draft });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await FirestoreService.updateDoc('inboxEmails', id, { isRead: true });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendReply = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Not authenticated' }); return; }

        const { id } = req.params;
        const email = await FirestoreService.getDoc<any>('inboxEmails', id);
        if (!email) { res.status(404).json({ success: false, message: 'Email not found' }); return; }
        if (!email.aiDraft) { res.status(400).json({ success: false, message: 'No draft saved.' }); return; }

        const { GmailIntegration } = require('../integrations/gmail');
        await GmailIntegration.sendEmail(userEmail, email.fromEmail, `Re: ${email.subject}`, email.aiDraft);

        res.json({ success: true, message: 'Reply sent successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
