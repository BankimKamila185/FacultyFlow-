import { google } from 'googleapis';
import { prisma } from '../../models/prisma';
import path from 'path';

/**
 * Returns an OAuth2 client authenticated with the logged-in user's access token.
 * Requires the user to have completed Google sign-in and granted workspace permissions.
 */
export const getGoogleOAuthClient = async (userEmail: string) => {
    const user = await prisma.user.findUnique({
        where: { email: userEmail }
    });

    if (!user || !user.googleAccessToken) {
        throw new Error(`Google Access Token not found for user: ${userEmail}. Please ensure the user has logged in with Google and granted sufficient permissions.`);
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
        process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
        process.env.GOOGLE_REDIRECT_URL || 'http://localhost:4000/auth/google/callback'
    );
    
    oauth2Client.setCredentials({
        access_token: user.googleAccessToken,
        refresh_token: user.googleRefreshToken,
    });

    return oauth2Client;
};

/**
 * Returns a GoogleAuth client using the service account key file.
 * Used for server-to-server (admin) API calls that don't require a user session.
 *
 * Scopes: pass the required Google API scopes for the operation.
 */
export const getServiceAccountClient = async (scopes: string[]) => {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';

    // Resolve relative to backend root (process.cwd()) not __dirname
    const keyFile = path.isAbsolute(credPath)
        ? credPath
        : path.resolve(process.cwd(), credPath);

    const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes,
    });

    return auth;
};
