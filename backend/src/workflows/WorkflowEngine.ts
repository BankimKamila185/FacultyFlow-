import { NotificationService } from '../notifications/NotificationService';
import { scheduleEmailJob } from '../jobs/worker';
import winston from 'winston';
import { FirestoreService } from '../services/FirestoreService';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export class WorkflowEngine {
    static async processWorkflowState(workflowId: string, event: string) {
        const workflow = await FirestoreService.getDoc<any>('workflows', workflowId);
        if (!workflow) throw new Error('Workflow not found');

        const metadata: any = workflow.metadata || {};
        let nextStatus = workflow.status;

        logger.info(`Processing workflow ${workflowId} event: ${event}`);

        switch (event) {
            case 'TASK_ASSIGNED':
                metadata.state = 'PROPOSAL_GENERATED';
                break;

            case 'PROPOSAL_GENERATED':
                await scheduleEmailJob({
                    workflowId,
                    action: 'SEND_APPROVAL_EMAIL'
                });
                metadata.state = 'EMAIL_SENT';
                break;

            case 'EMAIL_SENT':
                metadata.state = 'PENDING_APPROVAL';
                break;

            case 'APPROVAL_RECEIVED':
                metadata.state = 'TASK_COMPLETED';
                nextStatus = 'COMPLETED';

                const tasks = await FirestoreService.query('tasks', [{ field: 'workflowId', operator: '==', value: workflowId }]);
                if (tasks.length > 0) {
                    const assigneeId = tasks[0].assignedToId;
                    await NotificationService.sendNotification(
                        assigneeId,
                        `Workflow ${workflow.type} approved and completed!`,
                        'IN_APP'
                    );
                }
                break;
        }

        await FirestoreService.updateDoc('workflows', workflowId, {
            status: nextStatus,
            metadata
        });

        return metadata.state;
    }

    static async createWorkflow(type: string, initialMetadata: any = {}) {
        return FirestoreService.createDoc('workflows', {
            type,
            metadata: { ...initialMetadata, state: 'INITIALIZED' },
            status: 'ACTIVE'
        });
    }
}
