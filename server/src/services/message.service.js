import fs from 'node:fs/promises';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { PUBLIC_USER_FIELDS } from '../models/User.js';
import { uploadPathFor } from '../config/uploads.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { idOf } from '../utils/mongo.js';
import { loadForMember } from './conversation.service.js';

const SENDER_POPULATE = { path: 'sender', select: PUBLIC_USER_FIELDS };

const fileExists = (abs) => fs.access(abs).then(() => true, () => false);

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

/**
 * Sends a text or media message. Media must reference a file previously stored by the
 * upload endpoint — arbitrary URLs are rejected so the server never embeds foreign content.
 */
export async function send(conversationId, userId, { type = 'text', content = '', clientId, attachment }) {
  const conversation = await loadForMember(conversationId, userId);

  if (type === 'text' && !content) throw ApiError.badRequest('Message cannot be empty');
  if (type !== 'text') {
    if (!attachment) throw ApiError.badRequest('Attachment is required for media messages');
    const abs = uploadPathFor(attachment.url);
    if (!abs || !(await fileExists(abs))) throw ApiError.badRequest('Attachment not found — upload it first');
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: userId,
    type,
    content,
    clientId,
    attachment: type === 'text' ? undefined : attachment,
  });

  // Atomic update: bump activity and mark the sender as having read their own message.
  await Conversation.updateOne(
    { _id: conversation._id, 'participants.user': userId },
    {
      $set: { lastMessage: message._id, lastMessageAt: message.createdAt },
      $max: { 'participants.$.lastReadAt': message.createdAt, 'participants.$.lastDeliveredAt': message.createdAt },
    },
  );

  await message.populate(SENDER_POPULATE);
  return { message, conversation };
}

/** Soft delete: keeps the row (and ordering) but blanks content and removes the file. Sender only. */
export async function remove(messageId, userId) {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  if (idOf(message.sender) !== String(userId)) throw ApiError.forbidden('You can only delete your own messages');
  if (message.type === 'system') throw ApiError.badRequest('System messages cannot be deleted');

  if (!message.deletedAt) {
    await Message.updateOne(
      { _id: message._id },
      { $set: { deletedAt: new Date(), content: '' }, $unset: { attachment: 1 } },
    );
    const abs = message.attachment?.url ? uploadPathFor(message.attachment.url) : null;
    if (abs) fs.unlink(abs).catch((err) => logger.warn(`Could not remove attachment ${abs}: ${err.message}`));
  }
  return Message.findById(messageId).populate(SENDER_POPULATE);
}
