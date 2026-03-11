import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../utils/redis';
import winston from 'winston';
import { FirestoreService } from '../services/FirestoreService';
import fetch from 'node-fetch';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export const workflowQueue = new Queue('workflow-queue', { connection: redis as any });
export const emailQueue = new Queue('email-queue', { connection: redis as any });

const workflowWorker = new Worker(
    'workflow-queue',
    async (job: Job) => {
        logger.info(`Processing workflow job ${job.id}`, job.data);
        
        if (job.data.action === 'CHECK_OVERDUE') {
            const now = new Date();
            // Fetch tasks that are not COMPLETED/OVERDUE and past deadline
            const tasks = await FirestoreService.getCollection('tasks');
            const overdueTasks = tasks.filter((t: any) => 
                !['COMPLETED', 'OVERDUE'].includes(t.status) && 
                t.deadline && (t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline)) < now
            );

            for (const task of overdueTasks) {
                await FirestoreService.updateDoc('tasks', task.id, { status: 'OVERDUE' });
            }
            logger.info(`Marked ${overdueTasks.length} tasks as OVERDUE`);

            // Escalate tasks older than 48h
            const escalationThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
            const tasksToEscalate = overdueTasks.filter((t: any) => {
                const deadline = t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline);
                return deadline < escalationThreshold && (t.escalationLevel || 0) < 2;
            });

            if (tasksToEscalate.length > 0) {
                const hods = await FirestoreService.query('users', [{ field: 'role', operator: '==', value: 'HOD' }]);
                
                for (const task of tasksToEscalate) {
                    const assignee = await FirestoreService.getDoc<any>('users', task.assignedToId);
                    logger.info(`Escalating task ${task.id} to HOD`);
                    
                    for (const hod of hods) {
                        await FirestoreService.createDoc('notifications', {
                            userId: hod.id,
                            message: `[ESCALATION ALERT] Task "${task.title}" assigned to ${assignee?.name || 'Unknown'} is critically overdue (>48h).`,
                            type: 'ALERT',
                            isRead: false
                        });
                    }

                    await FirestoreService.updateDoc('tasks', task.id, { escalationLevel: 2 });
                }
            }
        }
        else if (job.data.action === 'SYNC_SHEETS') {
            logger.info('Running background periodic sheet sync...');
            try {
                const res = await fetch('http://localhost:4000/api/sync', { method: 'POST' });
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
            repeat: { pattern: '0 * * * *' }
        });
        await workflowQueue.add('sheet-syncer', { action: 'SYNC_SHEETS' }, {
            repeat: { pattern: '0 */4 * * *' }
        });
        logger.info('✅ Cron jobs scheduled mapping');
    } catch (e) {
        logger.error('Failed to schedule cron jobs', e);
    }
}

export function scheduleWorkflowJob(data: any, delayMs: number = 0) {
    return workflowQueue.add('process-workflow', data, { delay: delayMs });
}

export function scheduleEmailJob(data: any, delayMs: number = 0) {
    return emailQueue.add('send-email', data, { delay: delayMs });
}
