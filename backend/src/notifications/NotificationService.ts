import { prisma } from '../models/prisma';
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
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) throw new Error('User not found');

            // 1. Log to DB (In-App Notification)
            const notification = await prisma.notification.create({
                data: {
                    userId,
                    message,
                    type,
                },
            });

            // 2. Dispatch Email if type requires it
            if (type === 'EMAIL' || type === 'ALERT') {
                logger.info(`Dispatching email notification to ${user.email}`);
                await GmailIntegration.sendEmailWithAttachment(
                    user.email,
                    'FacultyFlow Notification',
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
        return prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });
    }

    static async getUserNotifications(userId: string) {
        return prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
