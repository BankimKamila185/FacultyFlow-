import { Router } from 'express';
import { GoogleController } from '../controllers/google.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /google/health:
 *   get:
 *     summary: Verify Google API service account connectivity
 *     tags: [Google]
 *     responses:
 *       200:
 *         description: Service account connected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 project:
 *                   type: string
 *                   example: facultyflow-489404
 *       500:
 *         description: Service account connection failed
 */
router.get('/health', GoogleController.healthCheck);

/**
 * @swagger
 * /google/calendar/events:
 *   get:
 *     summary: List upcoming Google Calendar events for the logged-in user
 *     tags: [Google]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: maxResults
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of events to return
 *     responses:
 *       200:
 *         description: List of upcoming events
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch events (check Google access token)
 */
router.get('/calendar/events', authenticate, GoogleController.listCalendarEvents);

/**
 * @swagger
 * /google/calendar/events:
 *   post:
 *     summary: Create a new Google Calendar event
 *     tags: [Google]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - summary
 *               - start
 *               - end
 *             properties:
 *               summary:
 *                 type: string
 *               description:
 *                 type: string
 *               start:
 *                 type: string
 *                 format: date-time
 *               end:
 *                 type: string
 *                 format: date-time
 *               attendees:
 *                 type: array
 *                 items:
 *                   type: string
 *               createMeetLink:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Event created successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 */
router.post('/calendar/events', authenticate, GoogleController.createCalendarEvent);

/**
 * @swagger
 * /google/calendar/task/{taskId}:
 *   post:
 *     summary: Sync a FacultyFlow task deadline to Google Calendar
 *     tags: [Google]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the task to sync
 *     responses:
 *       200:
 *         description: Task synced to calendar
 *       400:
 *         description: Task has no deadline
 *       403:
 *         description: No Google access token for user
 *       404:
 *         description: Task or user not found
 */
router.post('/calendar/task/:taskId', authenticate, GoogleController.syncTaskToCalendar);

export default router;
