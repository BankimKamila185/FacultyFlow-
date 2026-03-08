import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../utils/redis';
import winston from 'winston';

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
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            
            const overdueTasks = await prisma.task.updateMany({
                where: {
                    status: { notIn: ['COMPLETED', 'OVERDUE'] },
                    deadline: { lt: new Date() }
                },
                data: { status: 'OVERDUE' }
            });
            logger.info(`Marked ${overdueTasks.count} tasks as OVERDUE`);

            // Multi-tier Escalation Engine
            const escalationThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
            const tasksToEscalate = await prisma.task.findMany({
                where: {
                    status: 'OVERDUE',
                    deadline: { lt: escalationThreshold },
                    escalationLevel: { lt: 2 }
                },
                include: { assignedTo: true }
            });

            if (tasksToEscalate.length > 0) {
                const hods = await prisma.user.findMany({ where: { role: 'HOD' } });
                
                for (const task of tasksToEscalate) {
                    logger.info(`Escalating task ${task.id} to HOD`);
                    
                    for (const hod of hods) {
                        await prisma.notification.create({
                            data: {
                                userId: hod.id,
                                message: `[ESCALATION ALERT] Task "${task.title}" assigned to ${task.assignedTo.name} is critically overdue (>48h).`,
                                type: 'ALERT'
                            }
                        });
                    }

                    await prisma.task.update({
                        where: { id: task.id },
                        data: { escalationLevel: 2 }
                    });
                }
            }
        }
        else if (job.data.action === 'SYNC_SHEETS') {
            logger.info('Running background periodic sheet sync...');
            // In a real scenario, this could trigger sync for all users with custom sheet URLs
            const res = await fetch('http://localhost:4000/api/sync', { method: 'POST' });
            logger.info(`Periodic sync completed with status: ${res.status}`);
        }
        else if (job.data.action === 'TRANSITION_STATE') {
            logger.info(`Transitioning workflow ${job.data.workflowId} to state ${job.data.nextState}`);
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

workflowWorker.on('completed', (job) => logger.info(`Workflow Job ${job.id} completed.`));
workflowWorker.on('failed', (job, err) => logger.error(`Workflow Job ${job?.id} failed:`, err));

emailWorker.on('completed', (job) => logger.info(`Email Job ${job.id} completed.`));
emailWorker.on('failed', (job, err) => logger.error(`Email Job ${job?.id} failed:`, err));

// Periodic cron setup helper
export async function setupCronJobs() {
    try {
        await workflowQueue.add('overdue-checker', { action: 'CHECK_OVERDUE' }, {
            repeat: { pattern: '0 * * * *' } // Every hour
        });
        await workflowQueue.add('sheet-syncer', { action: 'SYNC_SHEETS' }, {
            repeat: { pattern: '0 */4 * * *' } // Every 4 hours
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
