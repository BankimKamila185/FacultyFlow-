import jwt from 'jsonwebtoken';
import { config } from '../config';

export function generateToken(payload: object): string {
    return jwt.sign(payload, config.JWT_SECRET, {
        expiresIn: config.JWT_EXPIRES_IN as any,
    });
}

export function verifyToken(token: string) {
    try {
        return jwt.verify(token, config.JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}
