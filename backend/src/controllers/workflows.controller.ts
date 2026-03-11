import { Request, Response } from 'express';
import { FirestoreService } from '../services/FirestoreService';

export const getWorkflowProgress = async (req: Request, res: Response): Promise<void> => {
    try {
        const workflows = await FirestoreService.getCollection('workflows');

        const progressData = await Promise.all(workflows.map(async (wf: any) => {
            const tasks = await FirestoreService.query('tasks', [{ field: 'workflowId', operator: '==', value: wf.id }]);
            
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED').length;

            let calculatedStatus = wf.status;
            if (totalTasks > 0) {
                if (completedTasks === totalTasks) {
                    calculatedStatus = 'COMPLETED';
                } else if (completedTasks > 0) {
                    calculatedStatus = 'IN_PROGRESS';
                } else {
                    calculatedStatus = 'PENDING';
                }
            } else {
                calculatedStatus = 'PENDING';
            }

            return {
                id: wf.id,
                title: wf.type,
                type: wf.type,
                status: calculatedStatus,
                totalTasks,
                completedTasks,
                percentage: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
            };
        }));

        res.status(200).json({ success: true, data: progressData });
    } catch (error: any) {
        console.error('Error fetching workflow progress:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
