import { google, calendar_v3 } from 'googleapis';
import { User, Task } from '@prisma/client';

export class GoogleCalendarService {
    /**
     * Creates a Google Calendar event for a given Task
     */
    static async createEventForTask(user: User, task: Task): Promise<string | null> {
        if (!user.googleAccessToken) {
            console.warn(`User ${user.email} has no Google Access Token, cannot sync to calendar.`);
            return null;
        }

        if (!task.deadline) {
            console.warn(`Task ${task.id} has no deadline, skipping calendar sync.`);
            return null;
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: user.googleAccessToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const event: calendar_v3.Schema$Event = {
            summary: `FacultyFlow Task: ${task.title}`,
            description: task.description || 'Auto-generated from FacultyFlow.',
            start: {
                // Assuming deadline is the eod, we can create an all-day event or 1-hour event
                dateTime: new Date(task.deadline.getTime() - 60 * 60 * 1000).toISOString(),
                timeZone: 'Asia/Kolkata', // Set to Indian Standard Time based on system info, customize as needed
            },
            end: {
                dateTime: task.deadline.toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 60 },
                ],
            },
        };

        try {
            const res = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
            });
            console.log(`Calendar event created: ${res.data.htmlLink}`);
            return res.data.id || null;
        } catch (error) {
            console.error('Failed to create Google Calendar event:', error);
            return null;
        }
    }
}
