import { google, calendar_v3 } from 'googleapis';

export class GoogleCalendarService {
    /**
     * Creates a Google Calendar event for a given Task
     */
    static async createEventForTask(user: any, task: any): Promise<string | null> {
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

        const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);

        const event: calendar_v3.Schema$Event = {
            summary: `FacultyFlow Task: ${task.title}`,
            description: task.description || 'Auto-generated from FacultyFlow.',
            start: {
                dateTime: new Date(deadline.getTime() - 60 * 60 * 1000).toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            end: {
                dateTime: deadline.toISOString(),
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
