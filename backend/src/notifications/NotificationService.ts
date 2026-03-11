import { FirestoreService } from '../services/FirestoreService';
import { GmailIntegration } from '../integrations/gmail';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export class NotificationService {
    static async sendNotification(userId: string, message: string, type: string) {
        try {
            const user = await FirestoreService.getDoc('users', userId);
            if (!user) throw new Error('User not found');

            // 1. Log to Firestore (In-App Notification)
            const notification = await FirestoreService.createDoc('notifications', {
                userId,
                message,
                type,
                isRead: false,
            });

            // 2. Dispatch Email if type requires it
            if (type === 'EMAIL' || type === 'ALERT' || type === 'TASK_ASSIGNED') {
                logger.info(`Dispatching email notification to ${user.email}`);
                
                let subject = 'FacultyFlow Notification';
                if (type === 'TASK_ASSIGNED') {
                    subject = 'New Task Assigned: FacultyFlow';
                }

                // Sending to themselves for now, as we need an authenticated sender's token
                await GmailIntegration.sendEmail(
                    user.email, // Sender (needs OAuth token)
                    user.email, // Recipient
                    subject,
                    message
                );
            }

            return notification;
        } catch (error) {
            logger.error('Failed to send notification:', error);
            throw error;
        }
    }

    static async markAsRead(notificationId: string) {
        return FirestoreService.updateDoc('notifications', notificationId, { isRead: true });
    }

    static async getUserNotifications(userId: string) {
        return FirestoreService.query('notifications', [
            { field: 'userId', operator: '==', value: userId }
        ]);
    }
}
