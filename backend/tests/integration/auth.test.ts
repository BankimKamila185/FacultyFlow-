import request from 'supertest';
import { createApp } from '../../src/server';
import { Express } from 'express';

describe('Auth API Integration Tests', () => {
    let app: Express;

    beforeAll(async () => {
        app = await createApp();
    });

    describe('POST /api/auth/login', () => {
        it('should return 401 when no token is provided', async () => {
            const response = await request(app).post('/api/auth/login').send({});

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toBe('ID Token is required');
        });

        // We stub Google Auth so we cannot easily test a real token here without mocking.
        // Assuming simple missing token test serves as the integration smoke test.
    });

    describe('POST /api/auth/logout', () => {
        it('should return 200 on logout', async () => {
            const response = await request(app).post('/api/auth/logout');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
        });
    });
});
