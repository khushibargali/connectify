import * as conversationService from '../../services/conversation.service.js';
import { conversationIdSchema } from '../../validation/schemas.js';
import * as emit from '../emitters.js';
import { withAck } from '../errors.js';

export function registerConversationHandlers(io, socket) {
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
