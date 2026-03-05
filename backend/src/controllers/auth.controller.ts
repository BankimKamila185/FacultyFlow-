import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

export class AuthController {
    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { idToken } = req.body;
            if (!idToken) {
                return res.status(400).json({ success: false, error: 'idToken is required' });
            }

            const { user, token } = await AuthService.loginWithGoogle(idToken);

            res.status(200).json({
                success: true,
                data: { user, token }
            });
        } catch (error) {
            next(error);
        }
    }

    static async logout(req: Request, res: Response, next: NextFunction) {
        try {
            // For JWT, logout is usually handled client-side by dropping the token.
            // But we can invalidate it in Redis if required (token blacklisting).
            res.status(200).json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}
