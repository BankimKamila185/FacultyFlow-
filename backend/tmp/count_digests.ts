import { FirestoreService } from '../src/services/FirestoreService';

async function countDigestEmails() {
    try {
        const now = new Date();
        const tasks = await FirestoreService.getCollection('tasks');
        const newlyOverdue = tasks.filter((t: any) => 
            !['COMPLETED', 'OVERDUE'].includes(t.status) && 
            t.deadline && (t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline)) < now
        );

        const assigneeIds = new Set(newlyOverdue.map(t => t.assignedToId));
        console.log(`Unique Faculty members getting Overdue Digest: ${assigneeIds.size}`);

        const escalationThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const toEscalate = tasks.filter((t: any) => {
            if (t.status === 'COMPLETED') return false;
            const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : null);
            if (!deadline) return false;
            const isSeverelyOverdue = deadline < escalationThreshold;
            const matchesEscalationLevel = (t.escalationLevel || 0) < 2;
            return isSeverelyOverdue && matchesEscalationLevel;
        });

        const affectedDepts = new Set(toEscalate.map(t => t.department || 'General'));
        console.log(`Unique Departments with Escalations: ${affectedDepts.size}`);
        console.log(`Departments: ${Array.from(affectedDepts).join(', ')}`);

    } catch (e) {
        console.error(e);
    }
}

countDigestEmails();
