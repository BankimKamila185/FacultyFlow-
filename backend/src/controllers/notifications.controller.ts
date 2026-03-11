import { Request, Response } from 'express';
import { FirestoreService } from '../services/FirestoreService';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

        const user = await FirestoreService.findFirst('users', 'email', '==', userEmail.toLowerCase());
        if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

        const notifications = await FirestoreService.query('notifications', [{ field: 'userId', operator: '==', value: user.id }]);
        
        const sorted = notifications.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
            return dateB - dateA;
        }).slice(0, 20);

        res.status(200).json({ success: true, data: sorted });
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await FirestoreService.updateDoc('notifications', id, { isRead: true });
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

        const user = await FirestoreService.findFirst('users', 'email', '==', userEmail.toLowerCase());
        if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

        const unread = await FirestoreService.query('notifications', [
            { field: 'userId', operator: '==', value: user.id },
            { field: 'isRead', operator: '==', value: false }
        ]);

        await Promise.all(unread.map(n => FirestoreService.updateDoc('notifications', n.id, { isRead: true })));

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
