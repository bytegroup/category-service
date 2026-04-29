import {Request, Response, NextFunction} from "express";
import { v4 as uuidv4 } from 'uuid';
import {logger} from "@/utils/logger";

export function requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
):void {

    req.requestId = uuidv4();
    req.startTime = Date.now();

    res.setHeader('X-Request-ID', req.requestId);

    logger.info('Incoming request', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });

    res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        logger[level]('Request completed', {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: duration,
        });
    });

    next();
}