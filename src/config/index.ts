import dotenv from 'dotenv';

dotenv.config();

const requireEnv = (key: string, fallback?: string): string => {
    const value = process.env[key] ?? fallback;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};

export const config = {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '4000', 10),

    mongodb: {
        uri: requireEnv('MONGODB_URI', 'mongodb://localhost:27017/category_db'),
    },

    redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        ttl: parseInt(process.env.REDIS_TTL ?? '3600', 10),
    },

    logging: {
        level: process.env.LOG_LEVEL ?? 'info',
    },
} as const;
