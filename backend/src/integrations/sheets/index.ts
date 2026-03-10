import { google, sheets_v4 } from 'googleapis';
import { getGoogleOAuthClient } from '../google/oauth';

export class SheetsIntegration {
    /**
     * Creates a new Google Sheet
     */
    static async createSheet(userEmail: string, title: string): Promise<sheets_v4.Schema$Spreadsheet> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const sheets = google.sheets({ version: 'v4', auth });

            const response = await sheets.spreadsheets.create({
                requestBody: {
                    properties: {
                        title
                    }
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error creating Google Sheet:', error);
            throw error;
        }
    }

    /**
     * Append rows to a specific Google Sheet
     */
    static async appendRows(
        userEmail: string,
        spreadsheetId: string,
        range: string,
        values: any[][]
    ): Promise<sheets_v4.Schema$AppendValuesResponse> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const sheets = google.sheets({ version: 'v4', auth });

            const response = await sheets.spreadsheets.values.append({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error appending rows to Google Sheet:', error);
            throw error;
        }
    }

    /**
     * Lists Google Sheets from Drive
     */
    static async listSheets(userEmail: string, pageSize: number = 20): Promise<any[]> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const drive = google.drive({ version: 'v3', auth });

            const response = await drive.files.list({
                pageSize,
                q: "mimeType='application/vnd.google-apps.spreadsheet'",
                fields: 'files(id, name, modifiedTime, owners)',
                orderBy: 'modifiedTime desc'
            });

            return response.data.files || [];
        } catch (error) {
            console.error('Error listing Google Sheets:', error);
            throw error;
        }
    }

    /**
     * Get data from a specific Google Sheet
     */
    static async getSheetData(userEmail: string, spreadsheetId: string, range: string): Promise<any[][]> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const sheets = google.sheets({ version: 'v4', auth });

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range
            });

            return response.data.values || [];
        } catch (error) {
            console.error('Error getting sheet data:', error);
            throw error;
        }
    }
}
