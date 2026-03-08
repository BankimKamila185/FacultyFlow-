import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { config } from './config';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { prisma } from './models/prisma';
import winston from 'winston';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes';
import { verifyToken } from './utils/jwt';
import './utils/redis';
import { setupSwagger } from './docs/swagger';


const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
    ],
});

export async function createApp() {
    const app = express();

    app.use(cors({
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
        credentials: true
    }));
    app.use(express.json());
    app.use(morgan('dev'));

    setupSwagger(app);

    app.use('/api', apiRoutes);

    const server = new ApolloServer({
        typeDefs,
        resolvers,
    });

    await server.start();

    app.use('/graphql', expressMiddleware(server, {
        context: async ({ req }: { req: Request }) => {
            let user = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1];
                    user = verifyToken(token);
                } catch (err) {
                    logger.warn('Token verification failed', err);
                }
            }
            return { req, prisma, user };
        },
    }));

    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({ status: 'OK' });
    });


    app.use(errorHandler);

    return app;
}

export async function startServer() {
    const app = await createApp();

    const server = app.listen(config.PORT, () => {
        logger.info(`🚀 Server running on http://localhost:${config.PORT}`);
        logger.info(`🚀 GraphQL endpoint: http://localhost:${config.PORT}/graphql`);
        
        if (config.REDIS_URL !== 'internal') {
            import('./jobs/worker').then(({ setupCronJobs }) => {
                setupCronJobs();
            }).catch(e => logger.error('Failed to init cron jobs', e));
        }
    });

    return server;
}

if (require.main === module) {
    startServer().catch((error) => {
        logger.error('Failed to start server:', error);
        process.exit(1);
    });
}
