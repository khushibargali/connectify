import { rateLimit } from 'express-rate-limit';
import env from '../config/env.js';

/** Slows down credential stuffing on the auth endpoints. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { message: 'Too many attempts, please try again in a few minutes' } },
});
