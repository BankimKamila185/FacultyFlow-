import { firebaseAdmin } from './index';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export class FCMIntegration {
    static async sendNotification(token: string, title: string, body: string, data?: { [key: string]: string }) {
        try {
            if (!firebaseAdmin.apps.length) {
                logger.warn('Simulating FCM message because Firebase Admin is not initialized.');
                return;
            }

            const message = {
                notification: { title, body },
                data,
                token
            };
            const response = await firebaseAdmin.messaging().send(message);
            logger.info(`Successfully sent FCM message: ${response}`);
            return response;
        } catch (error) {
            logger.error('Error sending FCM message', error);
            throw error;
        }
    }
}
