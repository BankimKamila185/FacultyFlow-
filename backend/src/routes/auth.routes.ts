import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with Google OAuth token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid token
 */
router.post('/login', AuthController.login);

// DEV ONLY: login as any faculty by email without Google OAuth
router.post('/dev-login', AuthController.devLogin);
router.get('/firebase-status', AuthController.getFirebaseStatus);

router.post('/logout', AuthController.logout);

router.get('/me', authenticate, AuthController.getMe);
router.post('/dev-context', authenticate, AuthController.updateDevContext);

/**
 * @swagger
 * /auth/fcm-token:
 *   post:
 *     summary: Register a Firebase Cloud Messaging token for push notifications
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token registered successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/fcm-token', authenticate, AuthController.registerFCMToken);

export default router;
