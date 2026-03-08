import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const globalSearch = async (req: Request, res: Response): Promise<void> => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string' || q.trim() === '') {
            res.json({ success: true, data: { tasks: [], users: [], workflows: [] } });
            return;
        }

        const query = q.trim();

        // Perform parallel searches
        const [tasks, users, workflows] = await Promise.all([
            prisma.task.findMany({
                where: {
                    OR: [
                        { title: { contains: query, mode: 'insensitive' } },
                        { description: { contains: query, mode: 'insensitive' } },
                    ]
                },
                take: 5
            }),
            prisma.user.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { email: { contains: query, mode: 'insensitive' } },
                    ]
                },
                take: 5,
                select: { id: true, name: true, email: true, role: true }
            }),
            prisma.workflow.findMany({
                where: {
                    OR: [
                        { type: { contains: query, mode: 'insensitive' } },
                        { sprintName: { contains: query, mode: 'insensitive' } },
                    ]
                },
                take: 5
            })
        ]);

        res.json({
            success: true,
            data: { tasks, users, workflows }
        });
    } catch (error: any) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
