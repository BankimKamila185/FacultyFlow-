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

            // 2. Fetch all users to avoid N+1 queries
            const allUsers = await FirestoreService.getCollection('users');
            const userMap = new Map(allUsers.map((u: any) => [u.id, u]));
            const deptMemberMap: Record<string, any[]> = {};
            
            // Pre-group users by department
            for (const user of allUsers) {
                if (user.department) {
                    if (!deptMemberMap[user.department]) deptMemberMap[user.department] = [];
                    deptMemberMap[user.department].push(user);
                }
            }

            // 3. Group tasks by user email
            const userTaskGroups: Record<string, { id: string; name: string; tasks: string[] }> = {};

            for (const task of pendingTasks) {
                const recipients: { email: string; name: string }[] = [];

                // 3a. Add primary assignee from map
                const primaryUser = userMap.get(task.assignedToId);
                if (primaryUser && primaryUser.email) {
                    recipients.push({ email: primaryUser.email, name: primaryUser.name || 'Faculty Member' });
                }

                // 3b. Add department members from map
                if (task.department && deptMemberMap[task.department]) {
                    for (const member of deptMemberMap[task.department]) {
                        if (member.email && !recipients.some(r => r.email === member.email)) {
                            recipients.push({ email: member.email, name: member.name || 'Dept Member' });
                        }
                    }
                }

                // 3c. Group tasks for each recipient
                for (const recipient of recipients) {
                    if (!userTaskGroups[recipient.email]) {
                        userTaskGroups[recipient.email] = {
                            id: '', 
                            name: recipient.name,
                            tasks: [],
                        };
                    }
                    
                    const deadline = task.deadline?.toDate ? task.deadline.toDate() : (task.deadline ? new Date(task.deadline) : null);
                    const taskDesc = `- ${task.title}${deadline ? ` (Due: ${deadline.toLocaleDateString()})` : ''}${task.department ? ` [Team: ${task.department}]` : ''}`;
                    
                    if (!userTaskGroups[recipient.email].tasks.includes(taskDesc)) {
                        userTaskGroups[recipient.email].tasks.push(taskDesc);
                    }
                }
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
