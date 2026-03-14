import { FirestoreService } from './FirestoreService';

export class AnalyticsService {
    static async getDashboardMetrics(filter?: { userId?: string, email?: string }) {
        const constraints: any[] = [];
        if (filter?.userId) {
            constraints.push({ field: 'assignedToId', operator: '==', value: filter.userId });
        } else if (filter?.email) {
            constraints.push({ field: 'responsibleEmail', operator: '==', value: filter.email.toLowerCase() });
        }

        try {
            const [
                pendingTasks, inProgressTasks, inReviewTasks, completedTasks, overdueTasks,
                globalTotal
            ] = await Promise.all([
                FirestoreService.count('tasks', [...constraints, { field: 'status', operator: '==', value: 'PENDING' }]),
                FirestoreService.count('tasks', [...constraints, { field: 'status', operator: '==', value: 'IN_PROGRESS' }]),
                FirestoreService.count('tasks', [...constraints, { field: 'status', operator: '==', value: 'IN_REVIEW' }]),
                FirestoreService.count('tasks', [...constraints, { field: 'status', operator: '==', value: 'COMPLETED' }]),
                FirestoreService.count('tasks', [...constraints, { field: 'status', operator: '==', value: 'OVERDUE' }]),
                FirestoreService.count('tasks', constraints),
            ]);

            const activeWorkflows = await FirestoreService.count('workflows', [{ field: 'status', operator: '==', value: 'ACTIVE' }]);

            return {
                tasks: {
                    total: globalTotal,
                    pending: pendingTasks,
                    inProgress: inProgressTasks,
                    inReview: inReviewTasks,
                    completed: completedTasks,
                    overdue: overdueTasks,
                    delayed: overdueTasks
                },
                workflows: {
                    active: activeWorkflows,
                }
            };
        } catch (error) {
            console.error('[AnalyticsService] Error fetching metrics:', error);
            // Return zeros as fallback to prevent dashboard crash
            return {
                tasks: { total: 0, pending: 0, inProgress: 0, inReview: 0, completed: 0, overdue: 0, delayed: 0 },
                workflows: { active: 0 }
            };
        }
    }

    static async getFacultyProductivity(filter?: { userId?: string }) {
        const userConstraints: any[] = [];
        if (filter?.userId) {
            userConstraints.push({ field: 'id', operator: '==', value: filter.userId });
        } else {
            userConstraints.push({ field: 'role', operator: '==', value: 'FACULTY' });
        }

        const users = await FirestoreService.query('users', userConstraints);

        return Promise.all(users.map(async (user: any) => {
            const totalTasks = await FirestoreService.count('tasks', [{ field: 'assignedToId', operator: '==', value: user.id } as any]);
            const allAssignedTasks = await FirestoreService.query('tasks', [{ field: 'assignedToId', operator: '==', value: user.id } as any]);
            const activeTasks = allAssignedTasks.filter(t => t.status !== 'COMPLETED').length;

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                totalTasks,
                activeTasks,
                completionRate: totalTasks > 0 
                    ? Math.round(((totalTasks - activeTasks) / totalTasks) * 100) 
                    : 0
            };
        }));
    }

    static async getTaskTrends(filter?: { userId?: string, email?: string }) {
        const constraints: any[] = [];
        if (filter?.userId) {
            constraints.push({ field: 'assignedToId', operator: '==', value: filter.userId });
        }

        const tasks = await FirestoreService.query('tasks', constraints);

        const trends: Record<string, Record<string, number>> = {};
        for (const task of tasks) {
            const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
            const month = createdAt.toISOString().substring(0, 7); // YYYY-MM
            if (!trends[month]) trends[month] = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 };
            trends[month][task.status] = (trends[month][task.status] || 0) + 1;
        }

        return trends;
    }

    static async getDeadlineCompliance(filter?: { userId?: string, email?: string }) {
        const tasks = await FirestoreService.query('tasks', [
            ...(filter?.userId ? [{ field: 'assignedToId', operator: '==', value: filter.userId } as any] : []),
            { field: 'status', operator: '==', value: 'COMPLETED' }
        ]);

        let onTime = 0;
        let late = 0;

        for (const task of tasks) {
            const deadline = task.deadline?.toDate ? task.deadline.toDate() : (task.deadline ? new Date(task.deadline) : null);
            const updatedAt = task.updatedAt?.toDate ? task.updatedAt.toDate() : new Date(task.updatedAt);

            if (deadline) {
                if (updatedAt <= deadline) {
                    onTime++;
                } else {
                    late++;
                }
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
        const workflows = await FirestoreService.getCollection('workflows');

        return Promise.all(workflows.map(async (wf: any) => {
            const taskConstraints: any[] = [{ field: 'workflowId', operator: '==', value: wf.id }];
            if (filter?.userId) {
                taskConstraints.push({ field: 'assignedToId', operator: '==', value: filter.userId });
            }
            const taskCount = await FirestoreService.count('tasks', taskConstraints);

            return {
                id: wf.id,
                type: wf.type,
                sprintName: wf.sprintName,
                status: wf.status,
                taskCount
            };
        }));
    }
}
