import request from 'supertest';
import { createApp } from '../../src/server';
import { Express } from 'express';
import { prisma } from '../../src/models/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config';

describe('Tasks API Integration Tests', () => {
    let app: Express;
    let authToken: string;
    let testUser: any;

    beforeAll(async () => {
        app = await createApp();

        // Create a mock user
        testUser = await prisma.user.create({
            data: {
                email: 'test-user@test.com',
                name: 'Testy Tester',
                role: 'FACULTY',
                googleId: '12345test',
            }
        });

        authToken = jwt.sign({ id: testUser.id, role: testUser.role, email: testUser.email }, config.JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        await prisma.task.deleteMany({ where: { assignedToId: testUser.id } });
        await prisma.user.delete({ where: { id: testUser.id } });
    });

    describe('GET /api/tasks', () => {
        it('should return 401 if unauthorized', async () => {
            const response = await request(app).get('/api/tasks');
            expect(response.status).toBe(401);
        });

        it('should return empty list if no tasks', async () => {
            const response = await request(app)
                .get('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
        });

        it('should create a new task', async () => {
            const payload = {
                title: 'New Integration Test Task',
                description: 'Test Description',
                status: 'PENDING',
                assignedToId: testUser.id,
            };

            const response = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send(payload);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe(payload.title);
        });

        it('should update task status', async () => {
            // First create a task
            const task = await prisma.task.create({
                data: {
                    title: 'Status Update Task',
                    description: 'Testing status update',
                    assignedToId: testUser.id,
                }
            });

            // Then update its status
            const response = await request(app)
                .patch(`/api/tasks/${task.id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'COMPLETED' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('COMPLETED');
        });
    });
});
