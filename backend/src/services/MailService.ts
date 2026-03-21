// src/services/MailService.ts
//
// CENTRAL EMAIL SENDER for FacultyFlow
// ─────────────────────────────────────
// All email sending goes through this file.
//
// Mail types handled:
//   1. taskAssigned      — when task is created/reassigned
//   2. taskOverdue       — when task becomes OVERDUE
//   3. deadlineReminder  — 3 days before deadline
//   4. nudge             — ask-reason / nudge from admin/ops
//   5. escalation        — 48h overdue → email to HOD
//   6. pendingReminder   — daily digest of pending tasks
//   7. scheduled         — AI-drafted scheduled emails

import { google, gmail_v1 } from 'googleapis';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    transports: [new winston.transports.Console()],
});

const SENDER_EMAIL = process.env.MAIL_SENDER_EMAIL || '';
const APP_NAME     = 'FacultyFlow';
const APP_URL      = process.env.FRONTEND_URL || 'https://faculty-flow.vercel.app';
const BACKEND_URL  = process.env.BACKEND_URL || 'http://localhost:4000';

// ─── Low-level send ───────────────────────────────────────────────────────────
// Uses the server's own OAuth Credentials + Refresh Token
export async function sendRaw(to: string, subject: string, htmlBody: string, fromEmail?: string): Promise<boolean> {
    const sender = fromEmail || SENDER_EMAIL;

    // Check if emails are disabled or user is blacklisted
    const BLACKLIST = ['harshalp@itm.edu'];
    if (process.env.DISABLE_EMAILS === 'true' || BLACKLIST.includes(to.toLowerCase())) {
        if (BLACKLIST.includes(to.toLowerCase())) {
            logger.info(`[MailService] 🚫 Recipient ${to} is blacklisted. Skipping send.`);
        } else {
            logger.info(`[MailService] 🔕 Email sending is DISABLED (env.DISABLE_EMAILS). Skipping send to ${to}`);
        }
        return true; 
    }

    if (!sender) {
        logger.warn('[MailService] MAIL_SENDER_EMAIL not set — email skipped');
        return false;
    }

    try {
        const oauth2 = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URL,
        );

        // Use the permanent refresh token stored in .env
        oauth2.setCredentials({
            refresh_token: process.env.MAIL_REFRESH_TOKEN,
        });

        const maskedId = process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 5)}...` : 'not set';
        logger.info(`[MailService] Attempting to send email:
        - Time: ${new Date().toLocaleString()}
        - To: ${to}
        - Subject: ${subject}
        - Using ClientID: ${maskedId}`);

        const gmail = google.gmail({ version: 'v1', auth: oauth2 });

        // Build RFC 2822 message
        const boundary = `boundary_${Date.now()}`;
        const rawMessage = [
            `From: ${APP_NAME} <${sender}>`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            htmlBody.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(),
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset=utf-8',
            '',
            htmlBody,
            '',
            `--${boundary}--`,
        ].join('\r\n');

        const encoded = Buffer.from(rawMessage)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encoded },
        });

        logger.info(`[MailService] ✅ SUCCESS: "${subject}" sent to ${to}`);
        return true;
    } catch (err: any) {
        logger.error(`[MailService] ❌ FAILED to send to ${to}: ${err.message}`);
        return false;
    }
}

// ─── HTML template ────────────────────────────────────────────────────────────
// ─── HTML template ────────────────────────────────────────────────────────────
function template(title: string, body: string, ctaText?: string, ctaUrl?: string): string {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Test Banner -->
  <div style="background-color:#FFF7ED;color:#C2410C;padding:12px;text-align:center;font-weight:600;font-size:13px;border-bottom:1px solid #FED7AA;">
    ⚠️ &nbsp; TESTING MODE — Internal FacultyFlow System
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;padding:48px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">

        <!-- Header -->
        <tr><td style="padding:40px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="margin-bottom:24px;">
                  <img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiID8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgdmlld0JveD0iNTAwIDIwMCA4MDAgODAwIj4KICA8cGF0aCBmaWxsPSIjMUUxRTFFIiB0cmFuc2Zvcm09InNjYWxlKDEuMjIwOTUgMS4yMjA5NSkiIGQ9Ik03OTMuNjcxIDI5Mi44ODNDODExLjk3MiAyOTIgODMzLjk1MyAyOTIuNTM3IDg1Mi40ODcgMjkyLjU0TDk2Mi44MDcgMjkyLjcxNUM5NjEuMDUyIDMwNS4zNTEgOTU2LjMxNCAzMjQuOTc3IDk1My42MzggMzM3LjkwN0w5MzUuNzkyIDQyNC41NTJDOTA5Ljk1NSA0MjUuMDE4IDg4My44NzMgNDI0LjQ4NiA4NTguMDQ0IDQyNC42MThDODMwLjkxNCA0MjQuMjYzIDgwNS40OTMgNDI0LjE4MiA3NzkuMDE2IDQzMC45NTdDNzAzLjIxNCA0NTAuMzU1IDY1OS4wMjQgNTE4LjI4OCA2MzguMTA3IDU4OS42MzdDNjMxLjYxMiA2MTEuNzkyIDYyNy4yNTQgNjM0LjE3NSA2MjIuOTE1IDY1Ny4xOTRDNjM4LjAwNSA2NTcuMzA2IDY1My4wOTcgNjU3LjI0NCA2NjguMTg2IDY1Ny4wMTFDNjg2Ljg3OSA2MDMuNTczIDcyNy45NjUgNTY2LjI4OSA3ODUuMTE3IDU1OC44ODFDODAxLjAwMSA1NTYuODIyIDgxNi4xOSA1NTYuOTcyIDgzMi41NDIgNTU3LjAyMUM4MzMuMDQ5IDU0Ni45NDYgODM5LjA2OCA1MjEuODM3IDg0MS40MTIgNTEwLjg3NEM3ODguMTQyIDUwOS4zMjYgNzU1LjIwOSA1MTUuNTE0IDcwMi40MDUgNDk5LjkzOEM3MTIuNzkgNDg0LjYwNiA3MjEuOTY5IDQ3OC43MzMgNzM3LjkyMiA0NzAuODQ4Qzc2NS40MjEgNDc0LjkwNiA3ODIuNzg5IDQ3NC4xMzQgODEwLjM3OCA0NzQuMTM0TDg4Ni4zMDMgNDc0LjIyNUw4NjEuOTU5IDU5My40MjNDODI0LjQ1MyA1OTMuMjA1IDc4MS4xMTQgNTg5LjEwOCA3NDguNzQ3IDYwOS40MzNDNzE2Ljc3NyA2MjkuNTA4IDcwNC42NjEgNjU4LjI0IDY5Ni4xOTIgNjkzLjhMNTgwLjI3NiA2OTMuODAxQzU4My41NDUgNjc1LjUzMSA1ODUuNDk4IDY1Ni4wNDYgNTg4LjkxIDYzNy41MjdDNTk4Ljg3MyA1ODMuNDUzIDYyMC4xODggNTEzLjQ5OCA2NTYuNDU5IDQ3MS4zMzdDNjQ0LjIwNCA0NTcuNzE0IDYzOC4zMjUgNDQwLjY1OSA2MzYuOTE5IDQyMi42MTVDNjM0LjUxMiAzOTUuMTA2IDY0My40MjIgMzY3LjgwNCA2NjEuNTkxIDM0Ny4wMTNDNjkzLjY2NSAzMDkuODM0IDc0Ni42NDQgMjk2LjMgNzkzLjY3MSAyOTIuODgzWk02ODEuMTk3IDQ0NC4xNjRDNzAyLjk1OSA0MjQuMDM2IDcyMS44NjEgNDEyLjk4OSA3NDkuMzYyIDQwMi4wNjNDNzg4LjA1MiAzODguMjMzIDgxNi4yMTEgMzg4LjA0OSA4NTYuNzQ0IDM4OC42MjVDODcyLjgxNCAzODguODUzIDg4OS41NSAzODguNDMxIDkwNS42NzkgMzg4Ljc3M0M5MDkuNTA2IDM2OC42NjMgOTEzLjU1NiAzNDguNTk3IDkxNy44MjkgMzI4LjU3N0w4NDEuNTY4IDMyOC40MTdDODMwLjc2OCAzMjguNDE3IDgwOC43NjYgMzI3Ljg4NSA3OTguODE1IDMyOS4wMTJDNzgwLjE1OSAzMjkuOTUyIDc2Ni44NTQgMzMyLjMxOCA3NDguOTA2IDMzNi43MkM3MDEuODI3IDM0OC4yNjggNjUzLjU2NiAzOTEuNDg1IDY4MS4xOTcgNDQ0LjE2NFoiLz4KPC9zdmc+Cg==" alt="Logo" height="32" style="vertical-align:middle;display:inline-block;">
                  <span style="color:#1E293B;font-size:24px;font-weight:800;margin-left:8px;vertical-align:middle;letter-spacing:-0.5px;">FacultyFlow</span>
                </div>
                <h1 style="margin:0;color:#0F172A;font-size:24px;font-weight:700;line-height:1.2;">${title}</h1>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:32px 40px 40px;">
          <div style="font-size:16px;line-height:1.6;color:#334155;margin-bottom:32px;">
            ${body}
          </div>
          ${ctaText && ctaUrl ? `
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color:#000000;border-radius:8px;" align="center">
                <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.2px;">${ctaText}</a>
              </td>
            </tr>
          </table>` : ''}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:32px 40px;background-color:#F1F5F9;border-top:1px solid #E2E8F0;border-radius:0 0 12px 12px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0;font-size:13px;color:#64748B;line-height:1.5;">
                  This is an automated notification from <strong style="color:#475569;">FacultyFlow</strong>.
                  <br>Please do not reply directly to this email.
                </p>
              </td>
              <td align="right" style="vertical-align:top;">
                <span style="font-size:12px;color:#94A3B8;">&copy; ${year}</span>
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
      
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin-top:24px;">
        <tr>
          <td align="center">
            <p style="margin:0;font-size:12px;color:#94A3B8;">
              Manage your notifications in the <a href="${APP_URL}/profile" style="color:#6366F1;text-decoration:underline;">Account Settings</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}


// ─── 1. TASK ASSIGNED email ───────────────────────────────────────────────────
export async function sendTaskAssignedEmail(params: {
    toEmail: string;
    toName: string;
    taskTitle: string;
    taskId: string;
    sprintName?: string;
    subEvent?: string;
    deadline?: Date | null;
    responsibleTeam?: string;
}): Promise<void> {
    const { toEmail, toName, taskTitle, taskId, sprintName, subEvent, deadline, responsibleTeam } = params;

    const deadlineStr = deadline
        ? deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Not set';

    const body = `
        <p style="margin:0 0 16px;">Hi <strong>${toName}</strong>,</p>
        <p style="margin:0 0 20px;color:#475569;">A new high-priority task has been successfully assigned to you. Please review the details below:</p>
        
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
            <tr>
                <td style="padding:12px 16px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;width:120px;">TASK</td>
                <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #E2E8F0;color:#0F172A;font-weight:600;">${taskTitle}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">SPRINT</td>
                <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #E2E8F0;color:#334155;">${sprintName || '—'}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">CATEGORY</td>
                <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #E2E8F0;color:#334155;">${subEvent || '—'}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">TEAM</td>
                <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #E2E8F0;color:#334155;">${responsibleTeam || '—'}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;background-color:#F8FAFC;color:#64748B;font-size:13px;font-weight:600;">DEADLINE</td>
                <td style="padding:12px 16px;background-color:#ffffff;color:${deadline ? '#DC2626' : '#334155'};font-weight:700;">${deadlineStr}</td>
            </tr>
        </table>
        
        <p style="margin:0;color:#64748B;font-size:14px;">Log in to the portal to manage this task and track its progress.</p>
    `;

    await sendRaw(
        toEmail,
        `[Action Required] New Task: ${taskTitle}`,
        template('New Task Assignment', body, 'View Task Details', `${APP_URL}/tasks`),
    );
}

// ─── 2. TASK OVERDUE email ────────────────────────────────────────────────────
export async function sendTaskOverdueEmail(params: {
    toEmail: string;
    toName: string;
    taskTitle: string;
    deadline: Date;
    daysOverdue: number;
}): Promise<void> {
    const { toEmail, toName, taskTitle, deadline, daysOverdue } = params;

    const body = `
        <p style="margin:0 0 16px;">Hi <strong>${toName}</strong>,</p>
        <p style="margin:0 0 20px;color:#475569;">The following task is now <strong style="color:#DC2626;">${daysOverdue} days overdue</strong>. Please update its status immediately:</p>
        
        <div style="background-color:#FEF2F2;border:1px solid #FEE2E2;border-radius:10px;padding:20px;margin-bottom:24px;">
            <div style="font-weight:700;font-size:16px;color:#991B1B;">${taskTitle}</div>
            <div style="font-size:14px;color:#B91C1C;margin-top:4px;">Deadline: ${deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        
        <p style="margin:0;color:#64748B;font-size:14px;">Your HOD has been notified. If you need more time, please add a remark explaining the delay.</p>
    `;

    await sendRaw(
        toEmail,
        `[Overdue Notice] Task: ${taskTitle}`,
        template('Task Overdue Alert', body, 'Update Task Status', `${APP_URL}/tasks`),
    );
}

/**
 * Consolidates multiple overdue tasks for a faculty member
 */
export async function sendOverdueDigestEmail(params: {
    toEmail: string;
    toName: string;
    tasks: { title: string; daysOverdue: number; deadline: Date }[];
}): Promise<void> {
    const { toEmail, toName, tasks } = params;

    const taskItems = tasks.map(t => `
        <div style="padding:12px;border-bottom:1px solid #E2E8F0;">
            <div style="font-weight:600;color:#1E293B;">${t.title}</div>
            <div style="font-size:13px;color:#DC2626;">Status: ${t.daysOverdue} days overdue</div>
        </div>
    `).join('');

    const body = `
        <p style="margin:0 0 16px;">Hi <strong>${toName}</strong>,</p>
        <p style="margin:0 0 20px;color:#475569;">You have <strong>${tasks.length} overdue tasks</strong>. Please provide updates or complete them immediately to avoid further escalation:</p>
        
        <div style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            ${taskItems}
        </div>
        
        <p style="margin:0;color:#64748B;font-size:14px;">If you have reasons for the delay, please update the remarks in the portal.</p>
    `;

    await sendRaw(
        toEmail,
        `Action Required: ${tasks.length} Overdue Tasks`,
        template('Overdue Task Summary', body, 'Update Status', `${APP_URL}/tasks`),
    );
}

// ─── 3. DEADLINE REMINDER email (3 days before) ───────────────────────────────
export async function sendDeadlineReminderEmail(params: {
    toEmail: string;
    toName: string;
    taskTitle: string;
    deadline: Date;
    daysLeft: number;
}): Promise<void> {
    const { toEmail, toName, taskTitle, deadline, daysLeft } = params;

    const body = `
        <p style="margin:0 0 16px;">Hi <strong>${toName}</strong>,</p>
        <p style="margin:0 0 20px;color:#475569;">This is a friendly reminder that the following task is due in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>:</p>
        
        <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:20px;margin-bottom:24px;">
            <div style="font-weight:700;font-size:16px;color:#1E293B;">${taskTitle}</div>
            <div style="font-size:14px;color:#64748B;margin-top:4px;">Due: ${deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        
        <p style="margin:0;color:#64748B;font-size:14px;">Please ensure completion by the deadline or request an extension if needed.</p>
    `;

    await sendRaw(
        toEmail,
        `Reminder: "${taskTitle}" is due soon`,
        template('Upcoming Deadline Reminder', body, 'Open Task', `${APP_URL}/tasks`),
    );
}

// ─── 4. NUDGE / ASK REASON email ─────────────────────────────────────────────
export async function sendNudgeEmail(params: { toEmail: string; toName: string; taskTitle: string; fromName: string }): Promise<void> {
    const { toEmail, toName, taskTitle, fromName } = params;
    
    const body = `
        <p style="margin:0 0 16px;">Hi <strong>${toName}</strong>,</p>
        <p style="margin:0 0 20px;color:#475569;"><strong>${fromName}</strong> has requested a status update for the following task:</p>
        
        <div style="background-color:#F1F5F9;border-left:4px solid #6366F1;padding:16px 20px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-weight:600;font-size:15px;color:#1E293B;">${taskTitle}</div>
        </div>
        
        <p style="margin:0;color:#64748B;font-size:14px;">Please provide a brief update or add a remark in the portal.</p>
    `;

    await sendRaw(
        toEmail,
        `Nudge: "${taskTitle}" status update requested`,
        template('Status Update Requested', body, 'Add Remark / Update', `${APP_URL}/tasks`),
    );
}

// ─── 5. ESCALATION email to HOD ──────────────────────────────────────────────
export async function sendEscalationEmail(params: {
    hodEmail: string;
    hodName: string;
    taskTitle: string;
    assigneeName: string;
    assigneeEmail: string;
    deadline: Date;
    daysOverdue: number;
}): Promise<void> {
    const { hodEmail, hodName, taskTitle, assigneeName, assigneeEmail, deadline, daysOverdue } = params;

    const body = `
        <p style="margin:0 0 16px;">Hello <strong>${hodName}</strong>,</p>
        <p style="margin:0 0 20px;color:#475569;">This is an escalation notice regarding a task assigned to <strong>${assigneeName}</strong> which is now <strong>${daysOverdue} days overdue</strong>:</p>
        
        <div style="background-color:#FEF2F2;border:1px solid #FEE2E2;border-radius:10px;padding:20px;margin-bottom:24px;">
            <div style="font-weight:700;font-size:16px;color:#991B1B;">${taskTitle}</div>
            <div style="font-size:14px;color:#B91C1C;margin-top:4px;">Status: ${daysOverdue} Days Overdue</div>
            <div style="font-size:13px;color:#64748B;margin-top:2px;">Assigned to: ${assigneeName} (${assigneeEmail})</div>
        </div>
        
        <p style="margin:0;color:#64748B;font-size:14px;">Action is required to ensure this task is addressed immediately.</p>
    `;

    await sendRaw(
        hodEmail,
        `[Escalation] "${taskTitle}" is ${daysOverdue} days overdue`,
        template('Task Escalation Alert', body, 'View Task Progress', `${APP_URL}/tasks`),
    );
}

/**
 * Consolidates multiple escalations into one email for an HOD
 */
export async function sendEscalationDigestEmail(params: {
    hodEmail: string;
    hodName: string;
    tasks: { title: string; assigneeName: string; daysOverdue: number }[];
}): Promise<void> {
    const { hodEmail, hodName, tasks } = params;
    
    const taskRows = tasks.map(t => `
        <div style="padding:12px;border-bottom:1px solid #FEE2E2;">
            <div style="font-weight:600;color:#991B1B;">${t.title}</div>
            <div style="font-size:13px;color:#475569;">Assigned to: ${t.assigneeName} | <span style="color:#DC2626;font-weight:600;">${t.daysOverdue} days overdue</span></div>
        </div>
    `).join('');

    const body = `
        <p style="margin:0 0 16px;">Hello <strong>${hodName}</strong>,</p>
        <p style="margin:0 0 20px;color:#475569;">The following tasks in your department are critically overdue (>48h) and require immediate attention:</p>
        
        <div style="background-color:#FEF2F2;border:1px solid #FEE2E2;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            ${taskRows}
        </div>
        
        <p style="margin:0;color:#64748B;font-size:14px;">Please follow up with the respective faculty members.</p>
    `;

    await sendRaw(
        hodEmail,
        `[URGENT] ${tasks.length} Escalated Overdue Tasks`,
        template('Escalation Digest', body, 'View All Tasks', `${APP_URL}/dashboard`),
    );
}


// ─── 6. DAILY PENDING DIGEST email ───────────────────────────────────────────
export async function sendPendingDigestEmail(params: {
    toEmail: string;
    toName: string;
    tasks: { title: string; deadline: Date | null; department: string | null }[];
}): Promise<void> {
    const { toEmail, toName, tasks } = params;

    const body = `
        <p style="margin:0 0 16px;">Hi <strong>${toName}</strong>,</p>
        <p style="margin:0 0 20px;color:#475569;">You have <strong>${tasks.length} pending task${tasks.length !== 1 ? 's' : ''}</strong> requiring your attention:</p>
        
        <table style="width:100%;border-collapse:collapse;margin:24px 0;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
            <thead>
                <tr style="background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;">
                    <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Task</th>
                    <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Deadline</th>
                </tr>
            </thead>
            <tbody>${tasks.map(t => `
                <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:14px 16px;color:#1E293B;font-weight:500;">${t.title}</td>
                    <td style="padding:14px 16px;color:#DC2626;font-size:13px;font-weight:600;">${t.deadline ? t.deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                </tr>`).join('')}</tbody>
        </table>
        
        <p style="margin:0;color:#64748B;font-size:14px;">Please log in to FacultyFlow to update your progress.</p>
    `;

    await sendRaw(
        toEmail,
        `Daily Task Summary: ${tasks.length} Items Pending`,
        template('Pending Task Digest', body, 'Go to Portal', `${APP_URL}/tasks`),
    );
}

// ─── 7. MORNING / AFTERNOON CHECK-IN ─────────────────────────────────────────
export async function sendMorningCheckinEmail(params: {
    toEmail: string;
    toName: string;
    tasks: { id?: string; title: string; deadline: Date | null }[];
    timeLabel: 'Morning' | 'Afternoon';
    urgentCount?: number;
    ccEmail?: string;
    aiMessage?: string;
}): Promise<void> {
    const { toEmail, toName, tasks, timeLabel, urgentCount = 0, ccEmail, aiMessage } = params;
    const isMorning = timeLabel === 'Morning';
    const apiBaseUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000';

    const taskList = tasks.map((t, index) => {
        const isUrgent = index < urgentCount;
        const quickActionHtml = t.id ? `
            <a href="${apiBaseUrl}/api/tasks/${t.id}/quick-action?action=complete" style="color:#059669;font-size:12px;font-weight:600;text-decoration:none;margin-left:12px;" target="_blank">Mark Complete</a>` : '';
        
        return `<div style="padding:14px 16px;border-bottom:1px solid #F1F5F9;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td>
                        <div style="font-weight:600;color:#1E293B;font-size:15px;">${t.title}</div>
                        ${t.deadline ? `<div style="font-size:12px;color:${isUrgent ? '#DC2626' : '#64748B'};margin-top:2px;">Due: ${t.deadline.toLocaleDateString()}</div>` : ''}
                    </td>
                    <td align="right">
                        ${isUrgent ? '<span style="background-color:#FEF2F2;color:#DC2626;font-size:10px;padding:2px 8px;border-radius:12px;font-weight:700;margin-right:8px;">URGENT</span>' : ''}
                        ${quickActionHtml}
                    </td>
                </tr>
            </table>
        </div>`;
    }).join('');

    const body = `
        <p style="margin:0 0 16px;">Hi <strong>${toName}</strong>,</p>
        
        ${urgentCount > 0 ? `
        <div style="background-color:#FEF9C3;border:1px solid #FEF08A;padding:12px 16px;margin-bottom:24px;border-radius:8px;font-size:14px;color:#854D0E;">
            💡 You have ${urgentCount} urgent task${urgentCount > 1 ? 's' : ''} approaching due date.
        </div>` : ''}
        
        <div style="font-size:15px;color:#334155;margin-bottom:24px;line-height:1.6;font-style:italic;padding:16px;background-color:#F8FAFC;border-radius:8px;border-left:4px solid #94A3B8;">
            "${aiMessage || (isMorning ? 'Good morning! Here is a summary of your pending tasks for today:' : 'Good afternoon! A quick check on your afternoon task load:')}"
        </div>
        
        <div style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            ${taskList}
        </div>
        
        <p style="margin:0;color:#64748B;font-size:14px;">Log in to the portal to manage your full schedule.</p>
    `;

    const recipients = ccEmail ? `${toEmail}, ${ccEmail}` : toEmail;

    await sendRaw(
        recipients,
        `${timeLabel} Check-in: ${tasks.length} Tasks Pending`,
        template(`${timeLabel} Agenda Summary`, body, 'Open Portal', `${APP_URL}/tasks`),
    );
}

// ─── 8. URGENT DEADLINE (3 DAYS) ──────────────────────────────────────────────
export async function sendUrgentDeadlineEmail(params: {
    toEmail: string;
    toName: string;
    taskTitle: string;
    deadline: Date;
    daysLeft: number;
    ccEmail?: string;
}): Promise<void> {
    const { toEmail, toName, taskTitle, deadline, daysLeft, ccEmail } = params;
    
    const body = `
        <p style="margin:0 0 16px;">Hi <strong>${toName}</strong>,</p>
        
        <div style="background-color:#FEF2F2;border:1px solid #FEE2E2;padding:24px;border-radius:12px;margin-bottom:24px;text-align:center;">
            <div style="color:#DC2626;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Urgent Deadline Reminder</div>
            <div style="font-weight:800;font-size:20px;color:#991B1B;line-height:1.3;margin-bottom:8px;">${taskTitle}</div>
            <div style="color:#B91C1C;font-size:15px;">Due in <strong style="font-size:18px;">${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong> (${deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })})</div>
        </div>
        
        <p style="margin:0;color:#64748B;font-size:14px;">Please complete this task immediately. ${ccEmail ? 'Your HOD has been cc\'d for visibility.' : ''}</p>
    `;

    const recipients = ccEmail ? `${toEmail}, ${ccEmail}` : toEmail;

    await sendRaw(
        recipients,
        `FINAL REMINDER: "${taskTitle}" due in ${daysLeft} days`,
        template('Action Required: Approaching Deadline', body, 'Update Status Now', `${APP_URL}/tasks`),
    );
}

// ─── 9. DEPARTMENT REPORT (EOD) ──────────────────────────────────────────────
export async function sendDepartmentReportEmail(params: {
    toEmail: string;
    toName: string;
    department: string;
    stats: {
        completedToday: number;
        pendingTotal: number;
        overdueTotal: number;
    };
    recentTasks: { title: string; assignee: string; status: string }[];
}): Promise<void> {
    const { toEmail, toName, department, stats, recentTasks } = params;

    const taskRows = recentTasks.map(t => `
        <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:12px;color:#1E293B;font-weight:500;">${t.title}</td>
            <td style="padding:12px;color:#64748B;font-size:13px;">${t.assignee}</td>
            <td style="padding:12px;">
                <span style="background-color:${t.status === 'COMPLETED' ? '#ECFDF5' : '#FEF2F2'};color:${t.status === 'COMPLETED' ? '#059669' : '#DC2626'};font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;">${t.status}</span>
            </td>
        </tr>
    `).join('');

    const body = `
        <p style="margin:0 0 16px;">Hi <strong>${toName}</strong>,</p>
        <p style="margin:0 0 24px;color:#475569;">Here is the performance report for the <strong>${department}</strong> department:</p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
                <td width="33%" style="padding-right:10px;">
                    <div style="background-color:#ECFDF5;border:1px solid #D1FAE5;padding:16px;border-radius:12px;text-align:center;">
                        <div style="font-size:24px;font-weight:800;color:#059669;">${stats.completedToday}</div>
                        <div style="font-size:11px;color:#047857;text-transform:uppercase;font-weight:600;margin-top:4px;">Completed</div>
                    </div>
                </td>
                <td width="33%" style="padding:0 5px;">
                    <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;padding:16px;border-radius:12px;text-align:center;">
                        <div style="font-size:24px;font-weight:800;color:#1E293B;">${stats.pendingTotal}</div>
                        <div style="font-size:11px;color:#64748B;text-transform:uppercase;font-weight:600;margin-top:4px;">Pending</div>
                    </div>
                </td>
                <td width="33%" style="padding-left:10px;">
                    <div style="background-color:#FEF2F2;border:1px solid #FEE2E2;padding:16px;border-radius:12px;text-align:center;">
                        <div style="font-size:24px;font-weight:800;color:#DC2626;">${stats.overdueTotal}</div>
                        <div style="font-size:11px;color:#B91C1C;text-transform:uppercase;font-weight:600;margin-top:4px;">Overdue</div>
                    </div>
                </td>
            </tr>
        </table>

        <div style="font-weight:700;font-size:14px;color:#0F172A;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Recent Activity</div>
        <table width="100%" style="border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
            <tr style="background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;text-align:left;">
                <th style="padding:12px;font-size:11px;color:#64748B;font-weight:600;">TASK</th>
                <th style="padding:12px;font-size:11px;color:#64748B;font-weight:600;">ASSIGNEE</th>
                <th style="padding:12px;font-size:11px;color:#64748B;font-weight:600;">STATUS</th>
            </tr>
            ${taskRows}
        </table>
    `;

    await sendRaw(
        toEmail,
        `Daily Summary: ${department} Performance`,
        template(`EOD Report - ${department}`, body, 'Review Analytics', `${APP_URL}/dashboard`),
    );
}


// ─── 10. CUSTOM / SCHEDULED email ─────────────────────────────────────────────
export async function sendCustomEmail(params: {
    toEmail: string;
    subject: string;
    htmlBody: string;
    fromEmail?: string;
}): Promise<boolean> {
    return sendRaw(params.toEmail, params.subject, params.htmlBody, params.fromEmail);
}

// ─── 11. EMAIL PREVIEW BUILDER (no sending) ───────────────────────────────────
export function buildEmailPreviewHtml(type: string): string {
    const sampleDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const samplePastDeadline = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    const later = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (type === 'assigned') {
        const deadlineStr = sampleDeadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const body = `
            <p style="margin:0 0 16px;">Hi <strong>Dr. Rahul Mehta</strong>,</p>
            <p style="margin:0 0 20px;color:#475569;">A new high-priority task has been successfully assigned to you. Please review the details below:</p>
            
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
                <tr>
                    <td style="padding:12px 16px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;width:120px;">TASK</td>
                    <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #E2E8F0;color:#0F172A;font-weight:600;">Exam Paper Submission — Spring 2026</td>
                </tr>
                <tr>
                    <td style="padding:12px 16px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">SPRINT</td>
                    <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #E2E8F0;color:#334155;">Assessment Sprint</td>
                </tr>
                <tr>
                    <td style="padding:12px 16px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">CATEGORY</td>
                    <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #E2E8F0;color:#334155;">Exam Day Prep (Sprint 2)</td>
                </tr>
                <tr>
                    <td style="padding:12px 16px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">TEAM</td>
                    <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #E2E8F0;color:#334155;">Computer Science Dept</td>
                </tr>
                <tr>
                    <td style="padding:12px 16px;background-color:#F8FAFC;color:#64748B;font-size:13px;font-weight:600;">DEADLINE</td>
                    <td style="padding:12px 16px;background-color:#ffffff;color:#DC2626;font-weight:700;">${deadlineStr}</td>
                </tr>
            </table>
            
            <p style="margin:0;color:#64748B;font-size:14px;">Log in to the portal to manage this task and track its progress.</p>`;
        return template('New Task Assignment', body, 'View Task Details', `${APP_URL}/tasks`);
    }

    if (type === 'overdue') {
        const body = `
            <p style="margin:0 0 16px;">Hi <strong>Dr. Priya Sharma</strong>,</p>
            <p style="margin:0 0 20px;color:#475569;">The following task is now <strong style="color:#DC2626;">5 days overdue</strong>. Prompt action is required:</p>
            
            <div style="background-color:#FEF2F2;border:1px solid #FEE2E2;border-radius:10px;padding:20px;margin-bottom:24px;">
                <div style="font-weight:700;font-size:16px;color:#991B1B;">Grade Submission Q1</div>
                <div style="font-size:14px;color:#B91C1C;margin-top:4px;">Original Deadline: ${samplePastDeadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
            
            <p style="margin:0;color:#64748B;font-size:14px;">Please update the task status or add a remark. Your HOD has been notified of this delay.</p>`;
        return template('Task Overdue Notice', body, 'Update Task Status', `${APP_URL}/tasks`);
    }

    if (type === 'nudge') {
        const body = `
            <p style="margin:0 0 16px;">Hi <strong>Dr. Priya Sharma</strong>,</p>
            <p style="margin:0 0 20px;color:#475569;"><strong>Admin — Ops Manager</strong> has requested a status update for the following task:</p>
            
            <div style="background-color:#F1F5F9;border-left:4px solid #6366F1;padding:16px 20px;margin-bottom:24px;border-radius:0 8px 8px 0;">
                <div style="font-weight:600;font-size:15px;color:#1E293B;">Lab Report Review</div>
            </div>
            
            <p style="margin:0;color:#64748B;font-size:14px;">Please log in to FacultyFlow and add a remark to provide the requested update.</p>`;
        return template('Status Update Requested', body, 'Add Remark', `${APP_URL}/tasks`);
    }

    if (type === 'morning') {
        const tasks = [
            { id: 'task_001', title: 'Exam Paper Submission', deadline: sampleDeadline, urgent: true },
            { id: 'task_002', title: 'Lab Report Review', deadline: soon, urgent: true },
            { id: 'task_003', title: 'Student Counselling Report', deadline: later, urgent: false },
        ];
        const taskItems = tasks.map(t => `
            <div style="padding:12px 16px;border-bottom:1px solid #F1F5F9;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td>
                            <div style="font-weight:600;color:#1E293B;font-size:15px;">${t.title}</div>
                            <div style="font-size:12px;color:#64748B;margin-top:2px;">Due: ${t.deadline.toLocaleDateString()}</div>
                        </td>
                        <td align="right">
                            ${t.urgent ? '<span style="background-color:#FEF2F2;color:#DC2626;font-size:10px;padding:2px 8px;border-radius:12px;font-weight:700;margin-right:8px;">URGENT</span>' : ''}
                            <a href="${APP_URL}/api/tasks/${t.id}/quick-action?action=complete" style="color:#059669;font-size:12px;font-weight:600;text-decoration:none;">Mark Complete</a>
                        </td>
                    </tr>
                </table>
            </div>`).join('');
            
        const body = `
            <p style="margin:0 0 16px;">Hi <strong>Dr. Bankim Kamila</strong>,</p>
            
            <div style="background-color:#FEF9C3;border:1px solid #FEF08A;padding:12px 16px;margin-bottom:24px;border-radius:8px;font-size:14px;color:#854D0E;">
                💡 You have 2 urgent tasks approaching their deadline.
            </div>
            
            <div style="font-size:15px;color:#334155;margin-bottom:24px;line-height:1.6;font-style:italic;padding:16px;background-color:#F8FAFC;border-radius:8px;border-left:4px solid #94A3B8;">
                "Good morning! You have a packed day ahead — please prioritize the Exam Paper Submission task. You've got this! 💪"
            </div>
            
            <div style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
                ${taskItems}
            </div>
            
            <p style="margin:24px 0 0;color:#64748B;font-size:14px;">Review your full agenda on the portal.</p>`;
        return template('Morning Task Summary', body, 'Open Portal', `${APP_URL}/tasks`);
    }

    if (type === 'urgent') {
        const body = `
            <p style="margin:0 0 16px;">Hi <strong>Dr. Bankim Kamila</strong>,</p>
            
            <div style="background-color:#FEF2F2;border:1px solid #FEE2E2;padding:24px;border-radius:12px;margin-bottom:24px;text-align:center;">
                <div style="color:#DC2626;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Urgent Deadline Reminder</div>
                <div style="font-weight:800;font-size:20px;color:#991B1B;line-height:1.3;margin-bottom:8px;">Exam Paper Submission — Spring 2026</div>
                <div style="color:#B91C1C;font-size:15px;">Due in <strong style="font-size:18px;">1 day</strong> (${sampleDeadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })})</div>
            </div>
            
            <p style="margin:0;color:#64748B;font-size:14px;">Please complete this task immediately. Your HOD has been cc'd for visibility.</p>`;
        return template('Final Reminder: Task Deadline', body, 'Update Status Now', `${APP_URL}/tasks`);
    }

    return `<p>Unknown type. Use: assigned | overdue | nudge | morning | urgent</p>`;
}
