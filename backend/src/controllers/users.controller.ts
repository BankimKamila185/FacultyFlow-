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

        // MOCK DATA FOR ADMIN WORK
        const mockFaculty = [
            { id: '1', name: 'Dr. Meet D.', email: 'meetd@itm.edu', department: 'Computer Science', stats: { total: 15, completed: 10, pending: 3, inProgress: 1, overdue: 1 } },
            { id: '2', name: 'Harshita D.', email: 'harshitad@itm.edu', department: 'IT', stats: { total: 12, completed: 8, pending: 2, inProgress: 2, overdue: 0 } },
            { id: '3', name: 'Jasmine T.', email: 'jasminet@itm.edu', department: 'Data Science', stats: { total: 20, completed: 15, pending: 4, inProgress: 1, overdue: 0 } },
            { id: '4', name: 'Aarti P.', email: 'aartip@itm.edu', department: 'Computer Science', stats: { total: 18, completed: 12, pending: 5, inProgress: 1, overdue: 0 } },
            { id: '5', name: 'Kalpana S.', email: 'kalpanas@itm.edu', department: 'IT', stats: { total: 25, completed: 20, pending: 3, inProgress: 2, overdue: 0 } }
        ];
        res.json({ success: true, data: mockFaculty });
        return;

        /*
        const facultyList = await FirestoreService.query('users', [{ field: 'role', operator: '==', value: 'FACULTY' }]);
        ...
        res.json({ success: true, data: statsMap });
        */
    } catch (error: any) {
        console.error('Error fetching all faculty stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// ─── RBAC additions ───────────────────────────────────────────────────────────
import { Role, ROLE_PERMISSIONS } from '../config/permissions';

const VALID_ROLES: Role[] = ['FACULTY', 'HOD', 'ADMIN'];

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id }   = req.params;
        const { role } = req.body;
        const requestingUser = (req as any).user;

        if (!role || !VALID_ROLES.includes(role as Role)) {
            res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
            return;
        }
        if (requestingUser?.id === id && role !== 'ADMIN') {
            res.status(400).json({ success: false, message: 'Admins cannot demote themselves' });
            return;
        }
        const targetUser = await FirestoreService.getDoc<any>('users', id);
        if (!targetUser) { res.status(404).json({ success: false, message: 'User not found' }); return; }

        await FirestoreService.updateDoc('users', id, { role });
        res.json({ success: true, message: `Role updated to ${role}`, data: { id, email: targetUser.email, previousRole: targetUser.role, newRole: role } });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyPermissions = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (!user) { res.status(401).json({ success: false, message: 'Not authenticated' }); return; }
        const role        = user.role as Role;
        const permissions = ROLE_PERMISSIONS[role] || [];
        res.json({ success: true, data: { role, permissions } });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
