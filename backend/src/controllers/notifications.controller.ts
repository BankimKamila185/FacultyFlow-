import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

        const user = await prisma.user.findUnique({ where: { email: userEmail } });
        if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

        const notifications = await prisma.notification.findMany({
            where: { userId: user.id },
            orderBy: {
                createdAt: 'desc'
            },
            take: 20
        });

        res.status(200).json({ success: true, data: notifications });
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

        const user = await prisma.user.findUnique({ where: { email: userEmail } });
        if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

        await prisma.notification.updateMany({
            where: { userId: user.id, isRead: false },
            data: { isRead: true }
        });
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
