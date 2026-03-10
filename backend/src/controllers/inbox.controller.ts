import { Request, Response } from 'express';
import { google } from 'googleapis';
import { getGoogleOAuthClient } from '../integrations/google/oauth';
import { prisma } from '../models/prisma';

// --- Gemini AI Categorization ---
// We call Gemini REST API directly to categorize emails
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

    const prompt = `You are an email categorization assistant for a faculty member at a university.

Categorize this email into EXACTLY ONE of these categories:
- student_query (from a student asking academic questions, about grades, assignments etc.)
- leave_request (someone requesting leave / absence / sick day / medical leave)
- permission (requesting permission for an event, activity, or access)
- faculty_mail (from another faculty member about academic/admin work)
- hod_mail (from HOD, BU Head, Director, or senior management)
- other (anything that doesn't fit above)

Also write a single sentence summary (max 15 words) of what this email is about.

Subject: ${subject}
Body (first 400 chars): ${body.substring(0, 400)}

Respond in this exact JSON format only (no markdown, no extra text):
{"category":"<category>","summary":"<summary>"}`;

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

    const prompt = `You are a professional faculty assistant at a university. Write a polite, professional email reply.

Email Category: ${category}
Original Subject: ${originalSubject}
Original Message (first 400 chars): ${originalBody.substring(0, 400)}

Rules:
- Be warm and professional
- Keep it under 120 words
- Don't make up specific dates or facts
- End with a suitable closing

Write ONLY the reply body text, no subject line, no "Reply:" prefix.`;

    return await callGemini(prompt);
}

// --- Decode Gmail message body ---
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
    if (payload.body?.data) {
        return decodeBase64(payload.body.data);
    }
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return decodeBase64(part.body.data);
            }
        }
        for (const part of payload.parts) {
            const body = getEmailBody(part);
            if (body) return body;
        }
    }
    return '';
}

/**
 * POST /api/inbox/sync
 * Syncs up to 50 recent emails from Gmail for the logged-in faculty.
 * Each email is categorized with Gemini AI and stored in InboxEmail table.
 */
export const syncInbox = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        // Get user from DB
        const dbUser = await prisma.user.findUnique({ where: { email: userEmail } });
        if (!dbUser) {
            res.status(404).json({ success: false, message: 'User not found in database' });
            return;
        }

        // Setup Gmail client with the user's OAuth tokens
        const auth = await getGoogleOAuthClient(userEmail);
        const gmail = google.gmail({ version: 'v1', auth });

        // Fetch last 50 messages from inbox
        const listRes = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 50,
            q: 'in:inbox'
        });

        const messages = listRes.data.messages || [];
        let synced = 0;
        let categorized = 0;

        for (const msg of messages) {
            if (!msg.id) continue;

            // Skip if already synced
            const existing = await prisma.inboxEmail.findUnique({ where: { gmailId: msg.id } });
            if (existing) continue;

            // Get full message details
            const fullMsg = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full'
            });

            const headers = fullMsg.data.payload?.headers || [];
            const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

            const fromEmail = getHeader('From');
            const toEmail = getHeader('To');
            const subject = getHeader('Subject') || '(No Subject)';
            const dateStr = getHeader('Date');
            const sentAt = dateStr ? new Date(dateStr) : new Date();

            const fullBody = getEmailBody(fullMsg.data.payload);
            const bodySnippet = fullMsg.data.snippet || fullBody.substring(0, 300);

            // AI Categorization
            const { category, summary } = await categorizeEmail(subject, fullBody || bodySnippet);

            await prisma.inboxEmail.create({
                data: {
                    gmailId: msg.id,
                    fromEmail,
                    toEmail,
                    subject,
                    bodySnippet,
                    fullBody: fullBody.substring(0, 5000), // max 5000 chars
                    category,
                    aiSummary: summary,
                    sentAt: isNaN(sentAt.getTime()) ? new Date() : sentAt,
                    userId: dbUser.id,
                }
            });

            synced++;
            if (category !== 'other') categorized++;
        }

        res.json({
            success: true,
            message: `Synced ${synced} new emails, ${categorized} categorized by AI`,
            data: { synced, categorized }
        });

    } catch (error: any) {
        console.error('Inbox sync error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/inbox
 * Returns categorized emails for the logged-in user.
 * Query params: category (optional), limit (default 50)
 */
export const getInbox = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        const dbUser = await prisma.user.findUnique({ where: { email: userEmail } });
        if (!dbUser) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        const { category, limit = '50' } = req.query as any;

        const where: any = { userId: dbUser.id };
        if (category && category !== 'all') {
            where.category = category;
        }

        const emails = await prisma.inboxEmail.findMany({
            where,
            orderBy: { sentAt: 'desc' },
            take: parseInt(limit, 10),
        });

        // Count by category for badge counts
        const counts = await prisma.inboxEmail.groupBy({
            by: ['category'],
            where: { userId: dbUser.id, isRead: false },
            _count: { category: true }
        });

        const categoryCounts: Record<string, number> = {};
        for (const c of counts) {
            categoryCounts[c.category] = c._count.category;
        }

        res.json({ success: true, data: emails, counts: categoryCounts });
    } catch (error: any) {
        console.error('Get inbox error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/inbox/:id/auto-reply
 * Generate an AI draft reply for a specific email.
 */
export const generateAutoReply = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        const { id } = req.params;

        const email = await prisma.inboxEmail.findUnique({ where: { id } });
        if (!email) {
            res.status(404).json({ success: false, message: 'Email not found' });
            return;
        }

        // Check if we already have a cached draft
        if (email.aiDraft) {
            res.json({ success: true, draft: email.aiDraft });
            return;
        }

        const draft = await generateEmailDraft(email.category, email.fullBody || email.bodySnippet, email.subject);

        // Cache the draft
        await prisma.inboxEmail.update({ where: { id }, data: { aiDraft: draft } });

        res.json({ success: true, draft });
    } catch (error: any) {
        console.error('Auto-reply error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/inbox/:id/read
 * Mark an email as read.
 */
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await prisma.inboxEmail.update({ where: { id }, data: { isRead: true } });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/inbox/:id/send-reply
 * Sends the generated AI draft via Gmail to the original sender
 */
export const sendReply = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Not authenticated' }); return; }

        const { id } = req.params;
        const email = await prisma.inboxEmail.findUnique({ where: { id } });
        
        if (!email) {
            res.status(404).json({ success: false, message: 'Email not found in database' }); return;
        }
        if (!email.aiDraft) {
            res.status(400).json({ success: false, message: 'No draft saved for this email. Generate one first.' }); return;
        }

        const { GmailIntegration } = require('../integrations/gmail');
        
        // Use the original fromEmail as the recipient
        // Sometimes "from" looks like `Name <email@dom.com>`, we can pass it directly to Gmail
        await GmailIntegration.sendEmail(
            userEmail, 
            email.fromEmail, 
            `Re: ${email.subject}`, 
            email.aiDraft
        );

        res.json({ success: true, message: 'Reply sent successfully' });
    } catch (error: any) {
        console.error('Send reply error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
