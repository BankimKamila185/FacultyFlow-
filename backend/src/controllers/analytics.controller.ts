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
            let filterDept = user.department;

            const userRole = user?.role?.toUpperCase();
            const isAdmin = userRole === 'ADMIN';
            const isManager = ['HOD', 'OPS_MANAGER'].includes(userRole);
            const requestedEmail = req.query.email as string;

            const filter: any = {};

            if (isAdmin) {
                if (requestedEmail) {
                    filter.email = requestedEmail.toLowerCase();
                } else {
                    // System-wide for Admin if no email requested
                }
            } else if (isManager) {
                if (requestedEmail) {
                    filter.email = requestedEmail.toLowerCase();
                    filter.userId = undefined;
                } else {
                    // Filter by department for HOD/Ops if no specific email requested
                    filter.department = filterDept;
                }
            } else {
                // FACULTY: filter by their own identity
                filter.userId = filterUserId;
                filter.email = filterEmail;
            }

            console.log(`[Analytics] Fetching dashboard metrics for: ${user?.email} (Role: ${userRole})`);
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

    static async getDepartmentSummaries(req: Request, res: Response, next: NextFunction) {
        try {
            const summaries = await AnalyticsService.getDepartmentSummaries();
            res.status(200).json({ success: true, data: summaries });
        } catch (error) {
            next(error);
        }
    }
}
