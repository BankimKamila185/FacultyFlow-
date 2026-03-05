import { prisma } from '../src/models/prisma';
import { redis } from '../src/utils/redis';

beforeAll(async () => {
    // Any global setup before all tests
});

afterAll(async () => {
    // Clean up connections
    await prisma.$disconnect();
    redis.quit();
});
