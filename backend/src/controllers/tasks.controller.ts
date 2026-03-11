import { Request, Response } from 'express';
import { FirestoreService } from '../services/FirestoreService';
import { Task } from '../services/TaskService';

/**
 * GET /api/tasks/my
 * Returns tasks where the logged-in user's email appears in any Responsible Person slot.
 */
export const getMyTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        let userEmail = user?.email;
        
        const requestedEmail = req.query.email as string;
        if (requestedEmail && (user?.role === 'ADMIN' || user?.role === 'HOD')) {
            userEmail = requestedEmail;
        }

        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        const normalizedEmail = userEmail.toLowerCase().trim();

        // 1. Fetch all tasks where this user is responsible
        // Since we don't have a direct 'responsibles' collection anymore, 
        // we'll assume a 'taskResponsibles' collection or search within 'tasks'.
        // Let's assume 'taskResponsibles' collection for consistency with old Prisma structure.
        const myResponsibles = await FirestoreService.query('taskResponsibles', [{ field: 'email', operator: '==', value: normalizedEmail }]);

        const tasks = await Promise.all(myResponsibles.map(async (tr: any) => {
            const task = await FirestoreService.getDoc<Task>('tasks', tr.taskId);
            if (!task) return null;

            const workflow = task.workflowId ? await FirestoreService.getDoc('workflows', task.workflowId) : null;
            const allResponsibles = await FirestoreService.query('taskResponsibles', [{ field: 'taskId', operator: '==', value: task.id }]);

            const colleagues = allResponsibles
                .filter((r: any) => r.email !== normalizedEmail)
                .map((r: any) => ({ email: r.email, role: r.role }));

            return {
                id: task.id,
                title: task.title,
                status: task.status,
                deadline: task.deadline,
                startDate: task.startDate,
                description: task.description,
                sprintName: workflow?.sprintName || null,
                subEvent: workflow?.type || null,
                myRole: tr.role,
                responsibleTeam: task.description,
                remarks: task.remarks || 'no remark',
                colleagues,
                workflowId: task.workflowId,
            };
        }));

        const filteredTasks = tasks.filter(t => t !== null).sort((a: any, b: any) => {
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            const timeA = a.startDate.toDate ? a.startDate.toDate().getTime() : new Date(a.startDate).getTime();
            const timeB = b.startDate.toDate ? b.startDate.toDate().getTime() : new Date(b.startDate).getTime();
            return timeA - timeB;
        });

        res.json({ success: true, data: filteredTasks });
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
        
        const requestedEmail = req.query.email as string;
        let tasks: any[] = [];
        
        if (requestedEmail && (user?.role === 'ADMIN' || user?.role === 'HOD')) {
            const myResponsibles = await FirestoreService.query('taskResponsibles', [{ field: 'email', operator: '==', value: requestedEmail.toLowerCase() }]);
            tasks = await Promise.all(myResponsibles.map(tr => FirestoreService.getDoc('tasks', tr.taskId)));
        } else if (isFaculty) {
            // Find assigned or responsible
            const assigned = await FirestoreService.query('tasks', [{ field: 'assignedToId', operator: '==', value: user.id }]);
            const respEntries = await FirestoreService.query('taskResponsibles', [{ field: 'email', operator: '==', value: user.email?.toLowerCase() }]);
            const responsible = await Promise.all(respEntries.map(tr => FirestoreService.getDoc('tasks', tr.taskId)));
            
            // Merge and de-duplicate
            const map = new Map();
            [...assigned, ...responsible].forEach(t => t && map.set(t.id, t));
            tasks = Array.from(map.values());
        } else {
            tasks = await FirestoreService.getCollection('tasks');
        }

        const formatted = await Promise.all(tasks.filter(t => !!t).map(async (task: any) => {
            const workflow = task.workflowId ? await FirestoreService.getDoc('workflows', task.workflowId) : null;
            const assignedTo = task.assignedToId ? await FirestoreService.getDoc('users', task.assignedToId) : null;
            const responsibles = await FirestoreService.query('taskResponsibles', [{ field: 'taskId', operator: '==', value: task.id }]);

            return {
                id: task.id,
                title: task.title,
                status: task.status,
                deadline: task.deadline,
                startDate: task.startDate,
                description: task.description,
                priority: task.priority,
                sprintName: workflow?.sprintName || null,
                subEvent: workflow?.type || null,
                assignedTo: assignedTo ? { email: assignedTo.email, name: assignedTo.name } : null,
                responsibles,
                remarks: task.remarks || 'no remark',
                workflowId: task.workflowId,
            };
        }));

        res.json({ success: true, data: formatted });
    } catch (error: any) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/tasks/:id/status
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

        const currentTask = await FirestoreService.getDoc<any>('tasks', id);
        if (!currentTask) {
             res.status(404).json({ success: false, message: 'Task not found' });
             return;
        }

        if (status === 'COMPLETED' && currentTask.prerequisiteTaskId) {
            const pre = await FirestoreService.getDoc<any>('tasks', currentTask.prerequisiteTaskId);
            if (pre && pre.status !== 'COMPLETED') {
                res.status(400).json({ 
                    success: false, 
                    message: `Cannot complete task. Prerequisite task "${pre.title}" is not completed.` 
                });
                return;
            }
        }

        const updatedTask = await FirestoreService.updateDoc<any>('tasks', id, { 
            status,
            ...(req.body.priority && { priority: req.body.priority })
        });

        if (status === 'COMPLETED') {
            const currentUserId = (req as any).user?.id;
            if (updatedTask.createdById && updatedTask.createdById !== currentUserId) {
                await FirestoreService.createDoc('notifications', {
                    userId: updatedTask.createdById,
                    type: 'TASK_COMPLETED',
                    message: `Task "${updatedTask.title}" was completed.`
                });
            }
        }

        res.json({ success: true, data: updatedTask, message: 'Task status updated successfully' });
    } catch (error: any) {
        console.error('Error updating task status:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/tasks/:id/ask-reason
 */
export const askReason = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = (req as any).user;
        if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'HOD') {
            res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
            return;
        }

        const { id } = req.params;
        const task = await FirestoreService.getDoc<any>('tasks', id);

        if (!task) {
            res.status(404).json({ success: false, message: 'Task not found' });
            return;
        }

        await FirestoreService.createDoc('notifications', {
            userId: task.assignedToId,
            type: 'REASON_REQUEST',
            message: `Admin requested a reason for the delay on task: "${task.title}". Please add a remark.`
        });

        res.json({ success: true, message: 'Reason request sent successfully' });
    } catch (error: any) {
        console.error('Error asking for reason:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const batchAskReason = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = (req as any).user;
        if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'HOD') {
            res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
            return;
        }

        const overdueTasks = await FirestoreService.query('tasks', [{ field: 'status', operator: '==', value: 'OVERDUE' }]);

        if (overdueTasks.length === 0) {
            res.json({ success: true, message: 'No overdue tasks to nudge.' });
            return;
        }

        await Promise.all(overdueTasks.map(task => 
            FirestoreService.createDoc('notifications', {
                userId: task.assignedToId,
                type: 'REASON_REQUEST',
                message: `Admin requested a reason for the delay on task: "${task.title}". Please add a remark.`
            })
        ));

        res.json({ success: true, message: `Successfully nudged ${overdueTasks.length} tasks.` });
    } catch (error: any) {
        console.error('Error in batch nudge:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
