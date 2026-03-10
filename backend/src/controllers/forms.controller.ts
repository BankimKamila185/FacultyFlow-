import { Request, Response } from 'express';
import { FormsIntegration } from '../integrations/google/forms';
import { DriveIntegration } from '../integrations/drive';

export class FormsController {
    static async listForms(req: Request, res: Response) {
        try {
            const userEmail = (req as any).user?.email;
            if (!userEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const files = await DriveIntegration.listFiles(userEmail, 50);
            const forms = files
                .filter(f => f.mimeType === 'application/vnd.google-apps.form')
                .map(f => ({
                    id: f.id,
                    title: f.name,
                    modified: f.modifiedTime,
                    owner: 'Me',
                    status: 'Active' // We don't have a simple way to check "Active" via Drive API
                }));

            res.json({ success: true, data: forms });
        } catch (error: any) {
            console.error('Failed to list forms:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async createForm(req: Request, res: Response) {
        try {
            const userEmail = (req as any).user?.email;
            const { title } = req.body;
            if (!userEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });
            if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

            const form = await FormsIntegration.createForm(userEmail, title);
            res.json({ success: true, data: form });
        } catch (error: any) {
            console.error('Failed to create form:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
