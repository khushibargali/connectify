import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

/** Converts any error into a safe message for a socket acknowledgement. */
export function toClientError(err) {
  if (err instanceof ZodError) return err.issues[0]?.message || 'Invalid payload';
  if (err instanceof ApiError) return err.message;
  if (err?.name === 'CastError') return 'Invalid id';
  logger.error('Socket handler error', err);
  return 'Something went wrong';
}

/** Wraps a handler so thrown errors become `{ ok:false, error }` acks instead of crashing the socket. */
export function withAck(handler) {
  return async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const result = await handler(payload ?? {});
      reply({ ok: true, ...result });
    } catch (err) {
      reply({ ok: false, error: toClientError(err) });
    }
  };
}
