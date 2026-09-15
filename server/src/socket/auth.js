import { extractBearer } from '../middleware/auth.js';
import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';

/** Socket.IO middleware: authenticates the handshake with the same JWT used by the REST API. */
export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token || extractBearer(socket.handshake.headers?.authorization || '');
    if (!token) return next(new Error('Authentication required'));

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select('username displayName');
    if (!user) return next(new Error('User not found'));

    socket.user = { id: String(user._id), username: user.username, displayName: user.displayName };
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
}
