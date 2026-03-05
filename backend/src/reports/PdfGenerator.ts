import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export class PdfGenerator {
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
