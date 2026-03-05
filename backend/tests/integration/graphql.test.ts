import request from 'supertest';
import { createApp } from '../../src/server';
import { Express } from 'express';

describe('GraphQL API Integration Tests', () => {
    let app: Express;

    beforeAll(async () => {
        app = await createApp();
    });

    describe('GraphQL Query: currentUser', () => {
        it('should return null for unauthorized user', async () => {
            const query = `
        query {
          currentUser {
            id
            email
          }
        }
      `;
            const response = await request(app)
                .post('/graphql')
                .send({ query });

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveProperty('currentUser', null);
            // Apollo server returns 200 with generic errors or null for an unauthenticated user query depending on how resolver handles it.
        });
    });
});
