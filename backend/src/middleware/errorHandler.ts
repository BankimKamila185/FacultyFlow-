import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'error',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error(err.message, { stack: err.stack, url: req.url, body: req.body });

    const statusCode = err.statusCode || 500;
    const message = err.isOperational ? err.message : 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
