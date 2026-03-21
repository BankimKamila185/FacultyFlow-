import { FirestoreService } from './FirestoreService';
import * as MailService from './MailService';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    transports: [new winston.transports.Console()],
});

export class ReminderService {
    /**
     * Morning Reminder (10 AM): Pending tasks + Deadline Alerts (3 days)
     */
    static async sendMorningReminders() {
        try {
            logger.info('[ReminderService] Processing Morning Reminders...');
            const tasks = await FirestoreService.query('tasks', [{ field: 'status', operator: '!=', value: 'COMPLETED' }]);
            const users = await FirestoreService.getCollection('users');
            const departments = await FirestoreService.getCollection('departments');

            const userMap = new Map(users.map((u: any) => [u.id, u]));
            const deptMap = new Map(departments.map((d: any) => [d.name, d]));
            const now = new Date();

            // Group tasks by assignee and FILTER by startDate
            const facultyTasks: Record<string, any[]> = {};

            for (const task of tasks) {
                const assignee = userMap.get(task.assignedToId);
                if (!assignee || !assignee.email) continue;

                // Date Filtering: Only include if startDate <= now
                const startDate = task.startDate?.toDate ? task.startDate.toDate() : (task.startDate ? new Date(task.startDate) : null);
                if (startDate && startDate > now) {
                    logger.info(`[ReminderService] Skipping future task: "${task.title}" (Starts: ${startDate.toLocaleDateString()})`);
                    continue;
                }

                if (!facultyTasks[assignee.email]) facultyTasks[assignee.email] = [];
                facultyTasks[assignee.email].push({ ...task, assigneeName: assignee.name });
            }

            for (const [email, userTasks] of Object.entries(facultyTasks)) {
                const userName = userTasks[0].assigneeName;
                const simpleTasks: any[] = [];
                const urgentTasks: any[] = [];
                const ccEmails = new Set<string>();

                for (const task of userTasks) {
                    const deadline = task.deadline?.toDate ? task.deadline.toDate() : (task.deadline ? new Date(task.deadline) : null);
                    let isUrgent = false;

                    if (deadline) {
                        const diffTime = deadline.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays >= 0 && diffDays <= 3) {
                            isUrgent = true;
                            // Critical: <= 1 day left, CC the HOD
                            if (diffDays <= 1 && task.department) {
                                ccEmails.add('aartip@itm.edu');
                            }
                        }
                    }

                    const formattedTask = {
                        id: task.id,
                        title: task.title,
                        deadline: deadline
                    };

                    if (isUrgent) {
                        urgentTasks.push(formattedTask);
                    } else {
                        simpleTasks.push(formattedTask);
                    }
                }

                const allTasks = [...urgentTasks, ...simpleTasks];
                const ccString = ccEmails.size > 0 ? Array.from(ccEmails).join(', ') : undefined;

                let aiMessage = '';
                try {
                    const prompt = `Write a short, friendly, and professional 1-2 sentence morning greeting for ${userName} who works in a university department. They have ${allTasks.length} pending tasks, and ${urgentTasks.length} of them are urgent. Direct them to focus on the urgent ones if applicable. No placeholders, just the specific message text.`;
                    const response = await (await import('../controllers/ai.controller')).callGemini(prompt);
                    if (response) aiMessage = response.replace(/\n/g, '<br/>');
                } catch (e) {
                    logger.warn('[ReminderService] AI generation failed, falling back to static text.');
                }

                await MailService.sendMorningCheckinEmail({
                    toEmail: email,
                    toName: userName,
                    tasks: allTasks,
                    urgentCount: urgentTasks.length,
                    ccEmail: ccString,
                    timeLabel: 'Morning',
                    aiMessage: aiMessage
                });
            }
        } catch (error) {
            logger.error('[ReminderService] Error in sendMorningReminders:', error);
        }
    }

    /**
     * Afternoon Reminder (2 PM): Friendly check-in for pending tasks
     */
    static async sendAfternoonReminders() {
        try {
            logger.info('[ReminderService] Processing Afternoon Reminders...');
            const tasks = await FirestoreService.query('tasks', [{ field: 'status', operator: '!=', value: 'COMPLETED' }]);
            const users = await FirestoreService.getCollection('users');
            const userMap = new Map(users.map((u: any) => [u.id, u]));
            const now = new Date();

            const facultyTasks: Record<string, any[]> = {};
            for (const task of tasks) {
                const assignee = userMap.get(task.assignedToId);
                if (!assignee || !assignee.email) continue;

                // Date Filtering
                const startDate = task.startDate?.toDate ? task.startDate.toDate() : (task.startDate ? new Date(task.startDate) : null);
                if (startDate && startDate > now) continue;

                if (!facultyTasks[assignee.email]) facultyTasks[assignee.email] = [];
                facultyTasks[assignee.email].push({ ...task, assigneeName: assignee.name });
            }

            for (const [email, userTasks] of Object.entries(facultyTasks)) {
                const userName = userTasks[0].assigneeName;
                const simpleTasks = userTasks.map(t => ({
                    title: t.title,
                    deadline: t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : null)
                }));

                await MailService.sendMorningCheckinEmail({
                    toEmail: email,
                    toName: userName,
                    tasks: simpleTasks,
                    timeLabel: 'Afternoon'
                });
            }
        } catch (error) {
            logger.error('[ReminderService] Error in sendAfternoonReminders:', error);
        }
    }

    /**
     * End of Day Report (6 PM): Sent to HODs and Admins
     */
    static async sendEndOfDayReport() {
        try {
            logger.info('[ReminderService] Processing EOD Reports...');
            const tasks = await FirestoreService.getCollection('tasks');
            const departments = await FirestoreService.getCollection('departments');
            const users = await FirestoreService.getCollection('users');
            const userMap = new Map(users.map((u: any) => [u.id, u]));

            const now = new Date();
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));

            for (const dept of departments) {
                const headEmail = 'aartip@itm.edu';
                const headName = 'Dr. Aarti Pardeshi';

                const deptTasks = tasks.filter((t: any) => t.department === dept.name);
                const completedToday = deptTasks.filter((t: any) => {
                    const updatedAt = t.updatedAt?.toDate ? t.updatedAt.toDate() : new Date(t.updatedAt);
                    return t.status === 'COMPLETED' && updatedAt >= startOfDay;
                }).length;

                const pendingTotal = deptTasks.filter((t: any) => t.status === 'PENDING' || t.status === 'OVERDUE').length;
                
                const overdueTotal = deptTasks.filter((t: any) => t.status === 'OVERDUE').length;

                const recentTasks = deptTasks
                    .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))
                    .slice(0, 5)
                    .map((t: any) => {
                        const assignee = userMap.get(t.assignedToId);
                        return {
                            title: t.title,
                            assignee: assignee ? assignee.name : 'Unknown',
                            status: t.status
                        };
                    });

                await MailService.sendDepartmentReportEmail({
                    toEmail: headEmail,
                    toName: headName,
                    department: dept.name,
                    stats: { completedToday, pendingTotal, overdueTotal },
                    recentTasks: recentTasks
                });
            }

            // Global Summary for Admins
            const admins = users.filter((u: any) => u.role === 'ADMIN');
            for (const admin of admins) {
                // Simplified: just send a global stats email or similar
                // For now, let's keep it tidy and only send HOD reports as requested
            }

        } catch (error) {
            logger.error('[ReminderService] Error in sendEndOfDayReport:', error);
        }
    }

    // Keep the old method for manual triggers but alias it to morning reminders for now
    static async sendPendingTaskReminders() {
        return this.sendMorningReminders();
    }
}
