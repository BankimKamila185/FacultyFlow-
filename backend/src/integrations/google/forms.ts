import { google, forms_v1 } from 'googleapis';
import { getGoogleOAuthClient } from '../google/oauth';

export class FormsIntegration {
    /**
     * Creates a new Google Form
     */
    static async createForm(userEmail: string, title: string): Promise<forms_v1.Schema$Form> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const forms = google.forms({ version: 'v1', auth });

            const response = await forms.forms.create({
                requestBody: {
                    info: {
                        title
                    }
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error creating Google Form:', error);
            throw error;
        }
    }
}
