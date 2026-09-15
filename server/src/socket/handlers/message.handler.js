import * as messageService from '../../services/message.service.js';
import { sendMessageSocketSchema } from '../../validation/schemas.js';
import * as emit from '../emitters.js';
import { withAck } from '../errors.js';

export function registerMessageHandlers(io, socket) {
  socket.on(
    'message:send',
    withAck(async (payload) => {
      const { conversationId, content, clientId } = sendMessageSocketSchema.parse(payload);
      const { message, conversation } = await messageService.send(conversationId, socket.user.id, {
        content,
        clientId,
      });
      emit.messageCreated(io, message, conversation);
      return { message };
    }),
  );
}
