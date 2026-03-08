import { Request, Response } from 'express';
import { CalendarIntegration } from '../integrations/calendar';
import { GoogleCalendarService } from '../services/GoogleCalendarService';
import { getServiceAccountClient } from '../integrations/google/oauth';
import { prisma } from '../models/prisma';
import { google } from 'googleapis';

export class GoogleController {
    /**
     * GET /api/google/health
     * Verifies that the service account can connect to Google APIs.
     * Does NOT require a user OAuth token — uses the server's service account.
     */
    static async healthCheck(req: Request, res: Response) {
        try {
            const auth = await getServiceAccountClient([
                'https://www.googleapis.com/auth/cloud-platform',
            ]);
            const client = await auth.getClient();
            const projectId = await auth.getProjectId();

            res.json({
                status: 'ok',
                project: projectId,
                message: 'Service account connected to Google APIs successfully.',
            });
        } catch (error: any) {
            console.error('Google API health check failed:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to connect to Google APIs. Check service-account.json and GOOGLE_APPLICATION_CREDENTIALS.',
                error: error.message,
            });
        }
    }

    /**
     * GET /api/google/calendar/events
     * Lists upcoming Google Calendar events for the authenticated user.
     * Requires user to have a stored googleAccessToken.
     */
    static async listCalendarEvents(req: Request, res: Response) {
        try {
            const userPayload = (req as any).user;
            const maxResults = parseInt(req.query.maxResults as string) || 100;
            const timeMin = req.query.timeMin as string;
            const timeMax = req.query.timeMax as string;

            const events = await CalendarIntegration.getUpcomingEvents(
                userPayload.email,
                maxResults,
                timeMin,
                timeMax
            );

            res.json({
                success: true,
                count: events.length,
                events,
            });
        } catch (error: any) {
            console.error('Failed to list calendar events:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to retrieve calendar events.',
            });
        }
    }

    /**
     * POST /api/google/calendar/events
     * Creates a new Google Calendar event for the authenticated user.
     *
     * Body: { summary, description?, start (ISO string), end (ISO string), attendees?: string[], createMeetLink?: boolean }
     */
    static async createCalendarEvent(req: Request, res: Response) {
        try {
            const userPayload = (req as any).user;
            const { summary, description, start, end, attendees = [], createMeetLink = false } = req.body;

            if (!summary || !start || !end) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: summary, start, end',
                });
            }

            const event = await CalendarIntegration.createEvent(
                userPayload.email,
                summary,
                description || '',
                new Date(start),
                new Date(end),
                attendees,
                createMeetLink
            );

            res.status(201).json({
                success: true,
                event,
            });
        } catch (error: any) {
            console.error('Failed to create calendar event:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create calendar event.',
            });
        }
    }

    /**
     * POST /api/google/calendar/task/:taskId
     * Syncs a task's deadline to Google Calendar as an event.
     * Requires the task to have a deadline set.
     */
    static async syncTaskToCalendar(req: Request, res: Response) {
        try {
            const userPayload = (req as any).user;
            const { taskId } = req.params;

            // Fetch both the user (with access token) and the task
            const [user, task] = await Promise.all([
                prisma.user.findUnique({ where: { email: userPayload.email } }),
                prisma.task.findUnique({ where: { id: taskId } }),
            ]);

            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found.' });
            }
            if (!task) {
                return res.status(404).json({ success: false, message: `Task ${taskId} not found.` });
            }
            if (!task.deadline) {
                return res.status(400).json({ success: false, message: 'Task has no deadline to sync.' });
            }
            if (!user.googleAccessToken) {
                return res.status(403).json({
                    success: false,
                    message: 'No Google access token for this user. Please log in with Google and grant Calendar permissions.',
                });
            }

            const calendarEventId = await GoogleCalendarService.createEventForTask(user, task);

            if (calendarEventId) {
                res.json({
                    success: true,
                    calendarEventId,
                    message: `Task "${task.title}" synced to Google Calendar.`,
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Calendar event creation returned no ID.',
                });
            }
        } catch (error: any) {
            console.error('Failed to sync task to calendar:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to sync task to calendar.',
            });
        }
    }
}
