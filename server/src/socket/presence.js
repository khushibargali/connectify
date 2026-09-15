import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * In-memory presence registry: userId → set of socket ids.
 * A user is online while at least one of their sockets is connected.
 */
export function createPresence(io) {
  const sockets = new Map();

  return {
    onlineUserIds: () => [...sockets.keys()],
    isOnline: (userId) => sockets.has(String(userId)),

    connect(socket) {
      const { id } = socket.user;
      const wasOnline = sockets.has(id);
      if (!wasOnline) sockets.set(id, new Set());
      sockets.get(id).add(socket.id);

      socket.emit('presence:list', this.onlineUserIds());
      if (!wasOnline) socket.broadcast.emit('presence:update', { userId: id, online: true });
    },

    async disconnect(socket) {
      const { id } = socket.user;
      const set = sockets.get(id);
      if (!set) return;
      set.delete(socket.id);
      if (set.size > 0) return;

      sockets.delete(id);
      const lastSeenAt = new Date();
      try {
        await User.updateOne({ _id: id }, { $set: { lastSeenAt } });
      } catch (err) {
        logger.error('Failed to update lastSeenAt', err);
      }
      io.emit('presence:update', { userId: id, online: false, lastSeenAt });
    },
  };
}
