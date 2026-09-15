import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';

let memoryServer = null;

/**
 * Connect to MongoDB. When no URI is configured (local development), fall back to
 * an in-memory MongoDB so the app runs without a local database install.
 */
export async function connectDB(uri = env.MONGO_URI) {
  let target = uri;

  if (!target) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    // Small WiredTiger cache so the fallback also fits on 512 MB hosts (e.g. Render free tier).
    memoryServer = await MongoMemoryServer.create({ instance: { args: ['--wiredTigerCacheSizeGB', '0.25'] } });
    target = memoryServer.getUri('connectify');
    logger.warn('MONGO_URI is not set — using an in-memory MongoDB. Data is lost on restart.');
  }

  await mongoose.connect(target);
  logger.info(`MongoDB connected (${mongoose.connection.host}/${mongoose.connection.name})`);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
