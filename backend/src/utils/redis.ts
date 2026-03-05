import Redis from 'ioredis';
import { config } from '../config';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

let redis: any;

if (config.REDIS_URL === 'internal') {
    logger.info('⚠️ Using internal mock for Redis');
    redis = {
        on: (event: string, callback: Function) => { },
        get: async (key: string) => null,
        set: async (key: string, value: string) => 'OK',
        del: async (key: string) => 1,
    };
} else {
    redis = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: 3,
    });

    redis.on('connect', () => {
        logger.info('✅ Successfully connected to Redis');
    });

    redis.on('error', (err: any) => {
        logger.error('❌ Redis error:', err);
    });
}

export { redis };
