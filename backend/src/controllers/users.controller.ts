import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/users/profile/:email
 * Public debug endpoint — returns full profile for a faculty by email.
 * Shows: user info, all assigned tasks with sprint/sub-event/colleagues.
 */
export const getFacultyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.params;

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, email: true, name: true, role: true, photoUrl: true, theme: true, bio: true, department: true, createdAt: true }
        });

        if (!user) {
            res.status(404).json({ success: false, message: `No user found with email: ${email}` });
            return;
        }

        // All tasks where this person is a responsible party
        const responsibles = await prisma.taskResponsible.findMany({
            where: { email: email.toLowerCase() },
            include: {
                task: {
                    include: {
                        workflow: true,
                        responsibles: true,
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        const tasks = responsibles.map((tr: any) => {
            const colleagues = tr.task.responsibles
                .filter((r: any) => r.email !== email.toLowerCase())
                .map((r: any) => ({ email: r.email, role: r.role }));

            return {
                id: tr.task.id,
                title: tr.task.title,
                status: tr.task.status,
                deadline: tr.task.deadline,
                startDate: tr.task.startDate,
                sprintName: tr.task.workflow?.sprintName || null,
                subEvent: tr.task.workflow?.type || null,
                myRole: tr.role,
                responsibleTeam: tr.task.description,
                colleagues,
            };
        });

        // Stats
        const completed = tasks.filter((t: any) => t.status === 'COMPLETED').length;
        const inProgress = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
        const pending = tasks.filter((t: any) => t.status === 'PENDING').length;

        // Group by sprint
        const bySprint: Record<string, any[]> = {};
        for (const t of tasks) {
            const key = t.sprintName || 'Unassigned Sprint';
            if (!bySprint[key]) bySprint[key] = [];
            bySprint[key].push(t);
        }

        res.json({
            success: true,
            profile: {
                user,
                stats: { total: tasks.length, completed, inProgress, pending },
                tasksBySprint: bySprint,
                allTasks: tasks,
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/users/profile
 * Authenticated — updates the current user's profile information.
 */
export const updateFacultyProfile = async (req: any, res: Response): Promise<void> => {
    try {
        const { name, photoUrl, theme, bio, department } = req.body;
        const userEmail = req.user?.email;

        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const updatedUser = await prisma.user.update({
            where: { email: userEmail.toLowerCase() },
            data: {
                ...(name && { name }),
                ...(photoUrl && { photoUrl }),
                ...(theme && { theme }),
                ...(bio && { bio }),
                ...(department && { department }),
            },
            select: { id: true, email: true, name: true, role: true, photoUrl: true, theme: true, bio: true, department: true } as any
        });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
