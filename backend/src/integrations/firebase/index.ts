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
        // Only initialize if we have the config, otherwise don't crash the server during simple tests
        if (config.FIREBASE_PROJECT_ID && config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: config.FIREBASE_PROJECT_ID,
                    clientEmail: config.FIREBASE_CLIENT_EMAIL,
                    privateKey: config.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                }),
            });
            logger.info('Firebase Admin initialized successfully');
        } else {
            logger.warn('Firebase config missing. Firebase Admin SDK not initialized.');
        }
    } catch (error) {
        logger.error('Firebase Admin initialization error', error);
    }
}

export const firebaseAdmin = admin;
