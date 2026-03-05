import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';

export const googleClient = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URL
);

export async function verifyGoogleToken(idToken: string) {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: config.GOOGLE_CLIENT_ID,
        });
        return ticket.getPayload();
    } catch (error) {
        throw new Error('Invalid Google ID token');
    }
}
