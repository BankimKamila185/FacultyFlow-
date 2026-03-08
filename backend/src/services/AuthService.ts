import { User } from '@prisma/client';
import { firebaseAdmin } from '../integrations/firebase';
import { generateToken } from '../utils/jwt';
import { prisma } from '../models/prisma';

export class AuthService {
    static async loginWithGoogle(idToken: string, googleAccessToken?: string, googleRefreshToken?: string): Promise<{ user: User; token: string }> {
        let payload;
        try {
            payload = await firebaseAdmin.auth().verifyIdToken(idToken);
        } catch (error) {
            throw new Error('Invalid Firebase ID token');
        }

        if (!payload || !payload.email) {
            throw new Error('Invalid Firebase token payload');
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
                    googleId: payload.uid, // the user's firebase UID
                    role: 'FACULTY',
                    googleAccessToken: googleAccessToken || null,
                    googleRefreshToken: googleRefreshToken || null,
                },
            });
        } else {
            // Update the user's google ID and access token
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    googleId: payload.uid,
                    googleAccessToken: googleAccessToken || user.googleAccessToken,
                    ...(googleRefreshToken ? { googleRefreshToken } : {}) // Only update if new one is provided
                },
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
