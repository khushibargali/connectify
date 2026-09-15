import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User, { PUBLIC_USER_FIELDS } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { idOf, toObjectId } from '../utils/mongo.js';

export const CONVERSATION_POPULATE = [
  { path: 'participants.user', select: PUBLIC_USER_FIELDS },
  { path: 'lastMessage', populate: { path: 'sender', select: PUBLIC_USER_FIELDS } },
];

const SENDER_POPULATE = { path: 'sender', select: PUBLIC_USER_FIELDS };

function serialize(conversation, unreadCount = 0) {
  const json = conversation.toJSON();
  json.unreadCount = unreadCount;
  return json;
}

/** Unread counts for many conversations in a single aggregation. */
async function unreadCounts(conversations, userId) {
  const counts = new Map();
  if (conversations.length === 0) return counts;

  const clauses = conversations.map((conversation) => {
    const me = conversation.participants.find((p) => idOf(p.user) === String(userId));
    return { conversation: conversation._id, createdAt: { $gt: me?.lastReadAt ?? new Date(0) } };
  });

  const rows = await Message.aggregate([
    { $match: { $or: clauses, sender: { $ne: toObjectId(userId) }, deletedAt: null } },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);

  for (const row of rows) counts.set(String(row._id), row.count);
  return counts;
}

/** Loads a conversation and asserts the user is a member. */
export async function loadForMember(conversationId, userId, { populate = false } = {}) {
  let query = Conversation.findById(conversationId);
  if (populate) query = query.populate(CONVERSATION_POPULATE);
  const conversation = await query;
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!conversation.hasParticipant(userId)) {
    throw ApiError.forbidden('You are not a member of this conversation');
  }
  return conversation;
}

async function appendSystemMessage(conversation, actorId, content) {
  const message = await Message.create({
    conversation: conversation._id,
    sender: actorId,
    type: 'system',
    content,
  });
  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  const actor = conversation.participants.find((p) => idOf(p.user) === String(actorId));
  if (actor) actor.lastReadAt = message.createdAt;
  await conversation.save();
  await message.populate(SENDER_POPULATE);
  return message;
}

export async function listForUser(userId) {
  const conversations = await Conversation.find({ 'participants.user': userId })
    .sort({ lastMessageAt: -1 })
    .populate(CONVERSATION_POPULATE);
  const counts = await unreadCounts(conversations, userId);
  return conversations.map((c) => serialize(c, counts.get(String(c._id)) ?? 0));
}

export async function getForUser(conversationId, userId) {
  const conversation = await loadForMember(conversationId, userId, { populate: true });
  const counts = await unreadCounts([conversation], userId);
  return serialize(conversation, counts.get(String(conversation._id)) ?? 0);
}

/** Returns the existing 1:1 conversation for the pair, or creates it. Idempotent. */
export async function getOrCreateDirect(userId, otherUserId) {
  if (String(userId) === String(otherUserId)) {
    throw ApiError.badRequest('You cannot start a conversation with yourself');
  }
  if (!(await User.exists({ _id: otherUserId }))) throw ApiError.notFound('User not found');

  const directKey = Conversation.directKeyFor(userId, otherUserId);
  let conversation = await Conversation.findOne({ directKey });
  let created = false;

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        type: 'direct',
        directKey,
        createdBy: userId,
        participants: [{ user: userId }, { user: otherUserId }],
      });
      created = true;
    } catch (err) {
      if (err.code !== 11000) throw err; // lost a race: the other user created it first
      conversation = await Conversation.findOne({ directKey });
    }
  }

  await conversation.populate(CONVERSATION_POPULATE);
  const counts = created ? new Map() : await unreadCounts([conversation], userId);
  return { conversation: serialize(conversation, counts.get(String(conversation._id)) ?? 0), created };
}

export async function createGroup(userId, { name, memberIds }) {
  const ids = [...new Set([String(userId), ...memberIds.map(String)])];
  if (ids.length < 2) throw ApiError.badRequest('A group needs at least one other member');

  const found = await User.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw ApiError.notFound('One or more users were not found');

  const conversation = await Conversation.create({
    type: 'group',
    name,
    createdBy: userId,
    admins: [userId],
    participants: ids.map((id) => ({ user: id })),
  });
  const message = await appendSystemMessage(conversation, userId, `created the group "${name}"`);
  await conversation.populate(CONVERSATION_POPULATE);
  return { conversation: serialize(conversation, 0), message };
}

export async function addMembers(conversationId, userId, memberIds) {
  const conversation = await loadForMember(conversationId, userId);
  if (conversation.type !== 'group') throw ApiError.badRequest('Members can only be added to groups');
  if (!conversation.isAdmin(userId)) throw ApiError.forbidden('Only group admins can add members');

  const existing = new Set(conversation.participantIds());
  const newIds = [...new Set(memberIds.map(String))].filter((id) => !existing.has(id));
  if (newIds.length === 0) throw ApiError.badRequest('Those users are already members');

  const users = await User.find({ _id: { $in: newIds } }).select('displayName');
  if (users.length !== newIds.length) throw ApiError.notFound('One or more users were not found');

  conversation.participants.push(...newIds.map((id) => ({ user: id })));
  const names = users.map((u) => u.displayName).join(', ');
  const message = await appendSystemMessage(conversation, userId, `added ${names}`);
  await conversation.populate(CONVERSATION_POPULATE);
  return { conversation: serialize(conversation, 0), message, addedIds: newIds };
}

export async function leave(conversationId, userId) {
  const conversation = await loadForMember(conversationId, userId);
  if (conversation.type !== 'group') throw ApiError.badRequest('You can only leave groups');

  conversation.participants = conversation.participants.filter((p) => idOf(p.user) !== String(userId));
  conversation.admins = conversation.admins.filter((admin) => idOf(admin) !== String(userId));

  if (conversation.participants.length === 0) {
    await Message.deleteMany({ conversation: conversation._id });
    await conversation.deleteOne();
    return { conversation: null, message: null };
  }

  if (conversation.admins.length === 0) conversation.admins.push(conversation.participants[0].user);
  const message = await appendSystemMessage(conversation, userId, 'left the group');
  await conversation.populate(CONVERSATION_POPULATE);
  return { conversation: serialize(conversation, 0), message };
}

/** Admins can rename a group or change its photo. */
export async function update(conversationId, userId, { name, avatarUrl }) {
  const conversation = await loadForMember(conversationId, userId);
  if (conversation.type !== 'group') throw ApiError.badRequest('Only groups can be edited');
  if (!conversation.isAdmin(userId)) throw ApiError.forbidden('Only group admins can edit the group');

  const changes = [];
  if (name !== undefined && name !== conversation.name) {
    conversation.name = name;
    changes.push(`renamed the group to "${name}"`);
  }
  if (avatarUrl !== undefined && avatarUrl !== conversation.avatarUrl) {
    conversation.avatarUrl = avatarUrl;
    changes.push(avatarUrl ? 'changed the group photo' : 'removed the group photo');
  }
  if (changes.length === 0) throw ApiError.badRequest('Nothing changed');

  const message = await appendSystemMessage(conversation, userId, changes.join(' and '));
  await conversation.populate(CONVERSATION_POPULATE);
  return { conversation: serialize(conversation, 0), message };
}

/** Admins can remove another member from a group. */
export async function removeMember(conversationId, adminId, memberId) {
  const conversation = await loadForMember(conversationId, adminId);
  if (conversation.type !== 'group') throw ApiError.badRequest('Members can only be removed from groups');
  if (!conversation.isAdmin(adminId)) throw ApiError.forbidden('Only group admins can remove members');
  if (String(memberId) === String(adminId)) throw ApiError.badRequest('Use "leave" to remove yourself');
  if (!conversation.hasParticipant(memberId)) throw ApiError.notFound('That user is not a member');

  const removed = await User.findById(memberId).select('displayName');
  conversation.participants = conversation.participants.filter((p) => idOf(p.user) !== String(memberId));
  conversation.admins = conversation.admins.filter((admin) => idOf(admin) !== String(memberId));
  const message = await appendSystemMessage(conversation, adminId, `removed ${removed?.displayName || 'a member'}`);
  await conversation.populate(CONVERSATION_POPULATE);
  return { conversation: serialize(conversation, 0), message, removedId: String(memberId) };
}

/** Mutes or unmutes notifications for one member only. */
export async function setMuted(conversationId, userId, muted) {
  const result = await Conversation.updateOne(
    { _id: conversationId, 'participants.user': userId },
    { $set: { 'participants.$.muted': muted } },
  );
  if (result.matchedCount === 0) throw ApiError.notFound('Conversation not found');
  return getForUser(conversationId, userId);
}

/** Moves the member's read marker forward (reading implies delivery). Returns the timestamp used. */
export async function markRead(conversationId, userId) {
  const readAt = new Date();
  const result = await Conversation.updateOne(
    { _id: conversationId, 'participants.user': userId },
    { $max: { 'participants.$.lastReadAt': readAt, 'participants.$.lastDeliveredAt': readAt } },
  );
  if (result.matchedCount === 0) throw ApiError.notFound('Conversation not found');
  return readAt;
}

/** Marks everything in one conversation as delivered to this member (✓✓). */
export async function markDelivered(conversationId, userId) {
  const deliveredAt = new Date();
  const result = await Conversation.updateOne(
    { _id: conversationId, 'participants.user': userId },
    { $max: { 'participants.$.lastDeliveredAt': deliveredAt } },
  );
  if (result.matchedCount === 0) throw ApiError.notFound('Conversation not found');
  return deliveredAt;
}

/** When a user comes online every pending message in their conversations is delivered. */
export async function markAllDelivered(userId) {
  const deliveredAt = new Date();
  const ids = await Conversation.distinct('_id', { 'participants.user': userId });
  if (ids.length > 0) {
    await Conversation.updateMany(
      { _id: { $in: ids }, 'participants.user': userId },
      { $max: { 'participants.$.lastDeliveredAt': deliveredAt } },
    );
  }
  return { conversationIds: ids.map(String), deliveredAt };
}
