import { idOf } from '../utils/mongo.js';
import { conversationRoom, userRoom } from './rooms.js';

/**
 * All server → client broadcasts live here so REST controllers and socket handlers
 * produce identical events. Every function is a no-op when `io` is absent (unit tests).
 */

const participantIds = (conversation) => (conversation?.participants ?? []).map((p) => idOf(p.user));

export function messageCreated(io, message, conversation) {
  if (!io) return;
  const conversationId = idOf(conversation);
  const senderId = idOf(message.sender);

  io.to(conversationRoom(conversationId)).emit('message:new', message);

  for (const userId of participantIds(conversation)) {
    if (userId === senderId) continue;
    io.to(userRoom(userId)).emit('notification', { type: 'message', conversationId, message });
  }
}

export function messageDeleted(io, message) {
  if (!io) return;
  const conversationId = idOf(message.conversation);
  io.to(conversationRoom(conversationId)).emit('message:deleted', { conversationId, messageId: idOf(message) });
}

export function conversationCreated(io, conversation) {
  if (!io) return;
  const rooms = participantIds(conversation).map(userRoom);
  io.in(rooms).socketsJoin(conversationRoom(idOf(conversation)));
  io.to(rooms).emit('conversation:new', conversation);
}

export function membersAdded(io, conversation, message, addedIds) {
  if (!io) return;
  const conversationId = idOf(conversation);
  const room = conversationRoom(conversationId);
  const addedRooms = addedIds.map(userRoom);

  io.in(addedRooms).socketsJoin(room);
  io.to(participantIds(conversation).map(userRoom)).emit('conversation:updated', conversation);
  if (message) io.to(room).emit('message:new', message);
  io.to(addedRooms).emit('notification', { type: 'conversation:added', conversationId, conversation });
}

export function memberLeft(io, conversationId, userId, conversation, message) {
  if (!io) return;
  const id = String(conversationId);
  const room = conversationRoom(id);

  io.in(userRoom(userId)).socketsLeave(room);
  io.to(userRoom(userId)).emit('conversation:removed', { conversationId: id });

  if (conversation) {
    io.to(room).emit('conversation:updated', conversation);
    if (message) io.to(room).emit('message:new', message);
  }
}

export function conversationRead(io, conversationId, userId, readAt) {
  if (!io) return;
  io.to(conversationRoom(String(conversationId))).emit('conversation:read', {
    conversationId: String(conversationId),
    userId: String(userId),
    readAt,
  });
}
