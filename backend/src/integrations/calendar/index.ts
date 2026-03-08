import { google, calendar_v3 } from 'googleapis';
import { getGoogleOAuthClient } from '../google/oauth';

export class CalendarIntegration {
    /**
     * Creates a Calendar event, optionally appending a Google Meet link.
     */
    static async createEvent(
        userEmail: string,
        summary: string,
        description: string,
        startTime: Date,
        endTime: Date,
        attendees: string[] = [],
        createMeetLink: boolean = false
    ): Promise<calendar_v3.Schema$Event> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const calendar = google.calendar({ version: 'v3', auth });

            const event: calendar_v3.Schema$Event = {
                summary,
                description,
                start: {
                    dateTime: startTime.toISOString(),
                },
                end: {
                    dateTime: endTime.toISOString(),
                },
                attendees: attendees.map(email => ({ email }))
            };

            if (createMeetLink) {
                event.conferenceData = {
                    createRequest: {
                        requestId: `meet-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                };
            }

            const response = await calendar.events.insert({
                calendarId: 'primary',
                conferenceDataVersion: createMeetLink ? 1 : 0,
                requestBody: event,
            });

            return response.data;
        } catch (error) {
            console.error('Error creating Google Calendar event:', error);
            throw error;
        }
    }

    /**
     * Retrieves upcoming events for the primary calendar.
     */
    static async getUpcomingEvents(
        userEmail: string, 
        maxResults: number = 100, 
        timeMin?: string, 
        timeMax?: string
    ): Promise<calendar_v3.Schema$Event[]> {
        try {
            const auth = await getGoogleOAuthClient(userEmail);
            const calendar = google.calendar({ version: 'v3', auth });

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: timeMin || new Date().toISOString(),
                timeMax: timeMax,
                maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            });

            return response.data.items || [];
        } catch (error) {
            console.error('Error listing Google Calendar events:', error);
            throw error;
        }
    }
}
