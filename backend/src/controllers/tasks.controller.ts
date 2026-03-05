import { Request, Response, NextFunction } from 'express';
import { TaskService } from '../services/TaskService';

export class TasksController {
    static async createTask(req: Request, res: Response, next: NextFunction) {
        try {
            const task = await TaskService.createTask(req.body);
            res.status(201).json({ success: true, data: task });
        } catch (error) {
            next(error);
        }
    }

    static async getTasks(req: Request, res: Response, next: NextFunction) {
        try {
            const { status, assignedToId } = req.query;
            const tasks = await TaskService.getTasks({
                status: status as string,
                assignedToId: assignedToId as string,
            });
            res.status(200).json({ success: true, data: tasks });
        } catch (error) {
            next(error);
        }
    }

    static async getTaskById(req: Request, res: Response, next: NextFunction) {
        try {
            const task = await TaskService.getTaskById(req.params.id);
            if (!task) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }
            res.status(200).json({ success: true, data: task });
        } catch (error) {
            next(error);
        }
    }

    static async updateTask(req: Request, res: Response, next: NextFunction) {
        try {
            // Allow updating status or assignment for simplicity in REST
            const { status, assignedToId } = req.body;
            let task;
            if (status) {
                task = await TaskService.updateTaskStatus(req.params.id, status as string);
            }
            if (assignedToId) {
                task = await TaskService.assignTask(req.params.id, assignedToId);
            }
            res.status(200).json({ success: true, data: task });
        } catch (error) {
            next(error);
        }
    }

    static async deleteTask(req: Request, res: Response, next: NextFunction) {
        try {
            await TaskService.deleteTask(req.params.id);
            res.status(200).json({ success: true, message: 'Task deleted' });
        } catch (error) {
            next(error);
        }
    }
}
