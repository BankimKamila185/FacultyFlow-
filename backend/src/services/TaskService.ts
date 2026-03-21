import { FirestoreService } from './FirestoreService';
import { GoogleCalendarService } from './GoogleCalendarService';
import { NotificationService } from '../notifications/NotificationService';
import { firestore } from 'firebase-admin';

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    deadline?: Date; // Linked to "End date"
    startDate?: Date;
    taskCompletionDate?: Date;
    responsibleTeam?: string; // Linked to "To Do Responsible team"
    workflowId?: string;
    assignedToId: string;
    createdById: string;
    remarks?: string;
    escalationLevel?: number;
    department?: string;
    createdAt?: any;
    updatedAt?: any;
    assignedTo?: any;
    createdBy?: any;
    workflow?: any;
}

export class TaskService {
    static async createTask(data: {
        title: string;
        description?: string;
        deadline?: Date;
        assignedToIds: string[];
        createdById: string;
        workflowId?: string;
    }): Promise<Task> {
        const { assignedToIds, ...rest } = data;
        const task = await FirestoreService.createDoc<Task>('tasks', {
            ...rest,
            assignedToId: assignedToIds[0] || '', // Primary assignee for legacy support
            status: 'PENDING',
            priority: 'MEDIUM',
            escalationLevel: 0,
        });

        // 1. Create taskResponsibles entries for all assignees
        await Promise.all(assignedToIds.map(async (userId) => {
            const user = await FirestoreService.getDoc<any>('users', userId);
            if (user) {
                await FirestoreService.createDoc('taskResponsibles', {
                    taskId: task.id,
                    email: user.email?.toLowerCase(),
                    role: 'RESPONSIBLE',
                    userId: user.id
                });

                // 2. Trigger Notification
                const msg = `You have been assigned a new task: ${task.title}. ${task.deadline ? `Deadline: ${task.deadline.toLocaleDateString()}` : ''}`;
                NotificationService.sendNotification(user.id, msg, 'TASK_ASSIGNED').catch(err => {
                    console.error('Failed to send task assignment notification', err);
                });

                if (user.googleAccessToken && task.deadline) {
                    GoogleCalendarService.createEventForTask(user, task as any).catch(err => {
                        console.error('Failed to sync google calendar event in background', err);
                    });
                }

                // 3. Trigger Email
                if (user.email) {
                    import('./MailService').then((MailService) => {
                        MailService.sendTaskAssignedEmail({
                            toEmail: user.email,
                            toName: user.name || 'User',
                            taskTitle: task.title,
                            taskId: task.id,
                            deadline: task.deadline,
                            responsibleTeam: task.department
                        }).catch(err => console.error('Failed to send assignment email in background', err));
                    });
                }
            }
        }));

        return task;
    }

    static async getTasks(filters?: { status?: string; assignedToId?: string }): Promise<Task[]> {
        const constraints: any[] = [];
        if (filters?.status) constraints.push({ field: 'status', operator: '==', value: filters.status });
        if (filters?.assignedToId) constraints.push({ field: 'assignedToId', operator: '==', value: filters.assignedToId });

        const tasks = await FirestoreService.query<Task>('tasks', constraints);

        // Populate relationships
        await Promise.all(tasks.map(async (task) => {
            task.assignedTo = await FirestoreService.getDoc('users', task.assignedToId);
            task.createdBy = await FirestoreService.getDoc('users', task.createdById);
            if (task.workflowId) {
                task.workflow = await FirestoreService.getDoc('workflows', task.workflowId);
            }
        }));

        return tasks;
    }

    static async getTaskById(taskId: string): Promise<Task | null> {
        const task = await FirestoreService.getDoc<Task>('tasks', taskId);
        if (!task) return null;

        task.assignedTo = await FirestoreService.getDoc('users', task.assignedToId);
        task.createdBy = await FirestoreService.getDoc('users', task.createdById);
        if (task.workflowId) {
            task.workflow = await FirestoreService.getDoc('workflows', task.workflowId);
        }

        return task;
    }

    static async updateTaskStatus(taskId: string, status: string): Promise<Task> {
        return FirestoreService.updateDoc<Task>('tasks', taskId, { status });
    }

    static async assignTask(taskId: string, assignedToIds: string[]): Promise<Task> {
        // Update primary assignee
        const task = await FirestoreService.updateDoc<Task>('tasks', taskId, { assignedToId: assignedToIds[0] || '' });

        // Clear existing responsibles and add new ones
        const existing = await FirestoreService.query('taskResponsibles', [{ field: 'taskId', operator: '==', value: taskId }]);
        await Promise.all(existing.map(e => FirestoreService.deleteDoc('taskResponsibles', e.id)));

        await Promise.all(assignedToIds.map(async (userId) => {
            const user = await FirestoreService.getDoc<any>('users', userId);
            if (user) {
                await FirestoreService.createDoc('taskResponsibles', {
                    taskId,
                    email: user.email?.toLowerCase(),
                    role: 'RESPONSIBLE',
                    userId: user.id
                });

                const msg = `A task has been reassigned to you: ${task.title}.`;
                NotificationService.sendNotification(user.id, msg, 'TASK_ASSIGNED').catch(err => {
                    console.error('Failed to send task reassignment notification', err);
                });
            }
        }));

        return task;
    }

    static async deleteTask(taskId: string): Promise<void> {
        await FirestoreService.deleteDoc('tasks', taskId);
    }
}
