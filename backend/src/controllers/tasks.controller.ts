import { Request, Response } from 'express';
import { prisma } from '../models/prisma';

/**
 * GET /api/tasks/my
 * Returns tasks where the logged-in user's email appears in any Responsible Person slot.
 * Each task includes sprint name, sub event (workflow type), colleagues, and the user's role.
 */
export const getMyTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        let userEmail = user?.email;
        
        // If an admin requests a specific email via query parameter, use that instead
        const requestedEmail = req.query.email as string;
        if (requestedEmail && (user?.role === 'ADMIN' || user?.role === 'HOD')) {
            userEmail = requestedEmail;
        }

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
        let isFaculty = user?.role?.toUpperCase() === 'FACULTY';
        
        // Admin View Override
        const requestedEmail = req.query.email as string;
        let whereClause: any = {};
        
        if (requestedEmail && (user?.role === 'ADMIN' || user?.role === 'HOD')) {
            // Force faculty view logic but for the requested email
            whereClause = {
                OR: [
                    { responsibles: { some: { email: requestedEmail.toLowerCase() } } }
                ]
            };
        } else if (isFaculty) {
            whereClause = {
                OR: [
                    { assignedToId: user.id },
                    { responsibles: { some: { email: user.email?.toLowerCase() } } }
                ]
            };
        }

        console.log(`[Tasks] getAllTasks for ${user?.email}. Role: ${user?.role}. isFaculty: ${isFaculty}. Query:`, JSON.stringify(whereClause));

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
            priority: task.priority,
            sprintName: task.workflow?.sprintName || null,
            subEvent: task.workflow?.type || null,
            assignedTo: task.assignedTo,
            responsibles: task.responsibles,
            remarks: task.remarks || 'no remark',
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
            data: { 
                ...(status && { status }),
                ...(req.body.priority && { priority: req.body.priority })
            },
            include: {
                assignedTo: true,
                createdBy: true
            }
        });

        if (status === 'COMPLETED') {
            const currentUserId = (req as any).user?.id;
            // Notify the creator if it was assigned to someone else
            if (task.createdById && task.createdById !== currentUserId && task.createdById !== task.assignedToId) {
                await prisma.notification.create({
                    data: {
                        userId: task.createdById,
                        type: 'TASK_COMPLETED',
                        message: `Task "${task.title}" was completed by ${task.assignedTo?.name || 'User'}`
                    }
                });
            } else if (task.assignedToId && task.assignedToId !== currentUserId && task.assignedToId !== task.createdById) {
                 // Or notify the assignee if they didn't complete it themselves
                 await prisma.notification.create({
                    data: {
                        userId: task.assignedToId,
                        type: 'TASK_COMPLETED',
                        message: `Task "${task.title}" has been marked as completed`
                    }
                });
            }
        }

        // Trigger Google Sheets write-back if we had a dedicated job, but for now just update DB
        // The SheetsController could be invoked here as well if needed.

        res.json({ success: true, data: task, message: 'Task status updated successfully' });
    } catch (error: any) {
        console.error('Error updating task status:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/tasks/:id/ask-reason
 * Allows an admin/HOD to request a reason for a delayed/overdue task.
 */
export const askReason = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = (req as any).user;
        if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'HOD') {
            res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
            return;
        }

        const { id } = req.params;
        const task = await prisma.task.findUnique({
            where: { id },
            include: { assignedTo: true }
        });

        if (!task) {
            res.status(404).json({ success: false, message: 'Task not found' });
            return;
        }

        // Create a notification for the assigned user
        await prisma.notification.create({
            data: {
                userId: task.assignedToId,
                type: 'REASON_REQUEST',
                message: `Admin requested a reason for the delay on task: "${task.title}". Please add a remark.`
            }
        });

        res.json({ success: true, message: 'Reason request sent successfully' });
    } catch (error: any) {
        console.error('Error asking for reason:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
/**
 * POST /api/tasks/nudge-all
 * Allows an admin/HOD to request reasons for ALL overdue tasks at once.
 */
export const batchAskReason = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = (req as any).user;
        if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'HOD') {
            res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
            return;
        }

        const overdueTasks = await prisma.task.findMany({
            where: { status: 'OVERDUE' },
            select: { id: true, title: true, assignedToId: true }
        });

        if (overdueTasks.length === 0) {
            res.json({ success: true, message: 'No overdue tasks to nudge.' });
            return;
        }

        // Create notifications for all assigned users of overdue tasks
        const notificationData = overdueTasks.map(task => ({
            userId: task.assignedToId,
            type: 'REASON_REQUEST',
            message: `Admin requested a reason for the delay on task: "${task.title}". Please add a remark.`
        }));

        await prisma.notification.createMany({
            data: notificationData
        });

        res.json({ success: true, message: `Successfully nudged ${overdueTasks.length} tasks.` });
    } catch (error: any) {
        console.error('Error in batch nudge:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
