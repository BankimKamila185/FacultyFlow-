import { Request, Response } from 'express';
import { FirestoreService } from '../services/FirestoreService';

export const globalSearch = async (req: Request, res: Response): Promise<void> => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string' || q.trim() === '') {
            res.json({ success: true, data: { tasks: [], users: [], workflows: [] } });
            return;
        }

        const query = q.trim().toLowerCase();

        // Firestore doesn't support "contains" or "case-insensitive" search natively.
        // For this project scale, we'll fetch collections and filter in-memory.
        const [allTasks, allUsers, allWorkflows] = await Promise.all([
            FirestoreService.getCollection('tasks'),
            FirestoreService.getCollection('users'),
            FirestoreService.getCollection('workflows')
        ]);

        const tasks = allTasks.filter((t: any) => 
            (t.title && t.title.toLowerCase().includes(query)) || 
            (t.description && t.description.toLowerCase().includes(query))
        ).slice(0, 10);

        const users = allUsers.filter((u: any) => 
            (u.name && u.name.toLowerCase().includes(query)) || 
            (u.email && u.email.toLowerCase().includes(query))
        ).slice(0, 5).map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));

        const workflows = allWorkflows.filter((wf: any) => 
            (wf.type && wf.type.toLowerCase().includes(query)) || 
            (wf.sprintName && wf.sprintName.toLowerCase().includes(query))
        ).slice(0, 5);

        res.json({
            success: true,
            data: { tasks, users, workflows }
        });
    } catch (error: any) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
