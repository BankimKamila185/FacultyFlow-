import PDFDocument from 'pdfkit';
import { prisma } from '../models/prisma';
import fs from 'fs';
import path from 'path';

export class PdfGenerator {
    static async generateTasksReport(): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            try {
            // Use singleton prisma
                const tasks = await prisma.task.findMany({
                    include: { assignedTo: true, workflow: true },
                    orderBy: { deadline: 'asc' }
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

                tasks.forEach((t: any) => {
                    doc.fontSize(12).text(`Title: ${t.title}`);
                    doc.fontSize(10).text(`Status: ${t.status}`);
                    doc.fontSize(10).text(`Assigned To: ${t.assignedTo?.name || 'Unassigned'}`);
                    const dl = t.deadline ? t.deadline.toISOString().split('T')[0] : 'None';
                    doc.fontSize(10).text(`Deadline: ${dl}`);
                    doc.moveDown();
                });

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

                // Header
                doc.fontSize(25).text(title, { align: 'center' });
                doc.moveDown();

                // Content
                doc.fontSize(12).text(content);

                // Finalize PDF file
                doc.end();

                writeStream.on('finish', () => {
                    resolve(outputPath);
                });
                writeStream.on('error', (err) => {
                    reject(err);
                });

            } catch (error) {
                reject(error);
            }
        });
    }
}
