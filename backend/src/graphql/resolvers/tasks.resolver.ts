import { TaskService } from '../../services/TaskService';

export const taskResolvers = {
    Query: {
        tasks: async (_: any, args: { status?: string, assignedToId?: string }, context: any) => {
            if (!context.user) throw new Error('Unauthenticated');
            return TaskService.getTasks({
                status: args.status,
                assignedToId: args.assignedToId
            });
        },
        task: async (_: any, { id }: { id: string }, context: any) => {
            if (!context.user) throw new Error('Unauthenticated');
            return TaskService.getTaskById(id);
        }
    },
    Mutation: {
        createTask: async (_: any, args: { title: string, description?: string, deadline?: string, assignedToId: string, workflowId?: string }, context: any) => {
            if (!context.user) throw new Error('Unauthenticated');
            const { assignedToId, ...rest } = args;
            return TaskService.createTask({
                ...rest,
                assignedToIds: [assignedToId],
                deadline: args.deadline ? new Date(args.deadline) : undefined,
                createdById: context.user.id
            });
        },
        updateTaskStatus: async (_: any, { id, status }: { id: string, status: string }, context: any) => {
            if (!context.user) throw new Error('Unauthenticated');
            return TaskService.updateTaskStatus(id, status);
        },
        assignTask: async (_: any, { id, assignedToId }: { id: string, assignedToId: string }, context: any) => {
            if (!context.user) throw new Error('Unauthenticated');
            return TaskService.assignTask(id, [assignedToId]);
        },
        deleteTask: async (_: any, { id }: { id: string }, context: any) => {
            if (!context.user) throw new Error('Unauthenticated');
            await TaskService.deleteTask(id);
            return true;
        }
    }
};
