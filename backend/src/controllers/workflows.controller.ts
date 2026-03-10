import { Request, Response } from 'express';
import { prisma } from '../models/prisma';

export const getWorkflowProgress = async (req: Request, res: Response): Promise<void> => {
    try {
        const workflows = await prisma.workflow.findMany({
            include: {
                tasks: {
                    select: {
                        id: true,
                        status: true
                    }
                }
            }
        });

        const progressData = workflows.map((wf: any) => {
            const totalTasks = wf.tasks.length;
            const completedTasks = wf.tasks.filter((t: any) => t.status === 'COMPLETED').length;

            let calculatedStatus = wf.status;
            if (totalTasks > 0) {
                if (completedTasks === totalTasks) {
                    calculatedStatus = 'COMPLETED';
                } else if (completedTasks > 0) {
                    calculatedStatus = 'IN_PROGRESS';
                } else {
                    calculatedStatus = 'PENDING'; // Map ACTIVE with 0 tasks to PENDING for frontend
                }
            } else {
                calculatedStatus = 'PENDING';
            }

            return {
                id: wf.id,
                title: wf.type, // Add title field for frontend
                type: wf.type,
                status: calculatedStatus,
                totalTasks,
                completedTasks,
                percentage: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
            };
        });

        res.status(200).json({ success: true, data: progressData });
    } catch (error: any) {
        console.error('Error fetching workflow progress:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
