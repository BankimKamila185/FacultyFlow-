import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';

export class AnalyticsController {
    static async getDashboardMetrics(req: Request, res: Response, next: NextFunction) {
        try {
            const metrics = await AnalyticsService.getDashboardMetrics();
            res.status(200).json({ success: true, data: metrics });
        } catch (error) {
            next(error);
        }
    }

    static async getFacultyProductivity(req: Request, res: Response, next: NextFunction) {
        try {
            const productivity = await AnalyticsService.getFacultyProductivity();
            res.status(200).json({ success: true, data: productivity });
        } catch (error) {
            next(error);
        }
    }
}
