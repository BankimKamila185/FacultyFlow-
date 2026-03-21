import { FirestoreService } from '../src/services/FirestoreService';
import * as MailService from '../src/services/MailService';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()],
});

async function runDirectCheck() {
    try {
        console.log('--- Starting Direct Overdue Check ---');
        const now = new Date();
        const tasks = await FirestoreService.getCollection('tasks');
        const users = await FirestoreService.getCollection('users');
        const departments = await FirestoreService.getCollection('departments');
        
        const userMap = new Map(users.map((u: any) => [u.id, u]));
        const deptMap = new Map(departments.map((d: any) => [d.name, d]));

        // 1. Handle Newly Overdue Tasks
        const newlyOverdue = tasks.filter((t: any) => 
            !['COMPLETED', 'OVERDUE'].includes(t.status) && 
            t.deadline && (t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline)) < now
        );

        console.log(`Found ${newlyOverdue.length} newly overdue tasks.`);

        const assigneeGroups: Record<string, any[]> = {};
        for (const task of newlyOverdue) {
            // In theory we'd update Firestore but let's just simulate for now or do it for real
            // await FirestoreService.updateDoc('tasks', task.id, { status: 'OVERDUE' });
            if (!assigneeGroups[task.assignedToId]) assigneeGroups[task.assignedToId] = [];
            assigneeGroups[task.assignedToId].push(task);
        }

        for (const [assigneeId, facultyTasks] of Object.entries(assigneeGroups)) {
            const assignee = userMap.get(assigneeId);
            if (assignee?.email) {
                console.log(`Sending overdue digest to ${assignee.email} (${facultyTasks.length} tasks)`);
                const digestTasks = facultyTasks.map(t => {
                    const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : new Date());
                    return { title: t.title, daysOverdue: 1, deadline: deadline };
                });
                await MailService.sendOverdueDigestEmail({ toEmail: assignee.email, toName: assignee.name || 'Faculty', tasks: digestTasks });
            }
        }

        // 2. Escalations
        const escalationThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const tasksToEscalate = tasks.filter((t: any) => {
            if (t.status === 'COMPLETED') return false;
            const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : null);
            if (!deadline) return false;
            return deadline < escalationThreshold && (t.escalationLevel || 0) < 2;
        });

        console.log(`Found ${tasksToEscalate.length} tasks to escalate.`);

        const hodGroups: Record<string, { email: string; tasks: any[] }> = {};
        for (const task of tasksToEscalate) {
            const dept = deptMap.get(task.department || 'General');
            if (dept?.headEmail) {
                if (!hodGroups[dept.headEmail]) hodGroups[dept.headEmail] = { email: dept.headEmail, tasks: [] };
                hodGroups[dept.headEmail].tasks.push(task);
            }
        }

        for (const [email, group] of Object.entries(hodGroups)) {
            console.log(`Sending escalation digest to ${email} (${group.tasks.length} tasks)`);
            const digestTasks = group.tasks.map(t => ({
                title: t.title,
                assigneeName: userMap.get(t.assignedToId)?.name || 'Unknown',
                daysOverdue: 5
            }));
            await MailService.sendEscalationDigestEmail({ hodEmail: email, hodName: 'HOD', tasks: digestTasks });
        }

        process.exit(0);
    } catch (e) {
        console.error('Logic Error:', e);
        process.exit(1);
    }
}

runDirectCheck();
