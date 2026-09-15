import http from 'node:http';
import { seedDemoData } from '../scripts/seed.js';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import env from './config/env.js';
import { initSocket } from './socket/index.js';
import logger from './utils/logger.js';

async function main() {
  await connectDB();
  if (env.SEED_DEMO) await seedDemoData();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);
  app.set('io', io);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${env.PORT} is already in use. Set PORT in server/.env to another value (e.g. 4001).`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(env.PORT, () => {
    logger.info(`Connectify API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down`);
    io.close();
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
