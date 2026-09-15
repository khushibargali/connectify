import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { PUBLIC_USER_FIELDS } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { idOf } from '../utils/mongo.js';
import { loadForMember } from './conversation.service.js';

const SENDER_POPULATE = { path: 'sender', select: PUBLIC_USER_FIELDS };

/** Newest page first from the DB, returned oldest → newest for rendering. */
export async function list(conversationId, userId, { before, limit = 30 } = {}) {
  await loadForMember(conversationId, userId);

  const filter = { conversation: conversationId };
  if (before) filter._id = { $lt: before };

  const docs = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate(SENDER_POPULATE);

  const hasMore = docs.length > limit;
  const messages = docs.slice(0, limit).reverse();
  return { messages, hasMore, nextCursor: hasMore ? idOf(messages[0]) : null };
}

export async function send(conversationId, userId, { content, clientId }) {
  const conversation = await loadForMember(conversationId, userId);

  const message = await Message.create({ conversation: conversation._id, sender: userId, content, clientId });

  // Atomic update: bump activity and mark the sender as having read their own message.
  await Conversation.updateOne(
    { _id: conversation._id, 'participants.user': userId },
    {
      $set: { lastMessage: message._id, lastMessageAt: message.createdAt },
      $max: { 'participants.$.lastReadAt': message.createdAt },
    },
  );

  await message.populate(SENDER_POPULATE);
  return { message, conversation };
}

/** Soft delete: keeps the row (and ordering) but blanks the content. Sender only. */
export async function remove(messageId, userId) {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  if (idOf(message.sender) !== String(userId)) throw ApiError.forbidden('You can only delete your own messages');
  if (message.type === 'system') throw ApiError.badRequest('System messages cannot be deleted');

  if (!message.deletedAt) {
    await Message.updateOne({ _id: message._id }, { $set: { deletedAt: new Date(), content: '' } });
  }
  const updated = await Message.findById(messageId).populate(SENDER_POPULATE);
  return updated;
}
