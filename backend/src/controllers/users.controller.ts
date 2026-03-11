import { Request, Response } from 'express';
import { FirestoreService } from '../services/FirestoreService';

/**
 * GET /api/users/profile/:email
 */
export const getFacultyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.params;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await FirestoreService.findFirst('users', 'email', '==', normalizedEmail);

        if (!user) {
            res.status(404).json({ success: false, message: `No user found with email: ${email}` });
            return;
        }

        // All tasks where this person is a responsible party
        const responsibles = await FirestoreService.query('taskResponsibles', [{ field: 'email', operator: '==', value: normalizedEmail }]);

        const tasks = await Promise.all(responsibles.map(async (tr: any) => {
            const task = await FirestoreService.getDoc<any>('tasks', tr.taskId);
            if (!task) return null;

            const workflow = task.workflowId ? await FirestoreService.getDoc<any>('workflows', task.workflowId) : null;
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
                sprintName: workflow?.sprintName || null,
                subEvent: workflow?.type || null,
                myRole: tr.role,
                responsibleTeam: task.description,
                colleagues,
            };
        }));

        const validTasks = tasks.filter(t => t !== null);

        // Stats
        const completed = validTasks.filter((t: any) => t.status === 'COMPLETED').length;
        const inProgress = validTasks.filter((t: any) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
        const pending = validTasks.filter((t: any) => t.status === 'PENDING').length;

        // Group by sprint
        const bySprint: Record<string, any[]> = {};
        for (const t of validTasks) {
            const key = t.sprintName || 'Unassigned Sprint';
            if (!bySprint[key]) bySprint[key] = [];
            bySprint[key].push(t);
        }

        res.json({
            success: true,
            profile: {
                user,
                stats: { total: validTasks.length, completed, inProgress, pending },
                tasksBySprint: bySprint,
                allTasks: validTasks,
            }
        });
    } catch (error: any) {
        console.error('Error fetching faculty profile:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/users/profile
 */
export const updateFacultyProfile = async (req: any, res: Response): Promise<void> => {
    try {
        const { name, photoUrl, theme, bio, department } = req.body;
        const userEmail = req.user?.email;

        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const user = await FirestoreService.findFirst('users', 'email', '==', userEmail.toLowerCase());
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        const updatedUser = await FirestoreService.updateDoc('users', user.id, {
            ...(name && { name }),
            ...(photoUrl && { photoUrl }),
            ...(theme && { theme }),
            ...(bio && { bio }),
            ...(department && { department }),
        });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    } catch (error: any) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/users
 */
export const getAllFacultyStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = (req as any).user;
        if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'HOD') {
            res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
            return;
        }

        const facultyList = await FirestoreService.query('users', [{ field: 'role', operator: '==', value: 'FACULTY' }]);

        const statsMap = await Promise.all(facultyList.map(async (faculty: any) => {
            const assignedTasks = await FirestoreService.query('tasks', [{ field: 'assignedToId', operator: '==', value: faculty.id }]);
            const respEntries = await FirestoreService.query('taskResponsibles', [{ field: 'email', operator: '==', value: faculty.email?.toLowerCase() }]);
            const responsibleTasks = await Promise.all(respEntries.map(tr => FirestoreService.getDoc('tasks', tr.taskId)));
            
            // De-duplicate
            const map = new Map();
            [...assignedTasks, ...responsibleTasks].forEach(t => t && map.set(t.id, t));
            const userTasks = Array.from(map.values());

            return {
                id: faculty.id,
                email: faculty.email,
                name: faculty.name,
                photoUrl: faculty.photoUrl,
                department: faculty.department,
                stats: {
                    total: userTasks.length,
                    completed: userTasks.filter(t => t.status === 'COMPLETED').length,
                    pending: userTasks.filter(t => t.status === 'PENDING').length,
                    inProgress: userTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length,
                    overdue: userTasks.filter(t => t.status === 'OVERDUE').length
                }
            };
        }));

        res.json({ success: true, data: statsMap });
    } catch (error: any) {
        console.error('Error fetching all faculty stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
