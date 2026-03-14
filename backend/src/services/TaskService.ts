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
    deadline?: Date;
    startDate?: Date;
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
        assignedToId: string;
        createdById: string;
        workflowId?: string;
    }): Promise<Task> {
        const task = await FirestoreService.createDoc<Task>('tasks', {
            ...data,
            status: 'PENDING',
            priority: 'MEDIUM',
            escalationLevel: 0,
        });

        const assignedUser = await FirestoreService.getDoc('users', data.assignedToId);
        if (assignedUser) {
            // Trigger Notification
            const msg = `You have been assigned a new task: ${task.title}. ${task.deadline ? `Deadline: ${task.deadline.toLocaleDateString()}` : ''}`;
            NotificationService.sendNotification(assignedUser.id, msg, 'TASK_ASSIGNED').catch(err => {
                console.error('Failed to send task assignment notification', err);
            });

            if (assignedUser.googleAccessToken && task.deadline) {
                // Call async context without blocking response
                GoogleCalendarService.createEventForTask(assignedUser, task as any).catch(err => {
                    console.error('Failed to sync google calendar event in background', err);
                });
            }
        }

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

    static async assignTask(taskId: string, assignedToId: string): Promise<Task> {
        const task = await FirestoreService.updateDoc<Task>('tasks', taskId, { assignedToId });

        const assignedUser = await FirestoreService.getDoc('users', assignedToId);
        if (assignedUser) {
            const msg = `A task has been reassigned to you: ${task.title}.`;
            NotificationService.sendNotification(assignedUser.id, msg, 'TASK_ASSIGNED').catch(err => {
                console.error('Failed to send task reassignment notification', err);
            });
        }

        return task;
    }

    static async deleteTask(taskId: string): Promise<void> {
        await FirestoreService.deleteDoc('tasks', taskId);
    }
}
