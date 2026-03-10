import { Request, Response } from 'express';
import { prisma } from '../models/prisma';

/**
 * GET /api/tasks/my
 * Returns tasks where the logged-in user's email appears in any Responsible Person slot.
 * Each task includes sprint name, sub event (workflow type), colleagues, and the user's role.
 */
export const getMyTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        // Find all TaskResponsible rows for this email
        const myResponsibles = await prisma.taskResponsible.findMany({
            where: { email: userEmail.toLowerCase() },
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

        const tasks = myResponsibles.map((tr: any) => {
            const task = tr.task;
            const colleagues = task.responsibles
                .filter((r: any) => r.email !== userEmail.toLowerCase())
                .map((r: any) => ({ email: r.email, role: r.role }));

            return {
                id: task.id,
                title: task.title,
                status: task.status,
                deadline: task.deadline,
                startDate: task.startDate,
                description: task.description,
                sprintName: task.workflow?.sprintName || null,
                subEvent: task.workflow?.type || null,
                myRole: tr.role,
                responsibleTeam: task.description,
                remarks: task.remarks || 'noo remark',
                colleagues,
                workflowId: task.workflowId,
            };
        }).sort((a: any, b: any) => {
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });

        res.json({ success: true, data: tasks });
    } catch (error: any) {
        console.error('Error fetching my tasks:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/tasks
 * Returns all tasks (admin view).
 */
export const getAllTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const isFaculty = user?.role?.toUpperCase() === 'FACULTY';
        const whereClause = isFaculty ? {
            OR: [
                { assignedToId: user.id },
                { responsibles: { some: { email: user.email?.toLowerCase() } } }
            ]
        } : {};

        const tasks = await prisma.task.findMany({
            where: whereClause,
            include: {
                workflow: true,
                assignedTo: { select: { email: true, name: true } },
                responsibles: true,
            },
            orderBy: { startDate: 'asc' }
        });

        const formatted = tasks.map((task: any) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            deadline: task.deadline,
            startDate: task.startDate,
            description: task.description,
            sprintName: task.workflow?.sprintName || null,
            subEvent: task.workflow?.type || null,
            assignedTo: task.assignedTo,
            responsibles: task.responsibles,
            remarks: task.remarks || 'noo remark',
            workflowId: task.workflowId,
        }));

        res.json({ success: true, data: formatted });
    } catch (error: any) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/tasks/:id/status
 * Updates the status of a specific task.
 */
export const updateTaskStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'OVERDUE'];
        if (!status || !validStatuses.includes(status)) {
            res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
            return;
        }

        // Check prerequisites if completing
        if (status === 'COMPLETED') {
            const currentTask = await prisma.task.findUnique({
                where: { id },
                include: { prerequisiteTask: true }
            } as any);

            const pre = (currentTask as any)?.prerequisiteTask;
            if ((currentTask as any)?.prerequisiteTaskId && pre && pre.status !== 'COMPLETED') {
                res.status(400).json({ 
                    success: false, 
                    message: `Cannot complete task. Prerequisite task "${pre.title}" is not completed.` 
                });
                return;
            }
        }

        const task = await prisma.task.update({
            where: { id },
            data: { status }
        });

        // Trigger Google Sheets write-back if we had a dedicated job, but for now just update DB
        // The SheetsController could be invoked here as well if needed.

        res.json({ success: true, data: task, message: 'Task status updated successfully' });
    } catch (error: any) {
        console.error('Error updating task status:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
