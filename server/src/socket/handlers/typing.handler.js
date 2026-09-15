import { isValidObjectId } from '../../utils/mongo.js';
import { conversationRoom } from '../rooms.js';

/** Typing indicators are ephemeral: relayed to the room, never persisted. */
export function registerTypingHandlers(_io, socket) {
  const relay = (isTyping) => (payload) => {
    const conversationId = payload?.conversationId;
    if (!isValidObjectId(conversationId)) return;
    const room = conversationRoom(conversationId);
    if (!socket.rooms.has(room)) return; // only members of the conversation
    socket.to(room).emit('typing', { conversationId, userId: socket.user.id, isTyping });
  };

  socket.on('typing:start', relay(true));
  socket.on('typing:stop', relay(false));
}
