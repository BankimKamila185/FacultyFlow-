import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { FirestoreService } from '../services/FirestoreService';
import { generateToken } from '../utils/jwt';

const setAuthCookie = (res: Response, token: string) => {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
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
                        department: user.department,
                        devUser: user.devModeContext ? JSON.parse(user.devModeContext) : null
                    }, 
                    token 
                }
            });
        } catch (error) {
            next(error);
        }
    }

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

            let user = await FirestoreService.query('users', [{ field: 'email', operator: '==', value: email.toLowerCase() }]);
            let userData = user[0];

            if (!userData) {
                userData = await FirestoreService.createDoc('users', {
                    email: email.toLowerCase(),
                    name: email.split('@')[0],
                    role: 'FACULTY',
                    createdAt: new Date().toISOString()
                });
            }

            const token = generateToken({ id: userData.id, email: userData.email, role: userData.role });

            setAuthCookie(res, token);

            res.status(200).json({
                success: true,
                data: {
                    user: { 
                        id: userData.id, 
                        email: userData.email, 
                        name: userData.name, 
                        role: userData.role,
                        department: userData.department,
                        devUser: userData.devModeContext ? JSON.parse(userData.devModeContext) : null
                    },
                    token
                }
            });
        } catch (error: any) {
            console.error('Dev Login Error:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal Server Error',
                detail: 'Ensure Firebase environment variables are set correctly on Render.'
            });
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

            let user = await FirestoreService.getDoc<any>('users', userId);
            
            if (!user && process.env.NODE_ENV === 'development' && userId === 'mock-admin-id') {
                user = {
                    id: 'mock-admin-id',
                    email: 'admin@itm.edu',
                    name: 'Dev Admin',
                    role: 'ADMIN'
                };
            }

            if (!user) return res.status(404).json({ success: false, error: 'User not found' });

            res.status(200).json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        department: user.department,
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

            await FirestoreService.updateDoc('users', userId, {
                devModeContext: devUser ? JSON.stringify(devUser) : null
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

            const existingTokens = await FirestoreService.query('deviceTokens', [{ field: 'token', operator: '==', value: fcmToken }]);
            
            if (existingTokens.length > 0) {
                await FirestoreService.updateDoc('deviceTokens', existingTokens[0].id, { userId });
            } else {
                await FirestoreService.createDoc('deviceTokens', { token: fcmToken, userId });
            }

            res.status(200).json({ success: true, message: 'FCM Token registered' });
        } catch (error) {
            next(error);
        }
    }

    static async getFirebaseStatus(req: Request, res: Response) {
        try {
            const admin = require('../integrations/firebase').firebaseAdmin;
            res.status(200).json({
                success: true,
                initialized: !!admin.apps.length,
                appsCount: admin.apps.length,
                envStatus: {
                    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
                    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
                    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
                }
            });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
