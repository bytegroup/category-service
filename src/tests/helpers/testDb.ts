// [NEW FILE] Per-suite DB connect/disconnect + collection cleaner
import mongoose from 'mongoose';

export async function connectTestDb(): Promise<void> {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri, {
    // Prevent buffering — fail fast if not connected
    bufferCommands: false,
  });
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();  // close the connection explicitly
  await mongoose.disconnect();        // then disconnect the default connection pool
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}
