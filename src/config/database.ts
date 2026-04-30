import mongoose from 'mongoose';
import { config } from './index';
import {logger} from "@/utils/logger";

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('connected', () =>
    logger.info('MongoDB connection established')
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB connection lost')
  );
  mongoose.connection.on('error', (err) =>
    logger.error('MongoDB connection error', { error: err.message })
  );

  await mongoose.connect(config.mongodb.uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45001,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
