import { prisma } from '../models/prisma';

export class AnalyticsService {
    static async getDashboardMetrics(filter?: { userId?: string, email?: string }) {
        const whereClause = filter?.userId ? {
            OR: [
                { assignedToId: filter.userId },
                { responsibles: { some: { email: filter.email?.toLowerCase() } } }
            ]
        } : {};

        const [pendingTasks, inProgressTasks, inReviewTasks, completedTasks, overdueTasks] = await Promise.all([
            prisma.task.count({ where: { ...whereClause, status: 'PENDING' } }),
            prisma.task.count({ where: { ...whereClause, status: 'IN_PROGRESS' } }),
            prisma.task.count({ where: { ...whereClause, status: 'IN_REVIEW' } }),
            prisma.task.count({ where: { ...whereClause, status: 'COMPLETED' } }),
            prisma.task.count({ where: { ...whereClause, status: 'OVERDUE' } }),
        ]);

        const activeWorkflows = await prisma.workflow.count({ where: { status: 'ACTIVE' } });

        return {
            tasks: {
                pending: pendingTasks,
                inProgress: inProgressTasks,
                inReview: inReviewTasks,
                completed: completedTasks,
                overdue: overdueTasks,
            },
            workflows: {
                active: activeWorkflows,
            }
        };
    }

    static async getFacultyProductivity(filter?: { userId?: string }) {
        const whereClause = filter?.userId ? { id: filter.userId } : { role: 'FACULTY' };
        return prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                _count: {
                    select: {
                        tasksAssigned: true,
                    }
                },
                tasksAssigned: {
                    where: { status: { not: 'COMPLETED' } },
                    select: { id: true }
                }
            }
        }).then(users => users.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            totalTasks: user._count.tasksAssigned,
            activeTasks: user.tasksAssigned.length,
            completionRate: user._count.tasksAssigned > 0 
                ? Math.round(((user._count.tasksAssigned - user.tasksAssigned.length) / user._count.tasksAssigned) * 100) 
                : 0
        })));
    }

    static async getTaskTrends(filter?: { userId?: string, email?: string }) {
        const whereClause = filter?.userId ? {
            OR: [
                { assignedToId: filter.userId },
                { responsibles: { some: { email: filter.email?.toLowerCase() } } }
            ]
        } : {};

        const tasks = await prisma.task.findMany({
            where: whereClause,
            select: { status: true, createdAt: true }
        });

        const trends: Record<string, Record<string, number>> = {};
        for (const task of tasks) {
            const month = task.createdAt.toISOString().substring(0, 7); // YYYY-MM
            if (!trends[month]) trends[month] = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 };
            trends[month][task.status] = (trends[month][task.status] || 0) + 1;
        }

        return trends;
    }

    static async getDeadlineCompliance(filter?: { userId?: string, email?: string }) {
        const whereClause = filter?.userId ? {
            OR: [
                { assignedToId: filter.userId },
                { responsibles: { some: { email: filter.email?.toLowerCase() } } }
            ]
        } : {};

        const completedTasks = await prisma.task.findMany({
            where: { ...whereClause, status: 'COMPLETED', deadline: { not: null } },
            select: { deadline: true, updatedAt: true }
        });

        let onTime = 0;
        let late = 0;

        for (const task of completedTasks) {
            if (task.deadline && task.updatedAt <= task.deadline) {
                onTime++;
            } else {
                late++;
            }
        }

        const total = onTime + late;
        return {
            onTime,
            late,
            complianceRate: total > 0 ? (onTime / total) * 100 : 0
        };
    }

    static async getWorkflowBreakdown(filter?: { userId?: string, email?: string }) {
        const whereClause = filter?.userId ? {
            OR: [
                { assignedToId: filter.userId },
                { responsibles: { some: { email: filter.email?.toLowerCase() } } }
            ]
        } : {};

        const workflows = await prisma.workflow.findMany({
            include: {
                tasks: {
                    where: whereClause,
                    select: { id: true }
                },
                _count: {
                    select: { tasks: true }
                }
            }
        });

        return workflows.map(wf => ({
            id: wf.id,
            type: wf.type,
            sprintName: wf.sprintName,
            status: wf.status,
            taskCount: filter?.userId ? (wf as any).tasks.length : wf._count.tasks
        }));
    }
}
