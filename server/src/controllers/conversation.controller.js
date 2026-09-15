import * as conversationService from '../services/conversation.service.js';
import * as emit from '../socket/emitters.js';

const ioOf = (req) => req.app.get('io');

export async function list(req, res) {
  const conversations = await conversationService.listForUser(req.user._id);
  res.json({ conversations });
}

export async function getOne(req, res) {
  const conversation = await conversationService.getForUser(req.params.id, req.user._id);
  res.json({ conversation });
}

export async function createDirect(req, res) {
  const { conversation, created } = await conversationService.getOrCreateDirect(req.user._id, req.body.userId);
  if (created) emit.conversationCreated(ioOf(req), conversation);
  res.status(created ? 201 : 200).json({ conversation });
}

export async function createGroup(req, res) {
  const { conversation } = await conversationService.createGroup(req.user._id, req.body);
  emit.conversationCreated(ioOf(req), conversation);
  res.status(201).json({ conversation });
}

export async function addMembers(req, res) {
  const { conversation, message, addedIds } = await conversationService.addMembers(
    req.params.id,
    req.user._id,
    req.body.memberIds,
  );
  emit.membersAdded(ioOf(req), conversation, message, addedIds);
  res.json({ conversation });
}

export async function update(req, res) {
  const { conversation, message } = await conversationService.update(req.params.id, req.user._id, req.body);
  const io = ioOf(req);
  if (io) {
    io.to(`conversation:${conversation.id}`).emit('conversation:updated', conversation);
    io.to(`conversation:${conversation.id}`).emit('message:new', message);
  }
  res.json({ conversation });
}

export async function removeMember(req, res) {
  const { conversation, message, removedId } = await conversationService.removeMember(
    req.params.id,
    req.user._id,
    req.params.userId,
  );
  emit.memberRemoved(ioOf(req), conversation, message, removedId);
  res.json({ conversation });
}

export async function mute(req, res) {
  const conversation = await conversationService.setMuted(req.params.id, req.user._id, req.body.muted);
  res.json({ conversation });
}

export async function leave(req, res) {
  const { conversation, message } = await conversationService.leave(req.params.id, req.user._id);
  emit.memberLeft(ioOf(req), req.params.id, req.user._id, conversation, message);
  res.json({ ok: true });
}

export async function markRead(req, res) {
  const readAt = await conversationService.markRead(req.params.id, req.user._id);
  emit.conversationRead(ioOf(req), req.params.id, req.user._id, readAt);
  res.json({ readAt });
}
