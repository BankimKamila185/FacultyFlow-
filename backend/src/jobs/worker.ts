import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../utils/redis';
import winston from 'winston';
import { FirestoreService } from '../services/FirestoreService';
import fetch from 'node-fetch';
import * as MailService from '../services/MailService';
import { config } from '../config';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export const workflowQueue = new Queue('workflow-queue', { connection: redis as any });
export const emailQueue = new Queue('email-queue', { connection: redis as any });

/**
 * The core logic for checking overdue tasks and sending emails/escalations.
 * Refactored out so it can be called by BullMQ or a fallback scheduler.
 */
export async function runOverdueCheck() {
    const now = new Date();
    logger.info(`[OverdueCheck] Starting run at ${now.toLocaleString()}`);
    
    try {
        const tasks = await FirestoreService.getCollection('tasks');
        const users = await FirestoreService.getCollection('users');
        const departments = await FirestoreService.getCollection('departments');
        
        const userMap = new Map(users.map((u: any) => [u.id, u]));
        const deptMap = new Map(departments.map((d: any) => [d.name, d]));

        // 1. Handle Newly Overdue Tasks
        const newlyOverdue = tasks.filter((t: any) => 
            !['COMPLETED', 'OVERDUE'].includes(t.status) && 
            t.deadline && (t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline)) < now
        );

        const assigneeGroups: Record<string, any[]> = {};

        for (const task of newlyOverdue) {
            await FirestoreService.updateDoc('tasks', task.id, { status: 'OVERDUE' });
            if (!assigneeGroups[task.assignedToId]) assigneeGroups[task.assignedToId] = [];
            assigneeGroups[task.assignedToId].push(task);
        }

        // Send Digest Emails to Faculty
        for (const [assigneeId, facultyTasks] of Object.entries(assigneeGroups)) {
            const assignee = userMap.get(assigneeId);
            if (assignee?.email) {
                try {
                    const digestTasks = facultyTasks.map(t => {
                        const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : new Date());
                        const diffDays = Math.ceil((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
                        return {
                            title: t.title,
                            daysOverdue: diffDays > 0 ? diffDays : 1,
                            deadline: deadline
                        };
                    });

                    await MailService.sendOverdueDigestEmail({
                        toEmail: assignee.email,
                        toName: assignee.name || 'Faculty Member',
                        tasks: digestTasks
                    });
                } catch (mailErr) {
                    logger.error(`Failed to send overdue digest to ${assignee.email}`, mailErr);
                }
            }
        }

        // 2. Handle Severe Overdue for Escalation (>48h)
        const escalationThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const tasksToEscalate = tasks.filter((t: any) => {
            if (t.status === 'COMPLETED') return false;
            const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : null);
            if (!deadline) return false;
            
            const isSeverelyOverdue = deadline < escalationThreshold;
            const matchesEscalationLevel = (t.escalationLevel || 0) < 2;
            
            if (isSeverelyOverdue && matchesEscalationLevel) {
                if (t.progress && t.progress >= 90) return false;
                const updatedAt = t.updatedAt?.toDate ? t.updatedAt.toDate() : (t.updatedAt ? new Date(t.updatedAt) : new Date(0));
                if ((now.getTime() - updatedAt.getTime()) < 24 * 60 * 60 * 1000) return false;
                return true;
            }
            return false;
        });

        if (tasksToEscalate.length > 0) {
            const hodGroups: Record<string, { name: string; email: string; tasks: any[] }> = {};
            
            for (const task of tasksToEscalate) {
                const hodEmail = 'aartip@itm.edu';
                const hodName = 'Dr. Aarti Pardeshi';
                
                if (!hodGroups[hodEmail]) {
                    hodGroups[hodEmail] = { 
                        name: hodName, 
                        email: hodEmail, 
                        tasks: [] 
                    };
                }
                hodGroups[hodEmail].tasks.push(task);
                await FirestoreService.updateDoc('tasks', task.id, { escalationLevel: 2 });
            }

            // Send Digest Emails to HODs
            for (const [email, group] of Object.entries(hodGroups)) {
                try {
                    const digestTasks = group.tasks.map(t => {
                        const assignee = userMap.get(t.assignedToId);
                        const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : new Date());
                        const diffDays = Math.ceil((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
                        return {
                            title: t.title,
                            assigneeName: assignee?.name || 'Unknown',
                            daysOverdue: diffDays
                        };
                    });

                    await MailService.sendEscalationDigestEmail({
                        hodEmail: email,
                        hodName: group.name,
                        tasks: digestTasks
                    });

                    // Create In-App Notifications for HOD
                    const hodUser = users.find(u => u.email === email);
                    if (hodUser) {
                        await FirestoreService.createDoc('notifications', {
                            userId: hodUser.id,
                            message: `[ESCALATION] You have ${digestTasks.length} new critically overdue tasks across your departments.`,
                            type: 'ALERT',
                            isRead: false
                        });
                    }
                } catch (mailErr) {
                    logger.error(`Failed to send escalation digest to ${email}`, mailErr);
                }
            }
        }
        logger.info(`[OverdueCheck] Completed. Processed ${newlyOverdue.length} new overdues and ${tasksToEscalate.length} escalations.`);
    } catch (err) {
        logger.error('[OverdueCheck] Fatal error during run:', err);
    }
}

const workflowWorker = new Worker(
    'workflow-queue',
    async (job: Job) => {
        logger.info(`Processing workflow job ${job.id}`, job.data);
        
        if (job.data.action === 'CHECK_OVERDUE') {
            await runOverdueCheck();
        }
        else if (job.data.action === 'SYNC_SHEETS') {
            logger.info('Running background periodic sheet sync...');
            try {
                const res = await fetch('http://localhost:4000/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ preview: false, shouldNotify: false })
                });
                logger.info(`Periodic sync completed with status: ${res.status}`);
            } catch (e) {
                logger.error('Failed to trigger periodic sync', e);
            }
        }
    },
    { connection: redis as any }
);

const emailWorker = new Worker(
    'email-queue',
    async (job: Job) => {
        logger.info(`Processing email job ${job.id}: Sending to ${job.data.to}`);
        const { GmailIntegration } = require('../integrations/gmail');
        
        try {
            await GmailIntegration.sendEmail(
                job.data.userEmail, 
                job.data.to,
                job.data.subject,
                job.data.bodyText
            );
            logger.info(`Email sent successfully to ${job.data.to}`);
        } catch (error) {
            logger.error(`Failed to send email to ${job.data.to}:`, error);
            throw error;
        }
    },
    { connection: redis as any }
);

export async function setupCronJobs() {
    try {
        await workflowQueue.add('overdue-checker', { action: 'CHECK_OVERDUE' }, {
            repeat: { pattern: '0 11,15,17 * * *' }
        });
        await workflowQueue.add('sheet-syncer', { action: 'SYNC_SHEETS' }, {
            repeat: { pattern: '0 */4 * * *' }
        });
        logger.info('✅ Cron jobs scheduled');
    } catch (e) {
        logger.error('Failed to schedule cron jobs', e);
    }
}

/**
 * Fallback Scheduler for environments where Redis/BullMQ is mocked.
 * Checks every minute and runs the overdue check at specific hours.
 */
function setupFallbackCron() {
    if (config.REDIS_URL !== 'internal') return;
    
    logger.info('🕒 [FallbackCron] Starting Interval-based scheduler (11am, 3pm, 5pm)');
    
    // Check every minute
    setInterval(async () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // Trigger at exactly 11:00, 15:00, 17:00
        if (minutes === 0 && [11, 15, 17].includes(hours)) {
            logger.info(`[FallbackCron] Scheduled time reached (${hours}:00). Triggering overdue check...`);
            await runOverdueCheck();
        }
    }, 60000);
}

// Initialize everything
export const initWorker = async () => {
    logger.info('Initializing Workflow Worker...');
    await setupCronJobs();
    setupFallbackCron();
};

export function scheduleWorkflowJob(data: any, delayMs: number = 0) {
    return workflowQueue.add('process-workflow', data, { delay: delayMs });
}

export function scheduleEmailJob(data: any, delayMs: number = 0) {
    return emailQueue.add('send-email', data, { delay: delayMs });
}
