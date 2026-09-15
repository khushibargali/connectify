import * as messageService from '../services/message.service.js';
import * as emit from '../socket/emitters.js';
import { listMessagesQuerySchema, searchMessagesQuerySchema } from '../validation/schemas.js';

const ioOf = (req) => req.app.get('io');

export async function list(req, res) {
  const query = listMessagesQuerySchema.parse(req.query);
  const result = await messageService.list(req.params.id, req.user._id, query);
  res.json(result);
}

export async function search(req, res) {
  const query = searchMessagesQuerySchema.parse(req.query);
  const result = await messageService.search(req.params.id, req.user._id, query);
  res.json(result);
}

export async function send(req, res) {
  const { message, conversation } = await messageService.send(req.params.id, req.user._id, req.body);
  emit.messageCreated(ioOf(req), message, conversation);
  res.status(201).json({ message });
}

export async function react(req, res) {
  const message = await messageService.react(req.params.id, req.user._id, req.body.emoji);
  emit.messageUpdated(ioOf(req), message);
  res.json({ message });
}

export async function edit(req, res) {
  const message = await messageService.edit(req.params.id, req.user._id, req.body.content);
  emit.messageUpdated(ioOf(req), message);
  res.json({ message });
}

export async function remove(req, res) {
  const message = await messageService.remove(req.params.id, req.user._id);
  emit.messageDeleted(ioOf(req), message);
  res.json({ message });
}
