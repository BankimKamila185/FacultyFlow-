import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';

export class AnalyticsController {
    static async getDashboardMetrics(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            if (!user) {
                return res.status(401).json({ success: false, message: 'Identity required for analytics' });
            }
            
            let filterEmail = user.email;
            let filterUserId = user.id;

            const requestedEmail = req.query.email as string;
            if (requestedEmail && (user?.role === 'ADMIN' || user?.role === 'HOD')) {
                filterEmail = requestedEmail.toLowerCase();
                // If we need the actual user ID for that email, we might have to fetch it, but 
                // AnalyticsService mostly relies on email for responsibles matching anyway.
                // It's safer to just nullify the target ID to force fallback to email.
                filterUserId = undefined; 
            }

            // ALWAYS filter for personalized metrics based on current user or requested view
            const filter = { userId: filterUserId, email: filterEmail };
            
            console.log(`[Analytics] Fetching live metrics for: ${user?.email}`);
            const metrics = await AnalyticsService.getDashboardMetrics(filter);
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
