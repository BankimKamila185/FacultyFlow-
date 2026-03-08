import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { prisma } from '../models/prisma';
import { generateToken } from '../utils/jwt';

export class AuthController {
    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { idToken, googleAccessToken, googleRefreshToken } = req.body;
            if (!idToken) {
                return res.status(400).json({ success: false, error: 'idToken is required' });
            }

            const { user, token } = await AuthService.loginWithGoogle(idToken, googleAccessToken, googleRefreshToken);

            res.status(200).json({
                success: true,
                data: { user, token }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DEV ONLY: Login as any existing faculty user by email — no Google required.
     * POST /api/auth/dev-login  { "email": "meetd@itm.edu" }
     */
    static async devLogin(req: Request, res: Response, next: NextFunction) {
        try {
            if (process.env.NODE_ENV === 'production') {
                return res.status(403).json({ success: false, error: 'Dev login disabled in production' });
            }

            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ success: false, error: 'email is required' });
            }

            // Find or create user
            let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
            if (!user) {
                user = await prisma.user.create({
                    data: { email: email.toLowerCase(), name: email.split('@')[0], role: 'FACULTY' }
                });
            }

            // Generate real JWT token
            const token = generateToken({ id: user.id, email: user.email, role: user.role });

            res.status(200).json({
                success: true,
                data: {
                    user: { id: user.id, email: user.email, name: user.name, role: user.role },
                    token
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async logout(req: Request, res: Response, next: NextFunction) {
        try {
            res.status(200).json({ success: true, message: 'Logged out successfully' });
        } catch (error) {
            next(error);
        }
    }

    static async registerFCMToken(req: any, res: Response, next: NextFunction) {
        try {
            const { fcmToken } = req.body;
            const userId = req.user?.id;

            if (!fcmToken) {
                return res.status(400).json({ success: false, error: 'fcmToken is required' });
            }

            await prisma.deviceToken.upsert({
                where: { token: fcmToken },
                update: { userId },
                create: { token: fcmToken, userId }
            });

            res.status(200).json({ success: true, message: 'FCM Token registered' });
        } catch (error) {
            next(error);
        }
    }
}
