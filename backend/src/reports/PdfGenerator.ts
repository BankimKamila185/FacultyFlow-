import PDFDocument from 'pdfkit';
import { FirestoreService } from '../services/FirestoreService';
import fs from 'fs';

export class PdfGenerator {
    static async generateTasksReport(): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            try {
                const tasks = await FirestoreService.getCollection('tasks');

                const sortedTasks = tasks.sort((a, b) => {
                    const dA = a.deadline?.toDate ? a.deadline.toDate() : (a.deadline ? new Date(a.deadline) : new Date(0));
                    const dB = b.deadline?.toDate ? b.deadline.toDate() : (b.deadline ? new Date(b.deadline) : new Date(0));
                    return dA.getTime() - dB.getTime();
                });

                const doc = new PDFDocument();
                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                doc.fontSize(20).text('FacultyFlow Tasks Report', { align: 'center' });
                doc.moveDown();

                for (const t of sortedTasks) {
                    const user = t.assignedToId ? await FirestoreService.getDoc<any>('users', t.assignedToId) : null;
                    const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : null);

                    doc.fontSize(12).text(`Title: ${t.title}`);
                    doc.fontSize(10).text(`Status: ${t.status}`);
                    doc.fontSize(10).text(`Assigned To: ${user?.name || 'Unassigned'}`);
                    const dl = deadline ? deadline.toISOString().split('T')[0] : 'None';
                    doc.fontSize(10).text(`Deadline: ${dl}`);
                    doc.moveDown();
                }

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    static async generateReport(title: string, content: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument();
                const writeStream = fs.createWriteStream(outputPath);

                doc.pipe(writeStream);

                doc.fontSize(25).text(title, { align: 'center' });
                doc.moveDown();
                doc.fontSize(12).text(content);
                doc.end();

                writeStream.on('finish', () => resolve(outputPath));
                writeStream.on('error', (err) => reject(err));

            } catch (error) {
                reject(error);
            }
        });
    }
}
