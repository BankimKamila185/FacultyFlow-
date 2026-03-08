import * as admin from 'firebase-admin';
import { config } from '../../config';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

if (!admin.apps.length) {
    try {
        const fbConfig = {
            projectId: config.FIREBASE_PROJECT_ID,
            clientEmail: config.FIREBASE_CLIENT_EMAIL,
            privateKey: config.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        };

        if (fbConfig.projectId && fbConfig.clientEmail && fbConfig.privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert(fbConfig as any),
            });
            logger.info('Firebase Admin initialized successfully via environment variables');
        } else {
            // Check if we have a service account file instead
            const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';
            try {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccountPath),
                });
                logger.info(`Firebase Admin initialized successfully via ${serviceAccountPath}`);
            } catch (fileError) {
                logger.warn('Firebase config missing and service-account.json not found. Firebase Admin SDK not initialized.');
            }
        }
    } catch (error) {
        logger.error('Firebase Admin initialization error', error);
    }
}

export const firebaseAdmin = admin;
