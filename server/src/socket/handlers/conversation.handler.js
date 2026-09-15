import * as conversationService from '../../services/conversation.service.js';
import { conversationIdSchema } from '../../validation/schemas.js';
import * as emit from '../emitters.js';
import { withAck } from '../errors.js';

export function registerConversationHandlers(io, socket) {
  socket.on(
    'conversation:delivered',
    withAck(async (payload) => {
      const { conversationId } = conversationIdSchema.parse(payload);
      const deliveredAt = await conversationService.markDelivered(conversationId, socket.user.id);
      emit.conversationDelivered(io, conversationId, socket.user.id, deliveredAt);
      return { deliveredAt };
    }),
  );

  socket.on(
    'conversation:read',
    withAck(async (payload) => {
      const { conversationId } = conversationIdSchema.parse(payload);
      const readAt = await conversationService.markRead(conversationId, socket.user.id);
      emit.conversationRead(io, conversationId, socket.user.id, readAt);
      return { readAt };
    }),
  );
}
