import * as xlsx from 'xlsx';
import { FirestoreService } from '../services/FirestoreService';

export class ExcelGenerator {
    static async generateTasksReport(): Promise<Buffer> {
        const tasks = await FirestoreService.getCollection('tasks');
        
        const data = await Promise.all(tasks.map(async (t: any) => {
            const user = t.assignedToId ? await FirestoreService.getDoc<any>('users', t.assignedToId) : null;
            const workflow = t.workflowId ? await FirestoreService.getDoc<any>('workflows', t.workflowId) : null;
            
            const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : null);

            return {
                'Task ID': t.id,
                'Title': t.title,
                'Status': t.status,
                'Deadline': deadline ? deadline.toISOString().split('T')[0] : 'N/A',
                'Sourced From': workflow?.type || 'Manual',
                'Assigned To': user?.email || 'Unassigned'
            };
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        
        xlsx.utils.book_append_sheet(wb, ws, 'Tasks Report');
        
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return buffer;
    }
}
