import { Request, Response, NextFunction } from 'express';
import { prisma } from '../models/prisma';
import { AnalyticsService } from '../services/AnalyticsService';
import { GmailIntegration } from '../integrations/gmail';
import { DriveIntegration } from '../integrations/drive';
import { SheetsIntegration } from '../integrations/sheets';
import fetch from 'node-fetch';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is missing');
        return '';
    }

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
                let subject = 'Faculty Announcement';
                if (lower.indexOf('reminder') !== -1) subject = 'Important Reminder';
                else if (lower.indexOf('lab') !== -1) subject = 'Lab Session Update';
                else if (lower.indexOf('exam') !== -1) subject = 'Exam Notification';
                else if (lower.indexOf('submission') !== -1) subject = 'Deadline Submission';
                else {
                    const firstSentence = normalized.split(/[.?!]/)[0].trim();
                     subject = firstSentence
                        ? firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1)
                        : 'Faculty Announcement';
                }

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
            const aiPrompt = `You are an expert executive assistant at a top-tier university. Your goal is to transform rough, shorthand faculty notes into premium, professional, and warm academic emails.

Instruction from faculty: "${prompt}"
Current time: ${now}

Instructions:
1. REWRITE and EXPAND: Do not simply repeat the raw instruction. Take the core idea and write it as if you were a professional assistant. Fix all grammar and clarity issues.
2. TONE: Warm, professional, supportive, and clear. Avoid sounding robotic.
3. SUBJECT LINE: Create an engaging, high-level subject line that summarizes the action. Do NOT just use the raw prompt. (Max 80 chars).
4. AUDIENCE DETECTION: Detect one of: "STUDENT", "HOD", "FACULTY", or null.
   - Related to classes, exams, homework, grading -> "STUDENT"
   - Related to department, management, reporting -> "HOD"
   - Related to peers, staff meetings, collaboration -> "FACULTY"
5. TIME CONVERSION: If a time like "tomorrow 9am" is given, write it elegantly (e.g., "tomorrow morning at 9:00 AM").
6. SCHEDULE: If they say "send this at 5pm", extract that as "scheduledAt".

Example:
Input: "remind students lab tomorrow 9am"
Output Subject: "Reminder: Scheduled Lab Session for Tomorrow at 9:00 AM"
Output Body: "Dear Students,\n\nI would like to remind everyone about our upcoming lab session scheduled for tomorrow morning at 9:00 AM. Please ensure you have prepared all necessary materials in advance.\n\nThank you.\n\nBest regards,\n[Name]"

JSON format (MANDATORY, NO CODE FENCES):
{
  "subject": "Clear, professional subject",
  "body": "Full, natural email body with greeting and closing",
  "audience": "STUDENT" | "HOD" | "FACULTY" | null,
  "scheduledAt": "ISO-8601 or null"
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

    /**
     * POST /api/ai/chat
     * 
     * Universal AI chat endpoint. Accepts a natural-language prompt,
     * uses Gemini to detect intent, and routes to the right handler.
     * 
     * Body: { prompt: string }
     * Returns: { type: 'EMAIL'|'SHEET'|'DOC'|'FORM'|'SUMMARY', data: {...} }
     */
    static async universalChat(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const userEmail = user?.email;
            const userName = user?.name || userEmail?.split('@')[0] || 'Faculty Member';

            if (!userEmail) {
                res.status(401).json({ success: false, message: 'Not authenticated' });
                return;
            }

            const { prompt } = req.body;
            if (!prompt || typeof prompt !== 'string') {
                res.status(400).json({ success: false, message: 'prompt is required' });
                return;
            }

            const now = new Date().toISOString();

            // ── Step 1: Classify intent with Gemini ────────────────────────────
            const classifyPrompt = `You are an AI assistant for a university faculty management app.
A faculty member typed this instruction: "${prompt}"
Current time: ${now}

Classify their intent as EXACTLY one of these types:
- EMAIL: They want to send, compose, draft, remind, or notify someone via email
- SHEET: They want to create a spreadsheet, Excel, Google Sheet, table, list of data
- DOC: They want to create a document, notice, letter, report, announcement (as a Google Doc)
- FORM: They want to create a form, survey, quiz, feedback form, questionnaire
- SUMMARY: They want to summarize, read, check, list or review their emails/inbox

Also extract:
- audience: "STUDENT" | "HOD" | "FACULTY" | "ALL" | null (who to send/share with)
- title: a short descriptive title for the artifact (sheet name, doc name, etc.)
- scheduledAt: ISO-8601 datetime if a specific send time is mentioned, else null
- subject: (for EMAIL only) the email subject
- body: (for EMAIL only) the full professional email body

Respond ONLY with a single JSON object (no markdown, no backticks):
{
  "type": "EMAIL|SHEET|DOC|FORM|SUMMARY",
  "audience": "STUDENT|HOD|FACULTY|ALL|null",
  "title": "string",
  "scheduledAt": "ISO-8601 or null",
  "subject": "string or null",
  "body": "string or null"
}`;

            let type = 'EMAIL';
            let audience: string | null = null;
            let title = 'Untitled';
            let scheduledAt: string | null = null;
            let subject: string | null = null;
            let body: string | null = null;

            if (GEMINI_API_KEY) {
                const raw = await callGemini(classifyPrompt);
                console.log('[universalChat] Gemini raw:', raw);
                try {
                    let jsonStr = raw;
                    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
                    if (match) jsonStr = match[1];
                    const parsed = JSON.parse(jsonStr.trim());
                    type = parsed.type || 'EMAIL';
                    audience = parsed.audience || null;
                    title = parsed.title || 'Untitled';
                    scheduledAt = parsed.scheduledAt || null;
                    subject = parsed.subject || null;
                    body = parsed.body || null;
                } catch (e) {
                    console.error('[universalChat] JSON parse failed:', e);
                    // Fall back to email
                    type = 'EMAIL';
                }
            } else {
                // Offline fallback: keyword-based classification
                const lower = prompt.toLowerCase();
                if (lower.match(/\bform\b|\bsurvey\b|\bquiz\b|\bfeedback\b|\bquestionnaire\b/)) {
                    type = 'FORM';
                } else if (lower.match(/\bsheet\b|\bexcel\b|\bspreadsheet\b|\btable\b|\battendance\b|\bmarks\b|\bgrade\b/)) {
                    type = 'SHEET';
                } else if (lower.match(/\bdoc\b|\bdocument\b|\bnotice\b|\bletter\b|\breport\b|\bannouncement\b/)) {
                    type = 'DOC';
                } else if (lower.match(/\bsummar\b|\binbox\b|\bread mail\b|\bcheck mail\b/)) {
                    type = 'SUMMARY';
                } else {
                    type = 'EMAIL';
                }

                if (lower.match(/\bstudent\b|\bclass\b|\bexam\b/)) audience = 'STUDENT';
                else if (lower.match(/\bhod\b|\bhead\b/)) audience = 'HOD';
                else if (lower.match(/\bfaculty\b|\bprofessor\b|\bstaff\b/)) audience = 'FACULTY';

                title = prompt.split(/[.?!\n]/)[0].trim().slice(0, 60) || 'Untitled';
            }

            // ── Step 2: Look up recipients ─────────────────────────────────────
            let recipients: string[] = [];
            const roleToLookup = audience && audience !== 'ALL' ? audience : null;
            if (roleToLookup) {
                const users = await prisma.user.findMany({ where: { role: roleToLookup } });
                recipients = users.map(u => u.email).filter(e => e && e !== userEmail);
            } else if (audience === 'ALL') {
                const users = await prisma.user.findMany();
                recipients = users.map(u => u.email).filter(e => e && e !== userEmail);
            }

            // ── Step 3: Handle by type ─────────────────────────────────────────

            // ── EMAIL ──────────────────────────────────────────────────────────
            if (type === 'EMAIL') {
                if (!GEMINI_API_KEY || !subject || !body) {
                    // Offline fallback body
                    const greeting = audience === 'STUDENT' ? 'Dear Students,' : audience === 'HOD' ? 'Dear Head of Department,' : audience === 'FACULTY' ? 'Dear Faculty,' : 'Dear All,';
                    if (!subject) subject = title || 'Faculty Announcement';
                    if (!body) {
                        body = `${greeting}\n\n${prompt.charAt(0).toUpperCase() + prompt.slice(1)}\n\nThank you.\n\nBest regards,\n${userName}`;
                    }
                }

                return res.status(200).json({
                    success: true,
                    data: {
                        type: 'EMAIL',
                        subject,
                        body,
                        recipients,
                        scheduledAt,
                        detectedAudience: audience
                    }
                });
            }

            // ── SHEET ──────────────────────────────────────────────────────────
            if (type === 'SHEET') {
                try {
                    const sheet = await SheetsIntegration.createSheet(userEmail, title);
                    const sheetId = sheet.spreadsheetId;
                    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

                    // Optionally share with students/faculty
                    if (sheetId && recipients.length > 0) {
                        try {
                            await DriveIntegration.shareFile(userEmail, sheetId, recipients, 'reader');
                        } catch (shareErr) {
                            console.warn('[universalChat] Sheet share failed (non-fatal):', shareErr);
                        }
                    }

                    return res.status(200).json({
                        success: true,
                        data: {
                            type: 'SHEET',
                            title,
                            url: sheetUrl,
                            sheetId,
                            recipients,
                            detectedAudience: audience
                        }
                    });
                } catch (e: any) {
                    console.error('[universalChat] Sheet creation failed:', e);
                    return res.status(200).json({
                        success: true,
                        data: {
                            type: 'SHEET',
                            title,
                            url: null,
                            error: 'Could not create sheet — Google Sheets API may not be authorized. Connect your Google account in Settings.',
                            recipients,
                            detectedAudience: audience
                        }
                    });
                }
            }

            // ── DOC ────────────────────────────────────────────────────────────
            if (type === 'DOC') {
                try {
                    const doc = await DriveIntegration.createDoc(userEmail, title);
                    const docId = doc.documentId;
                    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

                    if (docId && recipients.length > 0) {
                        try {
                            await DriveIntegration.shareFile(userEmail, docId, recipients, 'reader');
                        } catch (shareErr) {
                            console.warn('[universalChat] Doc share failed (non-fatal):', shareErr);
                        }
                    }

                    return res.status(200).json({
                        success: true,
                        data: {
                            type: 'DOC',
                            title,
                            url: docUrl,
                            docId,
                            recipients,
                            detectedAudience: audience
                        }
                    });
                } catch (e: any) {
                    console.error('[universalChat] Doc creation failed:', e);
                    return res.status(200).json({
                        success: true,
                        data: {
                            type: 'DOC',
                            title,
                            url: null,
                            error: 'Could not create document — Google Docs API may not be authorized. Connect your Google account in Settings.',
                            recipients,
                            detectedAudience: audience
                        }
                    });
                }
            }

            // ── FORM ────────────────────────────────────────────────────────────
            if (type === 'FORM') {
                try {
                    // Google Forms API via Drive (create a form as a special doc)
                    const auth = await (await import('../integrations/google/oauth')).getGoogleOAuthClient(userEmail);
                    const forms = (await import('googleapis')).google.forms({ version: 'v1', auth });
                    const formRes = await forms.forms.create({
                        requestBody: { info: { title } }
                    });
                    const formId = formRes.data.formId;
                    const responderUri = formRes.data.responderUri || `https://forms.google.com/d/${formId}/viewform`;

                    return res.status(200).json({
                        success: true,
                        data: {
                            type: 'FORM',
                            title,
                            url: responderUri,
                            editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
                            formId,
                            recipients,
                            detectedAudience: audience
                        }
                    });
                } catch (e: any) {
                    console.error('[universalChat] Form creation failed:', e);
                    return res.status(200).json({
                        success: true,
                        data: {
                            type: 'FORM',
                            title,
                            url: null,
                            error: 'Could not create form — Google Forms API may not be authorized. Connect your Google account in Settings.',
                            recipients,
                            detectedAudience: audience
                        }
                    });
                }
            }

            // ── SUMMARY ────────────────────────────────────────────────────────
            if (type === 'SUMMARY') {
                // Get scheduled emails from our DB as a proxy summary (Gmail read requires scopes that may be limited)
                const recentScheduled = await prisma.scheduledEmail.findMany({
                    where: { userId: user.id },
                    orderBy: { scheduledAt: 'desc' },
                    take: 5
                });

                let summaryText = '';
                if (recentScheduled.length === 0) {
                    summaryText = 'You have no recently scheduled or sent emails in FacultyFlow.';
                } else {
                    summaryText = `Here are your ${recentScheduled.length} most recent emails:\n\n` +
                        recentScheduled.map((e, i) =>
                            `${i + 1}. **${e.subject}** → ${e.toEmails.join(', ')}\n   Status: ${e.status} | Scheduled: ${new Date(e.scheduledAt).toLocaleString()}`
                        ).join('\n\n');
                }

                return res.status(200).json({
                    success: true,
                    data: {
                        type: 'SUMMARY',
                        summary: summaryText
                    }
                });
            }

            // Fallback
            res.status(400).json({ success: false, message: 'Unable to classify intent.' });

        } catch (error) {
            next(error);
        }
    }
}
