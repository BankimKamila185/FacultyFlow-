import { Request, Response } from 'express';
import { SheetsIntegration } from '../integrations/sheets';
import { prisma } from '../models/prisma';

export class SheetsController {
    static async writeBackTaskStatus(req: Request, res: Response) {
        try {
            const userEmail = (req as any).user?.email;
            const { spreadsheetId, range, status, taskTitle } = req.body;

            if (!spreadsheetId || !range || !status) {
                return res.status(400).json({ success: false, message: 'spreadsheetId, range, and status are required' });
            }

            const values = [[taskTitle, status, new Date().toISOString()]];

            await SheetsIntegration.appendRows(userEmail, spreadsheetId, range, values);

            res.json({ success: true, message: 'Data written back to Google Sheets' });
        } catch (error: any) {
            console.error('Failed to write back to sheets:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
