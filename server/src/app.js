import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import env from './config/env.js';
import { UPLOAD_DIR, ensureUploadDir } from './config/uploads.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import routes from './routes/index.js';
import { createOriginMatcher } from './utils/origin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

/** Builds the Express application. Socket.IO is attached separately and stored as `app.get('io')`. */
export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Uploaded media is also loaded by the Vercel-hosted client (another origin).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:', 'https:'],
        },
      },
    }),
  );
  const corsOptions = { origin: createOriginMatcher(env.CLIENT_ORIGINS), credentials: true };
  app.use(cors(corsOptions));

  // Uploaded photos, videos, voice notes and documents (file names are random UUIDs).
  ensureUploadDir();
  app.use('/uploads', cors(corsOptions), express.static(UPLOAD_DIR, { index: false, dotfiles: 'deny', maxAge: '7d', immutable: true }));
  app.use(express.json({ limit: '100kb' }));
  if (env.NODE_ENV !== 'test') app.use(requestLogger);

  app.use('/api', routes);

  // In production the API can serve the built SPA so one process is enough.
  if (env.NODE_ENV === 'production' && fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/uploads')) return next();
      return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
