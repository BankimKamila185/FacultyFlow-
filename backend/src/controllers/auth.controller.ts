import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { prisma } from '../models/prisma';
import { generateToken } from '../utils/jwt';

const setAuthCookie = (res: Response, token: string) => {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
        httpOnly: true,
        secure: isProd, // Must be true for SameSite=None
        sameSite: isProd ? 'none' : 'lax', // 'none' allows cross-site cookies
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

export class AuthController {
    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { idToken, googleAccessToken, googleRefreshToken } = req.body;
            if (!idToken) {
                return res.status(400).json({ success: false, error: 'idToken is required' });
            }

            const { user, token } = await AuthService.loginWithGoogle(idToken, googleAccessToken, googleRefreshToken);

            setAuthCookie(res, token);

            res.status(200).json({
                success: true,
                data: { 
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        devUser: user.devModeContext ? JSON.parse(user.devModeContext) : null
                    }, 
                    token 
                }
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
            const isProd = process.env.NODE_ENV === 'production';
            const allowDevLogin = process.env.ALLOW_DEV_LOGIN === 'true';

            if (isProd && !allowDevLogin) {
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

            setAuthCookie(res, token);

            res.status(200).json({
                success: true,
                data: {
                    user: { 
                        id: user.id, 
                        email: user.email, 
                        name: user.name, 
                        role: user.role,
                        devUser: user.devModeContext ? JSON.parse(user.devModeContext) : null
                    },
                    token
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const isProd = process.env.NODE_ENV === 'production';
            res.clearCookie('auth_token', {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? 'none' : 'lax'
            });
            res.status(200).json({ success: true, message: 'Logged out successfully' });
        } catch (error) {
            next(error);
        }
    }

    static async getMe(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });

            res.status(200).json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        devUser: user.devModeContext ? JSON.parse(user.devModeContext) : null
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateDevContext(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.id;
            const { devUser } = req.body;

            await prisma.user.update({
                where: { id: userId },
                data: { devModeContext: devUser ? JSON.stringify(devUser) : null }
            });

            res.status(200).json({ success: true, message: 'Dev context updated' });
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
