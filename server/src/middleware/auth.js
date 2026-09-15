import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { verifyToken } from '../utils/jwt.js';

export function extractBearer(header = '') {
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

/** Verifies the JWT and attaches the current user document to `req.user`. */
export async function requireAuth(req, _res, next) {
  const token = extractBearer(req.headers.authorization);
  if (!token) throw ApiError.unauthorized('Authentication required');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists');

  req.user = user;
  next();
}
