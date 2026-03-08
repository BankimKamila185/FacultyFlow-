import { google, gmail_v1 } from 'googleapis';
import { getGoogleOAuthClient } from '../google/oauth';

export class GmailIntegration {
    /**
     * Sends an email on behalf of the user
     */
    static async sendEmail(
        userEmail: string,
        to: string,
        subject: string,
        bodyText: string
    ): Promise<gmail_v1.Schema$Message> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const gmail = google.gmail({ version: 'v1', auth });

            // Construct the raw email format required by Gmail API
            const emailLines = [
                `To: ${to}`,
                'Content-type: text/plain;charset=iso-8859-1',
                'MIME-Version: 1.0',
                `Subject: ${subject}`,
                '',
                bodyText
            ];
            const email = emailLines.join('\r\n').trim();

            const encodedEmail = Buffer.from(email)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedEmail
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error sending email via Gmail:', error);
            throw error;
        }
    }
}
