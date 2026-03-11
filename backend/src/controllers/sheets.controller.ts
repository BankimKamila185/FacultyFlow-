import { Request, Response } from 'express';
import { SheetsIntegration } from '../integrations/sheets';

export class SheetsController {
    static async listSheets(req: Request, res: Response) {
        try {
            const userEmail = (req as any).user?.email;
            if (!userEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const sheets = await SheetsIntegration.listSheets(userEmail);
            res.json({ success: true, data: sheets });
        } catch (error: any) {
            console.error('Failed to list sheets:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async createSheet(req: Request, res: Response) {
        try {
            const userEmail = (req as any).user?.email;
            const { title } = req.body;
            if (!userEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });
            if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

            const sheet = await SheetsIntegration.createSheet(userEmail, title);
            res.json({ success: true, data: sheet });
        } catch (error: any) {
            console.error('Failed to create sheet:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getSheetData(req: Request, res: Response) {
        try {
            const userEmail = (req as any).user?.email;
            const { spreadsheetId } = req.params;
            const { range = 'A1:Z100' } = req.query;

            if (!userEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });
            if (!spreadsheetId) return res.status(400).json({ success: false, message: 'spreadsheetId is required' });

            const values = await SheetsIntegration.getSheetData(userEmail, spreadsheetId, range as string);
            res.json({ success: true, data: values });
        } catch (error: any) {
            console.error('Failed to get sheet data:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

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
