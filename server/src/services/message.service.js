import fs from 'node:fs/promises';
import Conversation from '../models/Conversation.js';
import Message, { EDIT_WINDOW_MS } from '../models/Message.js';
import { PUBLIC_USER_FIELDS } from '../models/User.js';
import { uploadPathFor } from '../config/uploads.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { escapeRegex, idOf } from '../utils/mongo.js';
import { loadForMember } from './conversation.service.js';

const SENDER_POPULATE = { path: 'sender', select: PUBLIC_USER_FIELDS };
const REPLY_POPULATE = {
  path: 'replyTo',
  select: 'sender type content attachment deletedAt createdAt',
  populate: { path: 'sender', select: 'displayName username' },
};
export const MESSAGE_POPULATE = [SENDER_POPULATE, REPLY_POPULATE];

const fileExists = (abs) => fs.access(abs).then(() => true, () => false);

/** Newest page first from the DB, returned oldest → newest for rendering. */
export async function list(conversationId, userId, { before, limit = 30 } = {}) {
  await loadForMember(conversationId, userId);

  const filter = { conversation: conversationId };
  if (before) filter._id = { $lt: before };

  const docs = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate(MESSAGE_POPULATE);

  const hasMore = docs.length > limit;
  const messages = docs.slice(0, limit).reverse();
  return { messages, hasMore, nextCursor: hasMore ? idOf(messages[0]) : null };
}

/** Case-insensitive search in message text, captions and file names of one conversation. */
export async function search(conversationId, userId, { q, limit = 30 }) {
  await loadForMember(conversationId, userId);
  const pattern = new RegExp(escapeRegex(q), 'i');
  const messages = await Message.find({
    conversation: conversationId,
    deletedAt: null,
    type: { $ne: 'system' },
    $or: [{ content: pattern }, { 'attachment.name': pattern }],
  })
    .sort({ _id: -1 })
    .limit(limit)
    .populate(SENDER_POPULATE);
  return { messages };
}

/**
 * Sends a text or media message, optionally quoting another message of the same conversation.
 * Media must reference a file previously stored by the upload endpoint — arbitrary URLs are
 * rejected so the server never embeds foreign content.
 */
export async function send(conversationId, userId, { type = 'text', content = '', clientId, attachment, replyTo }) {
  const conversation = await loadForMember(conversationId, userId);

  if (type === 'text' && !content) throw ApiError.badRequest('Message cannot be empty');
  if (type !== 'text') {
    if (!attachment) throw ApiError.badRequest('Attachment is required for media messages');
    const abs = uploadPathFor(attachment.url);
    if (!abs || !(await fileExists(abs))) throw ApiError.badRequest('Attachment not found — upload it first');
  }
  if (replyTo && !(await Message.exists({ _id: replyTo, conversation: conversation._id }))) {
    throw ApiError.badRequest('The message you are replying to is not in this conversation');
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: userId,
    type,
    content,
    clientId,
    attachment: type === 'text' ? undefined : attachment,
    replyTo: replyTo || null,
  });

  // Atomic update: bump activity and mark the sender as having read their own message.
  await Conversation.updateOne(
    { _id: conversation._id, 'participants.user': userId },
    {
      $set: { lastMessage: message._id, lastMessageAt: message.createdAt },
      $max: { 'participants.$.lastReadAt': message.createdAt, 'participants.$.lastDeliveredAt': message.createdAt },
    },
  );

  await message.populate(MESSAGE_POPULATE);
  return { message, conversation };
}

/** Toggles the user's reaction: same emoji again removes it, a different one replaces it. */
export async function react(messageId, userId, emoji) {
  const message = await Message.findById(messageId);
  if (!message || message.deletedAt) throw ApiError.notFound('Message not found');
  await loadForMember(message.conversation, userId);

  const existing = message.reactions.find((r) => idOf(r.user) === String(userId));
  const update = existing?.emoji === emoji
    ? { $pull: { reactions: { user: userId } } }
    : existing
      ? { $set: { 'reactions.$[mine].emoji': emoji } }
      : { $push: { reactions: { user: userId, emoji } } };
  const options = existing && existing.emoji !== emoji ? { arrayFilters: [{ 'mine.user': userId }] } : {};
  await Message.updateOne({ _id: message._id }, update, options);

  return Message.findById(messageId).populate(MESSAGE_POPULATE);
}

/** Text messages can be edited by their sender for EDIT_WINDOW_MS after sending. */
export async function edit(messageId, userId, content) {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  if (idOf(message.sender) !== String(userId)) throw ApiError.forbidden('You can only edit your own messages');
  if (message.deletedAt) throw ApiError.badRequest('Deleted messages cannot be edited');
  if (message.type !== 'text') throw ApiError.badRequest('Only text messages can be edited');
  if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
    throw ApiError.badRequest('Messages can only be edited for 15 minutes after sending');
  }

  await Message.updateOne({ _id: message._id }, { $set: { content, editedAt: new Date() } });
  return Message.findById(messageId).populate(MESSAGE_POPULATE);
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
      { $set: { deletedAt: new Date(), content: '', reactions: [] }, $unset: { attachment: 1 } },
    );
    const abs = message.attachment?.url ? uploadPathFor(message.attachment.url) : null;
    if (abs) fs.unlink(abs).catch((err) => logger.warn(`Could not remove attachment ${abs}: ${err.message}`));
  }
  return Message.findById(messageId).populate(MESSAGE_POPULATE);
}
