import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ExcelGenerator {
    static async generateTasksReport(): Promise<Buffer> {
        const tasks = await prisma.task.findMany({
            include: {
                assignedTo: true,
                workflow: true
            },
            orderBy: { deadline: 'asc' }
        });

        const data = tasks.map(t => ({
            'Task ID': t.id,
            'Title': t.title,
            'Status': t.status,
            'Deadline': t.deadline ? t.deadline.toISOString().split('T')[0] : 'N/A',
            'Sourced From': t.workflow?.type || 'Manual',
            'Assigned To': t.assignedTo?.email || 'Unassigned'
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        
        xlsx.utils.book_append_sheet(wb, ws, 'Tasks Report');
        
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return buffer;
    }
}
