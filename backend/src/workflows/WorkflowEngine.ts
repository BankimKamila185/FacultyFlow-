import { NotificationService } from '../notifications/NotificationService';
import { scheduleEmailJob } from '../jobs/worker';
import winston from 'winston';
import { prisma } from '../models/prisma';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export class WorkflowEngine {
    /**
     * Example: Academic Task Workflow
     * Flow: Task Assigned -> Proposal Generated -> Email Sent -> Approval Received -> Task Completed
     */
    static async processWorkflowState(workflowId: string, event: string) {
        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId },
            include: { tasks: true }
        });

        if (!workflow) throw new Error('Workflow not found');

        const metadata: any = workflow.metadata || {};
        let nextStatus = workflow.status;

        logger.info(`Processing workflow ${workflowId} event: ${event}`);

        // Very simplistic state machine for the prompt's example
        switch (event) {
            case 'TASK_ASSIGNED':
                // Generate proposal via PDF
                metadata.state = 'PROPOSAL_GENERATED';
                break;

            case 'PROPOSAL_GENERATED':
                // Send email with proposal to HOD
                await scheduleEmailJob({
                    workflowId,
                    action: 'SEND_APPROVAL_EMAIL'
                });
                metadata.state = 'EMAIL_SENT';
                break;

            case 'EMAIL_SENT':
                // Wait for approval API call...
                metadata.state = 'PENDING_APPROVAL';
                break;

            case 'APPROVAL_RECEIVED':
                metadata.state = 'TASK_COMPLETED';
                nextStatus = 'COMPLETED';

                // Notify user
                if (workflow.tasks.length > 0) {
                    const assigneeId = workflow.tasks[0].assignedToId;
                    await NotificationService.sendNotification(
                        assigneeId,
                        `Workflow ${workflow.type} approved and completed!`,
                        'IN_APP'
                    );
                }
                break;
        }

        await prisma.workflow.update({
            where: { id: workflowId },
            data: {
                status: nextStatus,
                metadata
            }
        });

        return metadata.state;
    }

    static async createWorkflow(type: string, initialMetadata: any = {}) {
        const workflow = await prisma.workflow.create({
            data: {
                type,
                metadata: { ...initialMetadata, state: 'INITIALIZED' }
            }
        });
        return workflow;
    }
}
