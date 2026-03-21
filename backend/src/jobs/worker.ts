import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../utils/redis';
import winston from 'winston';
import { FirestoreService } from '../services/FirestoreService';
import fetch from 'node-fetch';
import * as MailService from '../services/MailService';
import { config } from '../config';
import { ReminderService } from '../services/ReminderService';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

let workflowQueue: Queue | null = null;
let emailQueue: Queue | null = null;

if (config.REDIS_URL !== 'internal') {
    try {
        workflowQueue = new Queue('workflow-queue', { connection: redis as any });
        emailQueue = new Queue('email-queue', { connection: redis as any });
    } catch (e) {
        logger.error('Failed to initialize BullMQ Queues', e);
    }
}

/**
 * The core logic for checking overdue tasks and sending emails/escalations.
 */
export async function runOverdueCheck() {
    const now = new Date();
    logger.info(`[OverdueCheck] Starting run at ${now.toLocaleString()}`);
    
    try {
        const tasks = await FirestoreService.getCollection('tasks');
        const users = await FirestoreService.getCollection('users');
        const departments = await FirestoreService.getCollection('departments');
        
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));
        const deptMap = new Map((departments || []).map((d: any) => [d.name, d]));

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
                    hodGroups[hodEmail] = { name: hodName, email: hodEmail, tasks: [] };
                }
                hodGroups[hodEmail].tasks.push(task);
                
                // Update escalation level in DB
                await FirestoreService.updateDoc('tasks', task.id, { 
                    escalationLevel: (task.escalationLevel || 0) + 1,
                    updatedAt: now
                });
            }

            // Send Escalation Summaries to Dr. Aarti Pardeshi
            for (const group of Object.values(hodGroups)) {
                try {
                    await MailService.sendEscalationDigestEmail({
                        hodEmail: group.email,
                        hodName: group.name,
                        tasks: group.tasks.map(t => ({
                            title: t.title,
                            assigneeName: userMap.get(t.assignedToId)?.name || 'Unknown',
                            daysOverdue: Math.ceil((now.getTime() - (t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline)).getTime()) / (1000 * 60 * 60 * 24))
                        }))
                    });
                } catch (mailErr) {
                    logger.error(`Failed to send escalation digest to HOD ${group.email}`, mailErr);
                }
            }
        }
    } catch (error) {
        logger.error('[OverdueCheck] Failed', error);
    }
}

let workersInitialized = false;

export async function setupCronJobs() {
    if (config.REDIS_URL === 'internal' || !workflowQueue) {
        logger.info('Skipping BullMQ cron jobs (Running in local/internal mode)');
        return;
    }

    try {
        // Overdue & Escalation (11 AM, 3 PM, 5 PM)
        await workflowQueue.add('overdue-checker', { action: 'CHECK_OVERDUE' }, {
            repeat: { pattern: '0 11,15,17 * * *' }
        });
        // Morning Reminder (10 AM)
        await workflowQueue.add('morning-reminder', { action: 'CHECK_MORNING' }, {
            repeat: { pattern: '0 10 * * *' }
        });
        // Afternoon Reminder (2 PM)
        await workflowQueue.add('afternoon-reminder', { action: 'CHECK_AFTERNOON' }, {
            repeat: { pattern: '0 14 * * *' }
        });
        // End of Day Report (6 PM)
        await workflowQueue.add('eod-report', { action: 'CHECK_EOD' }, {
            repeat: { pattern: '0 18 * * *' }
        });
        // Sheet Syncer (Every 4 hours)
        await workflowQueue.add('sheet-syncer', { action: 'SYNC_SHEETS' }, {
            repeat: { pattern: '0 */4 * * *' }
        });
        logger.info('✅ Full suite of cron jobs scheduled');
    } catch (e) {
        logger.error('Failed to schedule cron jobs', e);
    }
}

/**
 * Fallback Scheduler for environments where Redis/BullMQ is mocked.
 */
function setupFallbackCron() {
    if (config.REDIS_URL !== 'internal') return;
    
    logger.info('🕒 [FallbackCron] Starting Full Suite (10am, 11am, 2pm, 3pm, 5pm, 6pm)');
    
    setInterval(async () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        if (minutes !== 0) return; // Only trigger at the start of the hour

        if (hours === 10) {
            logger.info('[FallbackCron] Triggering Morning Reminders...');
            await ReminderService.sendMorningReminders();
        } else if (hours === 14) {
            logger.info('[FallbackCron] Triggering Afternoon Reminders...');
            await ReminderService.sendAfternoonReminders();
        } else if (hours === 18) {
            logger.info('[FallbackCron] Triggering EOD Reports...');
            await ReminderService.sendEndOfDayReport();
        } else if ([11, 15, 17].includes(hours)) {
            logger.info(`[FallbackCron] Triggering Overdue Check (${hours}:00)...`);
            await runOverdueCheck();
        }
    }, 60000);
}

// Initialize everything
export const initWorker = async () => {
    if (workersInitialized) return;
    
    logger.info('Initializing Background Services...');
    
    if (config.REDIS_URL !== 'internal') {
        try {
            const workflowWorker = new Worker(
                'workflow-queue',
                async (job: Job) => {
                    logger.info(`Processing workflow job ${job.id}`, job.data);
                    if (job.data.action === 'CHECK_OVERDUE') await runOverdueCheck();
                    else if (job.data.action === 'CHECK_MORNING') await ReminderService.sendMorningReminders();
                    else if (job.data.action === 'CHECK_AFTERNOON') await ReminderService.sendAfternoonReminders();
                    else if (job.data.action === 'CHECK_EOD') await ReminderService.sendEndOfDayReport();
                    else if (job.data.action === 'SYNC_SHEETS') {
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
                        await GmailIntegration.sendEmail(job.data.userEmail, job.data.to, job.data.subject, job.data.bodyText);
                    } catch (error) {
                        logger.error(`Failed to send email to ${job.data.to}:`, error);
                        throw error;
                    }
                },
                { connection: redis as any }
            );

            await setupCronJobs();
        } catch (e) {
            logger.error('Failed to initialize BullMQ Workers', e);
        }
    }
    
    setupFallbackCron();
    workersInitialized = true;
};

export function scheduleWorkflowJob(data: any, delayMs: number = 0) {
    if (!workflowQueue) {
        logger.warn('Workflow queue not initialized. Skipping background job.');
        return null;
    }
    return workflowQueue.add('process-workflow', data, { delay: delayMs });
}

export function scheduleEmailJob(data: any, delayMs: number = 0) {
    if (!emailQueue) {
        logger.warn('Email queue not initialized. Skipping background job.');
        return null;
    }
    return emailQueue.add('send-email', data, { delay: delayMs });
}
