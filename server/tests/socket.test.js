import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import {
  auth,
  clearDB,
  connectReady,
  createUser,
  emitWithAck,
  listen,
  once,
  socketClient,
  startDB,
  stopDB,
  wait,
} from './helpers/setup.js';

describe('Socket.IO real-time layer', () => {
  let srv;
  let alice;
  let bob;
  let carol;
  let conversation;
  const open = [];

  const track = (socket) => {
    open.push(socket);
    return socket;
  };

  before(async () => {
    await startDB();
    srv = await listen();
  });
  after(async () => {
    await srv.close();
    await stopDB();
  });
  beforeEach(async () => {
    await clearDB();
    [alice, bob, carol] = await Promise.all([createUser('alice'), createUser('bob'), createUser('carol')]);
    const res = await request(srv.app)
      .post('/api/conversations/direct')
      .set(auth(alice.token))
      .send({ userId: bob.id });
    conversation = res.body.conversation;
  });
  afterEach(async () => {
    for (const socket of open.splice(0)) socket.close();
    await wait(50);
  });

  it('rejects connections without a valid token', async () => {
    const socket = track(socketClient(srv.url, 'garbage'));
    const err = await once(socket, 'connect_error');
    assert.match(err.message, /token/i);

    const anonymous = track(socketClient(srv.url, undefined));
    const err2 = await once(anonymous, 'connect_error');
    assert.match(err2.message, /authentication required/i);
  });

  it('delivers messages in real time with an ack, a broadcast and a notification', async () => {
    const a = track(await connectReady(srv.url, alice.token));
    const b = track(await connectReady(srv.url, bob.token));

    const received = once(b, 'message:new');
    const notified = once(b, 'notification');

    const ack = await emitWithAck(a, 'message:send', {
      conversationId: conversation.id,
      content: 'hello bob',
      clientId: 'c-1',
    });
    assert.equal(ack.ok, true);
    assert.equal(ack.message.content, 'hello bob');
    assert.equal(ack.message.clientId, 'c-1');
    assert.equal(ack.message.sender.username, 'alice');

    const message = await received;
    assert.equal(message.id, ack.message.id);

    const note = await notified;
    assert.equal(note.type, 'message');
    assert.equal(note.conversationId, conversation.id);
    assert.equal(note.message.id, ack.message.id);

    const stored = await request(srv.app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set(auth(bob.token));
    assert.equal(stored.body.messages.length, 1);
    assert.equal(stored.body.messages[0].content, 'hello bob');
  });

  it('does not notify the sender and does not deliver to non-members', async () => {
    const a = track(await connectReady(srv.url, alice.token));
    const c = track(await connectReady(srv.url, carol.token));

    let senderNotified = false;
    let outsiderReceived = false;
    a.on('notification', () => {
      senderNotified = true;
    });
    c.on('message:new', () => {
      outsiderReceived = true;
    });

    const ack = await emitWithAck(a, 'message:send', { conversationId: conversation.id, content: 'private' });
    assert.equal(ack.ok, true);
    await wait(150);
    assert.equal(senderNotified, false);
    assert.equal(outsiderReceived, false);

    const denied = await emitWithAck(c, 'message:send', { conversationId: conversation.id, content: 'intruder' });
    assert.equal(denied.ok, false);
    assert.match(denied.error, /member/i);
  });

  it('sends media messages over the socket with the attachment intact', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const uploaded = await request(srv.app)
      .post('/api/uploads')
      .set(auth(alice.token))
      .attach('file', png, { filename: 'pixel.png', contentType: 'image/png' });
    assert.equal(uploaded.status, 201);
    const { url, name, mimeType, size } = uploaded.body.attachment;

    const a = track(await connectReady(srv.url, alice.token));
    const b = track(await connectReady(srv.url, bob.token));
    const received = once(b, 'message:new');
    const ack = await emitWithAck(a, 'message:send', {
      conversationId: conversation.id,
      type: 'image',
      content: 'look',
      attachment: { url, name, mimeType, size },
    });
    assert.equal(ack.ok, true, ack.error);
    assert.equal(ack.message.type, 'image');
    assert.equal(ack.message.attachment.url, url);
    const message = await received;
    assert.equal(message.type, 'image');
    assert.equal(message.attachment.name, 'pixel.png');
    assert.equal(message.content, 'look');

    const rejected = await emitWithAck(a, 'message:send', { conversationId: conversation.id, type: 'file' });
    assert.equal(rejected.ok, false);
  });

  it('returns error acks for invalid payloads', async () => {
    const a = track(await connectReady(srv.url, alice.token));
    const empty = await emitWithAck(a, 'message:send', { conversationId: conversation.id, content: '  ' });
    assert.equal(empty.ok, false);
    assert.ok(typeof empty.error === 'string');

    const badId = await emitWithAck(a, 'message:send', { conversationId: 'nope', content: 'x' });
    assert.equal(badId.ok, false);
  });

  it('relays typing indicators to other members only', async () => {
    const a = track(await connectReady(srv.url, alice.token));
    const b = track(await connectReady(srv.url, bob.token));

    let echoed = false;
    a.on('typing', () => {
      echoed = true;
    });

    const typing = once(b, 'typing');
    a.emit('typing:start', { conversationId: conversation.id });
    const payload = await typing;
    assert.deepEqual(payload, { conversationId: conversation.id, userId: alice.id, isTyping: true });

    const stopped = once(b, 'typing');
    a.emit('typing:stop', { conversationId: conversation.id });
    assert.equal((await stopped).isTyping, false);
    assert.equal(echoed, false, 'typing is not echoed to the sender');
  });

  it('broadcasts read receipts', async () => {
    const a = track(await connectReady(srv.url, alice.token));
    const b = track(await connectReady(srv.url, bob.token));
    await emitWithAck(a, 'message:send', { conversationId: conversation.id, content: 'read me' });

    const receipt = once(a, 'conversation:read');
    const ack = await emitWithAck(b, 'conversation:read', { conversationId: conversation.id });
    assert.equal(ack.ok, true);
    assert.ok(ack.readAt);

    const payload = await receipt;
    assert.equal(payload.conversationId, conversation.id);
    assert.equal(payload.userId, bob.id);

    const view = await request(srv.app).get('/api/conversations').set(auth(bob.token));
    assert.equal(view.body.conversations[0].unreadCount, 0);
  });

  it('tracks presence across connect and disconnect', async () => {
    const a = track(socketClient(srv.url, alice.token));
    const initial = await once(a, 'presence:list');
    assert.ok(initial.includes(alice.id));

    const online = once(a, 'presence:update');
    const b = track(await connectReady(srv.url, bob.token));
    assert.deepEqual(await online, { userId: bob.id, online: true });

    const offline = once(a, 'presence:update');
    b.close();
    const payload = await offline;
    assert.equal(payload.userId, bob.id);
    assert.equal(payload.online, false);
    assert.ok(payload.lastSeenAt);
  });

  it('marks messages delivered when the recipient comes online or receives them', async () => {
    const a = track(await connectReady(srv.url, alice.token));
    await emitWithAck(a, 'message:send', { conversationId: conversation.id, content: 'are you there?' });

    const delivered = once(a, 'conversation:delivered');
    const b = track(await connectReady(srv.url, bob.token));
    const onConnect = await delivered;
    assert.equal(onConnect.conversationId, conversation.id);
    assert.equal(onConnect.userId, bob.id);
    assert.ok(onConnect.deliveredAt);

    const explicit = once(a, 'conversation:delivered');
    const ack = await emitWithAck(b, 'conversation:delivered', { conversationId: conversation.id });
    assert.equal(ack.ok, true);
    assert.equal((await explicit).userId, bob.id);

    const view = await request(srv.app).get(`/api/conversations/${conversation.id}`).set(auth(alice.token));
    const bobEntry = view.body.conversation.participants.find((p) => p.user.id === bob.id);
    assert.ok(new Date(bobEntry.lastDeliveredAt) >= new Date(view.body.conversation.lastMessageAt));
  });

  it('joins new conversations live so both sides receive conversation:new and later messages', async () => {
    const a = track(await connectReady(srv.url, alice.token));
    const c = track(await connectReady(srv.url, carol.token));

    const carolSeesNew = once(c, 'conversation:new');
    const created = await request(srv.app)
      .post('/api/conversations/direct')
      .set(auth(alice.token))
      .send({ userId: carol.id });
    assert.equal(created.status, 201);
    const fresh = await carolSeesNew;
    assert.equal(fresh.id, created.body.conversation.id);

    const delivered = once(a, 'message:new');
    const ack = await emitWithAck(c, 'message:send', { conversationId: fresh.id, content: 'hi alice' });
    assert.equal(ack.ok, true);
    assert.equal((await delivered).content, 'hi alice');
  });
});
