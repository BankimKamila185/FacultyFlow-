import { Request, Response } from 'express';
import { PdfGenerator } from '../reports/PdfGenerator';
import { ExcelGenerator } from '../reports/ExcelGenerator';

export const downloadPdf = async (req: Request, res: Response): Promise<void> => {
    try {
        // Authenticated check already handles by middleware
        const buffer = await PdfGenerator.generateTasksReport();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="tasks_report.pdf"',
            'Content-Length': buffer.length
        });
        
        res.send(buffer);
    } catch (error: any) {
        console.error('PDF generation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const downloadExcel = async (req: Request, res: Response): Promise<void> => {
    try {
        const buffer = await ExcelGenerator.generateTasksReport();

        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="tasks_report.xlsx"',
            'Content-Length': buffer.length
        });
        
        res.send(buffer);
    } catch (error: any) {
        console.error('Excel generation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
