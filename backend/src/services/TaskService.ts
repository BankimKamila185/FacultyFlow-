import { User, Task } from '@prisma/client';
import { prisma } from '../models/prisma';
import { GoogleCalendarService } from './GoogleCalendarService';

export class TaskService {
    static async createTask(data: {
        title: string;
        description?: string;
        deadline?: Date;
        assignedToId: string;
        createdById: string;
        workflowId?: string;
    }): Promise<Task> {
        const task = await prisma.task.create({
            data,
        });

        const assignedUser = await prisma.user.findUnique({ where: { id: data.assignedToId } });
        if (assignedUser && assignedUser.googleAccessToken && task.deadline) {
            // Call async context without blocking response
            GoogleCalendarService.createEventForTask(assignedUser, task).catch(err => {
                console.error('Failed to sync google calendar event in background', err);
            });
        }

        return task;
    }

    static async getTasks(filters?: { status?: string; assignedToId?: string }): Promise<Task[]> {
        return prisma.task.findMany({
            where: filters,
            include: {
                assignedTo: true,
                createdBy: true,
                workflow: true,
            },
        });
    }

    static async getTaskById(taskId: string): Promise<Task | null> {
        return prisma.task.findUnique({
            where: { id: taskId },
            include: {
                assignedTo: true,
                createdBy: true,
                workflow: true,
            },
        });
    }

    static async updateTaskStatus(taskId: string, status: string): Promise<Task> {
        return prisma.task.update({
            where: { id: taskId },
            data: { status },
        });
    }

    static async assignTask(taskId: string, assignedToId: string): Promise<Task> {
        return prisma.task.update({
            where: { id: taskId },
            data: { assignedToId },
        });
    }

    static async deleteTask(taskId: string): Promise<void> {
        await prisma.task.delete({
            where: { id: taskId },
        });
    }
}
