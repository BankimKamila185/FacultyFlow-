import { User } from '@prisma/client';
import { verifyGoogleToken } from '../utils/googleAuth';
import { generateToken } from '../utils/jwt';
import { prisma } from '../models/prisma';

export class AuthService {
    static async loginWithGoogle(idToken: string): Promise<{ user: User; token: string }> {
        const payload = await verifyGoogleToken(idToken);

        if (!payload || !payload.email) {
            throw new Error('Invalid Google token payload');
        }

        let user = await prisma.user.findUnique({
            where: { email: payload.email },
        });

        if (!user) {
            // Create a default faculty user or restrict if necessary in production
            user = await prisma.user.create({
                data: {
                    email: payload.email,
                    name: payload.name || 'Unknown User',
                    googleId: payload.sub,
                    role: 'FACULTY',
                },
            });
        } else if (!user.googleId) {
            // Link Google account to existing user by email
            user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId: payload.sub },
            });
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        return { user, token };
    }
}
