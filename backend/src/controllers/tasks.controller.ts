import { Request, Response } from 'express';
import { FirestoreService } from '../services/FirestoreService';
import { Task, TaskService } from '../services/TaskService';

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

        // OPTIMIZED: batch-fetch tasks, workflows, responsibles — no N+1 loops
        const taskIds = [...new Set(myResponsibles.map((tr: any) => tr.taskId as string))];

        if (taskIds.length === 0) {
            res.json({ success: true, data: [] });
            return;
        }

        // Fetch all tasks in parallel
        const rawTasks = await Promise.all(taskIds.map(id => FirestoreService.getDoc<Task>('tasks', id)));
        const validTasks = rawTasks.filter(Boolean) as Task[];

        // Collect unique workflow IDs and fetch them in parallel
        const workflowIds = [...new Set(validTasks.map(t => t.workflowId).filter(Boolean) as string[])];
        const workflowDocs = await Promise.all(workflowIds.map(id => FirestoreService.getDoc('workflows', id)));
        const workflowMap = new Map(workflowDocs.filter(Boolean).map((w: any) => [w.id, w]));

        // Fetch all responsibles for these tasks in batches of 10 (Firestore 'in' limit)
        const respResults: any[] = [];
        for (let i = 0; i < taskIds.length; i += 10) {
            const chunk = taskIds.slice(i, i + 10);
            const rows = await FirestoreService.query('taskResponsibles', [
                { field: 'taskId', operator: 'in', value: chunk },
            ]);
            respResults.push(...rows);
        }
        const respByTask = respResults.reduce((acc: Record<string, any[]>, r: any) => {
            if (!acc[r.taskId]) acc[r.taskId] = [];
            acc[r.taskId].push(r);
            return acc;
        }, {});

        const trMap = new Map(myResponsibles.map((tr: any) => [tr.taskId, tr]));

        const tasks = validTasks.map(task => {
            const workflow = workflowMap.get(task.workflowId || '');
            const colleagues = (respByTask[task.id] || [])
                .filter((r: any) => r.email !== normalizedEmail)
                .map((r: any) => ({ email: r.email, role: r.role }));
            return {
                id: task.id,
                title: task.title,
                status: task.status,
                deadline: task.deadline,
                startDate: task.startDate,
                description: task.description,
                sprintName: (workflow as any)?.sprintName || null,
                subEvent: (workflow as any)?.type || null,
                myRole: trMap.get(task.id)?.role,
                responsibleTeam: task.description,
                remarks: (task as any).remarks || 'no remark',
                colleagues,
                workflowId: task.workflowId,
            };
        });

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
 * GET /api/tasks/:id/quick-action
 * Allows completing a task directly from an email link without needing to log in.
 */
export const quickAction = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { action } = req.query;

        if (action === 'complete') {
            await FirestoreService.updateDoc('tasks', id, {
                status: 'COMPLETED',
                updatedAt: new Date()
            });

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.redirect(`${frontendUrl}/tasks?success=Task+marked+as+completed!`);
            return;
        }

        res.status(400).send('Invalid quick action');
    } catch (error: any) {
        console.error('Error in quickAction:', error);
        res.status(500).send('An error occurred while processing your request.');
    }
};

/**
 * POST /api/tasks/:id/ask-reason
 */
export const askReason = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = (req as any).user;
        if (currentUser?.role?.toUpperCase() !== 'OPS_MANAGER') {
            res.status(403).json({ success: false, message: 'Forbidden: Ops Manager access required.' });
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

        const assignedUser = await FirestoreService.getDoc<any>('users', task.assignedToId);
        if (assignedUser?.email) {
            import('../services/MailService').then((MailService) => {
                MailService.sendNudgeEmail({
                    toEmail: assignedUser.email,
                    toName: assignedUser.name || 'User',
                    taskTitle: task.title,
                    fromName: currentUser?.name || 'Admin/Ops Team'
                }).catch(err => console.error('Failed to send nudge email in background', err));
            });
        }

        res.json({ success: true, message: 'Reason request and email sent successfully' });
    } catch (error: any) {
        console.error('Error asking for reason:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const batchAskReason = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = (req as any).user;
        if (currentUser?.role?.toUpperCase() !== 'OPS_MANAGER') {
            res.status(403).json({ success: false, message: 'Forbidden: Ops Manager access required.' });
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

/**
 * POST /api/tasks
 */
export const createTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = (req as any).user;
        if (currentUser?.role?.toUpperCase() !== 'OPS_MANAGER') {
            res.status(403).json({ success: false, message: 'Forbidden: Ops Manager access required.' });
            return;
        }

        const { title, description, deadline, assignedToIds, workflowId } = req.body;

        if (!title || !assignedToIds || !Array.isArray(assignedToIds) || assignedToIds.length === 0) {
            res.status(400).json({ success: false, message: 'Title and at least one assignedToId are required.' });
            return;
        }

        const taskData = {
            title,
            description,
            deadline: deadline ? new Date(deadline) : undefined,
            assignedToIds,
            createdById: currentUser.id,
            workflowId
        };

        const task = await TaskService.createTask(taskData);

        res.status(201).json({ success: true, data: task, message: 'Task created successfully' });
    } catch (error: any) {
        console.error('Error creating task:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/tasks/:id
 */
export const updateTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = (req as any).user;
        const { id } = req.params;
        const updates = req.body;

        const currentTask = await FirestoreService.getDoc<Task>('tasks', id);
        if (!currentTask) {
            res.status(404).json({ success: false, message: 'Task not found' });
            return;
        }

        // Check if user is authorized (ONLY Ops Manager can update)
        const isOpsManager = currentUser?.role?.toUpperCase() === 'OPS_MANAGER';

        if (!isOpsManager) {
            res.status(403).json({ success: false, message: 'Forbidden: Ops Manager access required.' });
            return;
        }

        const updatedTask = await FirestoreService.updateDoc<Task>('tasks', id, {
            ...updates,
            ...(updates.deadline && { deadline: new Date(updates.deadline) }),
            updatedAt: new Date()
        });

        // Trigger notification if assignedToIds was changed
        if (updates.assignedToIds && Array.isArray(updates.assignedToIds)) {
            await TaskService.assignTask(id, updates.assignedToIds);
        }

        res.json({ success: true, data: updatedTask, message: 'Task updated successfully' });
    } catch (error: any) {
        console.error('Error updating task:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
