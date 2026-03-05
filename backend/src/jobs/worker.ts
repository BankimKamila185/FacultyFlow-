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
        // TODO: implement state machines and transition logic
        if (job.data.action === 'TRANSITION_STATE') {
            logger.info(`Transitioning workflow ${job.data.workflowId} to state ${job.data.nextState}`);
        }
    },
    { connection: redis as any }
);

const emailWorker = new Worker(
    'email-queue',
    async (job: Job) => {
        logger.info(`Processing email job ${job.id}`, job.data);
        // TODO: implement gmail integration send
    },
    { connection: redis as any }
);

workflowWorker.on('completed', (job) => logger.info(`Workflow Job ${job.id} completed.`));
workflowWorker.on('failed', (job, err) => logger.error(`Workflow Job ${job?.id} failed:`, err));

emailWorker.on('completed', (job) => logger.info(`Email Job ${job.id} completed.`));
emailWorker.on('failed', (job, err) => logger.error(`Email Job ${job?.id} failed:`, err));

export function scheduleWorkflowJob(data: any, delayMs: number = 0) {
    return workflowQueue.add('process-workflow', data, { delay: delayMs });
}

export function scheduleEmailJob(data: any, delayMs: number = 0) {
    return emailQueue.add('send-email', data, { delay: delayMs });
}
