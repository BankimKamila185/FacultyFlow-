import { Request, Response } from 'express';
import { DriveIntegration } from '../integrations/drive';

export const listFiles = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

        const files = await DriveIntegration.listFiles(userEmail, 50);
        res.json({ success: true, data: files });
    } catch (error: any) {
        console.error('List files error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createDoc = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

        const { title } = req.body;
        if (!title) { res.status(400).json({ success: false, message: 'Title is required' }); return; }

        const docId = await DriveIntegration.createDoc(userEmail, title);
        res.json({ success: true, docId, message: 'Document created successfully' });
    } catch (error: any) {
        console.error('Create doc error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

        const { fileName, mimeType, base64Content } = req.body;
        if (!fileName || !mimeType || !base64Content) {
            res.status(400).json({ success: false, message: 'fileName, mimeType, and base64Content are required' });
            return;
        }

        const buffer = Buffer.from(base64Content, 'base64');
        const fileId = await DriveIntegration.uploadFile(userEmail, fileName, mimeType, buffer);
        
        res.json({ success: true, fileId, message: 'File uploaded successfully' });
    } catch (error: any) {
        console.error('Upload file error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
