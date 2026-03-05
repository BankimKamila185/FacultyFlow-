import { prisma } from '../models/prisma';

export class AnalyticsService {
    static async getDashboardMetrics() {
        const [pendingTasks, inProgressTasks, completedTasks, overdueTasks] = await Promise.all([
            prisma.task.count({ where: { status: 'PENDING' } }),
            prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.task.count({ where: { status: 'COMPLETED' } }),
            prisma.task.count({ where: { status: 'OVERDUE' } }),
        ]);

        const activeWorkflows = await prisma.workflow.count({ where: { status: 'ACTIVE' } });

        return {
            tasks: {
                pending: pendingTasks,
                inProgress: inProgressTasks,
                completed: completedTasks,
                overdue: overdueTasks,
            },
            workflows: {
                active: activeWorkflows,
            }
        };
    }

    static async getFacultyProductivity() {
        return prisma.user.findMany({
            where: { role: 'FACULTY' },
            select: {
                id: true,
                name: true,
                _count: {
                    select: {
                        tasksAssigned: { where: { status: 'COMPLETED' } },
                    }
                }
            }
        });
    }
}
