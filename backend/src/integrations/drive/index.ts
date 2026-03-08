import { google, drive_v3, docs_v1 } from 'googleapis';
import { getGoogleOAuthClient } from '../google/oauth';

export class DriveIntegration {
    /**
     * Lists files from Google Drive
     */
    static async listFiles(userEmail: string, pageSize: number = 50): Promise<drive_v3.Schema$File[]> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const drive = google.drive({ version: 'v3', auth });

            const response = await drive.files.list({
                pageSize,
                fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink, modifiedTime)',
                orderBy: 'modifiedTime desc'
            });

            return response.data.files || [];
        } catch (error) {
            console.error('Error listing files from Google Drive:', error);
            throw error;
        }
    }

    /**
     * Creates a new empty Google Doc
     */
    static async createDoc(userEmail: string, title: string): Promise<docs_v1.Schema$Document> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const docs = google.docs({ version: 'v1', auth });

            const response = await docs.documents.create({
                requestBody: {
                    title
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error creating Google Doc:', error);
            throw error;
        }
    }

    /**
     * Uploads a file buffer directly to Google Drive
     */
    static async uploadFile(
        userEmail: string,
        filename: string,
        mimeType: string,
        fileBuffer: Buffer
    ): Promise<drive_v3.Schema$File> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const drive = google.drive({ version: 'v3', auth });

            // Using stream to upload the buffer
            const stream = require('stream');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileBuffer);

            const response = await drive.files.create({
                requestBody: {
                    name: filename,
                },
                media: {
                    mimeType: mimeType,
                    body: bufferStream,
                },
                fields: 'id, name, webViewLink, webContentLink',
            });

            return response.data;
        } catch (error) {
            console.error('Error uploading file to Google Drive:', error);
            throw error;
        }
    }

    /**
     * Shares a Google Drive file with specific email addresses
     */
    static async shareFile(userEmail: string, fileId: string, emailAddresses: string[], role: 'reader' | 'writer' = 'reader') {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const drive = google.drive({ version: 'v3', auth });

            const permissions = emailAddresses.map(async (email) => {
                await drive.permissions.create({
                    fileId,
                    requestBody: {
                        type: 'user',
                        role,
                        emailAddress: email
                    }
                });
            });

            await Promise.all(permissions);
        } catch (error) {
            console.error('Error sharing Google Drive file:', error);
            throw error;
        }
    }
}
