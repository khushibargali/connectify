import { ZodError } from 'zod';
import env from '../config/env.js';
import logger from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.originalUrl} not found` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path || 'value'}`;
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors || {}).map((e) => ({ path: e.path, message: e.message }));
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `That ${field} is already taken` : 'Duplicate value';
  } else if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${env.MAX_UPLOAD_MB} MB)` : `Upload failed: ${err.message}`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  }

  if (status >= 500) {
    logger.error(err);
    if (env.NODE_ENV === 'production') message = 'Internal server error';
  }

  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}
