import {ApolloServer} from "@apollo/server";
import express, {Application, urlencoded} from "express";
import helmet from "helmet";
import cors from "cors";
import {requestLogger} from "@/middleware/requestLogger";
import {logger} from "@/utils/logger";
import {globalErrorHandler, notFoundHandler} from "@/middleware/errorHandler";
import {expressMiddleware} from "@as-integrations/express5";

export async function createCategoryService(apolloServer: ApolloServer): Promise<Application> {
    await apolloServer.start();

    const app = express();

    app.use(helmet({
        contentSecurityPolicy: process.env.NODE_ENV === 'production'? undefined : false,
        crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
    }));

    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    }));

    app.use(express.json({limit: '5mb'}));
    app.use(urlencoded({ extended: true }));
    app.use(requestLogger);

    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
        });
    });

    app.use(
        '/graphql',
        expressMiddleware(apolloServer, {
            context: async ({ req }) => ({
                requestId: req.requestId,
            }),
        })
    );

    logger.info('GraphQL endpoint mounted at /graphql');

    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    return app;
}