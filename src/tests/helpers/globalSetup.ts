// [NEW FILE] Jest global setup — starts in-memory MongoDB before all tests
import { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  var __MONGOD__: MongoMemoryServer;
}

export default async function globalSetup(): Promise<void> {
  const mongod = await MongoMemoryServer.create();
  global.__MONGOD__ = mongod;
  process.env.MONGODB_URI = `${mongod.getUri()}?retryWrites=false`;
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
}
