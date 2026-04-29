import {logger} from "@/utils/logger";
import {config} from "@/config";
import {connectRedis, disconnectRedis} from "@/config/redis";
import {connectDatabase, disconnectDatabase} from "@/config/database";
import {createCategoryService} from "@/app";
import {createApolloServer} from "./graphql";

async function bootstrap(): Promise<void> {
    logger.info('Starting Category API...', { env: config.env, port: config.port });

    // ─── Connect Infrastructure ───────────────────────────────────────────────
    await connectDatabase();
    await connectRedis();

    // ─── Boot Server ──────────────────────────────────────────────────────────
    const apolloServer = createApolloServer();
    const app = await createCategoryService(apolloServer);

    const server = app.listen(config.port, () => {
        logger.info(`🚀 Server ready`, {
            url: `http://localhost:${config.port}/graphql`,
            health: `http://localhost:${config.port}/health`,
            env: config.env,
        });
    });

    // ─── Graceful Shutdown ────────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
        logger.info(`${signal} received. Shutting down gracefully...`);

        server.close(async () => {
            try {
                await apolloServer.stop();
                await disconnectDatabase();
                await disconnectRedis();
                logger.info('Server shut down cleanly');
                process.exit(0);
            } catch (err) {
                logger.error('Error during shutdown', { error: (err as Error).message });
                process.exit(1);
            }
        });

        // Force shutdown after 10s
        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled promise rejection', { reason });
    });

    process.on('uncaughtException', (err) => {
        logger.error('Uncaught exception', { error: err.message, stack: err.stack });
        process.exit(1);
    });
}

bootstrap().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
