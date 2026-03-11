import { firebaseAdmin } from '../integrations/firebase';
import { generateToken } from '../utils/jwt';
import { FirestoreService } from './FirestoreService';

export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    googleId?: string;
    googleAccessToken?: string;
    googleRefreshToken?: string;
    createdAt?: any;
    updatedAt?: any;
}

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

        const normalizedEmail = payload.email.toLowerCase().trim();

        let user = await FirestoreService.findFirst<User>('users', 'email', '==', normalizedEmail);

        if (!user) {
            // Create a default faculty user or restrict if necessary in production
            user = await FirestoreService.createDoc<User>('users', {
                email: normalizedEmail,
                name: payload.name || normalizedEmail.split('@')[0],
                googleId: payload.uid, // the user's firebase UID
                role: 'FACULTY',
                googleAccessToken: googleAccessToken || null,
                googleRefreshToken: googleRefreshToken || null,
            });
        } else {
            // Update the user's google ID and access token
            user = await FirestoreService.updateDoc<User>('users', user.id, {
                googleId: payload.uid,
                googleAccessToken: googleAccessToken || user.googleAccessToken || null,
                ...(googleRefreshToken ? { googleRefreshToken } : {}) // Only update if new one is provided
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
