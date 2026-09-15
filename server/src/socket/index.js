import { Server } from 'socket.io';
import env from '../config/env.js';
import Conversation from '../models/Conversation.js';
import { markAllDelivered } from '../services/conversation.service.js';
import logger from '../utils/logger.js';
import { createOriginMatcher } from '../utils/origin.js';
import { socketAuth } from './auth.js';
import * as emit from './emitters.js';
import { registerConversationHandlers } from './handlers/conversation.handler.js';
import { registerMessageHandlers } from './handlers/message.handler.js';
import { registerTypingHandlers } from './handlers/typing.handler.js';
import { createPresence } from './presence.js';
import { conversationRoom, userRoom } from './rooms.js';

/** Attaches Socket.IO to the HTTP server and wires authentication, rooms, presence and handlers. */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: createOriginMatcher(env.CLIENT_ORIGINS), credentials: true },
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
  });

  const presence = createPresence(io);
  io.presence = presence;

  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const { id: userId, username } = socket.user;

    // Handlers first, synchronously: nothing the client sends after connecting may be dropped.
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerConversationHandlers(io, socket);
    socket.on('disconnect', (reason) => {
      presence.disconnect(socket);
      logger.info(`socket disconnected user=${username} sid=${socket.id} (${reason})`);
    });

    try {
      const conversationIds = await Conversation.distinct('_id', { 'participants.user': userId });
      socket.join([userRoom(userId), ...conversationIds.map((id) => conversationRoom(id))]);
    } catch (err) {
      logger.error('Failed to join rooms', err);
      socket.join(userRoom(userId));
    }

    // presence:list doubles as the "ready" signal: rooms joined, handlers registered.
    presence.connect(socket);
    logger.info(`socket connected user=${username} sid=${socket.id}`);

    // Coming online delivers everything sent while the user was away (✓✓ for the senders).
    try {
      const { conversationIds, deliveredAt } = await markAllDelivered(userId);
      for (const id of conversationIds) emit.conversationDelivered(io, id, userId, deliveredAt);
    } catch (err) {
      logger.error('Failed to mark conversations delivered', err);
    }
  });

  return io;
}
