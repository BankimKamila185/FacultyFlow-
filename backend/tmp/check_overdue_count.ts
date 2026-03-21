import { FirestoreService } from '../src/services/FirestoreService';

async function countOverdueTasks() {
    try {
        const now = new Date();
        const tasks = await FirestoreService.getCollection('tasks');
        
        // 1. New Overdue Tasks (will be marked OVERDUE at 5 PM)
        const toMarkOverdue = tasks.filter((t: any) => 
            !['COMPLETED', 'OVERDUE'].includes(t.status) && 
            t.deadline && (t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline)) < now
        );

        // 2. Severe Overdue for Escalation (>48h)
        const escalationThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const toEscalate = tasks.filter((t: any) => {
            const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : null);
            if (!deadline) return false;
            
            const isOverdue = t.status === 'OVERDUE' || deadline < now;
            const isSeverelyOverdue = deadline < escalationThreshold;
            const matchesEscalationLevel = (t.escalationLevel || 0) < 2;
            
            if (isSeverelyOverdue && matchesEscalationLevel && t.status !== 'COMPLETED') {
                return true;
            }
            return false;
        });

        console.log(`Potential Overdue Marks: ${toMarkOverdue.length}`);
        console.log(`Potential Escalations: ${toEscalate.length}`);
        
        const hods = await FirestoreService.query('users', [{ field: 'role', operator: '==', value: 'HOD' }]);
        console.log(`Number of HODs: ${hods.length}`);
        console.log(`Total Emails estimate (Escalations * HODs): ${toEscalate.length * hods.length}`);

    } catch (e) {
        console.error(e);
    }
}

countOverdueTasks();
