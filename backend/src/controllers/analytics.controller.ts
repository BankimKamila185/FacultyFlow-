import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';

export class AnalyticsController {
    static async getDashboardMetrics(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            
            // ALWAYS filter for personalized metrics based on current user
            // "Project Total" (globalTotal) is handled inside the service separately
            const filter = { userId: user.id, email: user.email };
            
            console.log(`[Analytics] Fetching for User: ${user?.email} (${user?.id})`);
            const metrics = await AnalyticsService.getDashboardMetrics(filter);
            console.log(`[Analytics] Result:`, JSON.stringify(metrics, null, 2));
            
            res.status(200).json({ success: true, data: metrics });
        } catch (error) {
            next(error);
        }
    }

    static async getFacultyProductivity(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const filter = user?.role === 'FACULTY' ? { userId: user.id } : undefined;
            const productivity = await AnalyticsService.getFacultyProductivity(filter);
            res.status(200).json({ success: true, data: productivity });
        } catch (error) {
            next(error);
        }
    }

    static async getTaskTrends(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const filter = user?.role === 'FACULTY' ? { userId: user.id, email: user.email } : undefined;
            const trends = await AnalyticsService.getTaskTrends(filter);
            res.status(200).json({ success: true, data: trends });
        } catch (error) {
            next(error);
        }
    }

    static async getDeadlineCompliance(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const filter = user?.role === 'FACULTY' ? { userId: user.id, email: user.email } : undefined;
            const compliance = await AnalyticsService.getDeadlineCompliance(filter);
            res.status(200).json({ success: true, data: compliance });
        } catch (error) {
            next(error);
        }
    }

    static async getWorkflowBreakdown(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const filter = user?.role === 'FACULTY' ? { userId: user.id, email: user.email } : undefined;
            const breakdown = await AnalyticsService.getWorkflowBreakdown(filter);
            res.status(200).json({ success: true, data: breakdown });
        } catch (error) {
            next(error);
        }
    }
}
