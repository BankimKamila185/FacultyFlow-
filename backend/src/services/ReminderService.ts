import { FirestoreService } from './FirestoreService';
import { GmailIntegration } from '../integrations/gmail';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export class ReminderService {
    /**
     * Finds all users with pending tasks and sends them a summary email.
     */
    static async sendPendingTaskReminders() {
        try {
            logger.info('Starting pending task reminders process...');

            // 1. Fetch all pending tasks
            const pendingTasks = await FirestoreService.query('tasks', [
                { field: 'status', operator: '==', value: 'PENDING' }
            ]);

            if (pendingTasks.length === 0) {
                logger.info('No pending tasks found for reminders.');
                return;
            }

            // 2. Group tasks by user email
            const userTaskGroups: Record<string, { id: string; name: string; tasks: string[] }> = {};

            for (const task of pendingTasks) {
                const user = await FirestoreService.getDoc('users', task.assignedToId);
                if (!user || !user.email) continue;

                if (!userTaskGroups[user.email]) {
                    userTaskGroups[user.email] = {
                        id: user.id,
                        name: user.name || 'Faculty Member',
                        tasks: [],
                    };
                }
                
                const deadline = task.deadline?.toDate ? task.deadline.toDate() : (task.deadline ? new Date(task.deadline) : null);
                userTaskGroups[user.email].tasks.push(
                    `- ${task.title}${deadline ? ` (Due: ${deadline.toLocaleDateString()})` : ''}`
                );
            }

            // 3. Send summary emails
            for (const [email, group] of Object.entries(userTaskGroups)) {
                const subject = 'FacultyFlow Reminder: You have pending tasks';
                const body = `Hi ${group.name},

This is a friendly reminder from FacultyFlow that you have the following pending tasks:

${group.tasks.join('\n')}

Please log in to the portal to update your progress.

Best regards,
FacultyFlow Team`;

                try {
                    await GmailIntegration.sendEmail(email, email, subject, body);
                    logger.info(`Reminder email sent to ${email}`);
                } catch (err) {
                    logger.error(`Failed to send reminder email to ${email}:`, err);
                }
            }

            logger.info('Pending task reminders process completed.');
        } catch (error) {
            logger.error('Error in sendPendingTaskReminders:', error);
        }
    }
}
