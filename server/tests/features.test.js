import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import Message from '../src/models/Message.js';
import { auth, buildApp, clearDB, createUser, startDB, stopDB } from './helpers/setup.js';

describe('Reactions, replies, edits, search, group management and mute', () => {
  let app;
  let alice;
  let bob;
  let carol;
  let conversation;

  before(async () => {
    await startDB();
    app = buildApp();
  });
  after(stopDB);
  beforeEach(async () => {
    await clearDB();
    [alice, bob, carol] = await Promise.all([createUser('alice'), createUser('bob'), createUser('carol')]);
    const res = await request(app).post('/api/conversations/direct').set(auth(alice.token)).send({ userId: bob.id });
    conversation = res.body.conversation;
  });

  const send = (from, content, extra = {}) =>
    request(app).post(`/api/conversations/${conversation.id}/messages`).set(auth(from.token)).send({ content, ...extra });

  it('toggles and replaces reactions, one per user', async () => {
    const { message } = (await send(alice, 'react to me')).body;

    const liked = await request(app).put(`/api/messages/${message.id}/reactions`).set(auth(bob.token)).send({ emoji: '👍' });
    assert.equal(liked.status, 200);
    assert.deepEqual(liked.body.message.reactions.map((r) => r.emoji), ['👍']);

    const replaced = await request(app).put(`/api/messages/${message.id}/reactions`).set(auth(bob.token)).send({ emoji: '❤️' });
    assert.deepEqual(replaced.body.message.reactions.map((r) => r.emoji), ['❤️']);

    const alsoAlice = await request(app).put(`/api/messages/${message.id}/reactions`).set(auth(alice.token)).send({ emoji: '❤️' });
    assert.equal(alsoAlice.body.message.reactions.length, 2);

    const removed = await request(app).put(`/api/messages/${message.id}/reactions`).set(auth(bob.token)).send({ emoji: '❤️' });
    assert.equal(removed.body.message.reactions.length, 1);
    assert.equal(removed.body.message.reactions[0].user, alice.id);

    const notEmoji = await request(app).put(`/api/messages/${message.id}/reactions`).set(auth(bob.token)).send({ emoji: 'lol' });
    assert.equal(notEmoji.status, 400);

    const outsider = await request(app).put(`/api/messages/${message.id}/reactions`).set(auth(carol.token)).send({ emoji: '👍' });
    assert.equal(outsider.status, 403);
  });

  it('quotes another message of the same conversation', async () => {
    const { message: original } = (await send(alice, 'original')).body;
    const reply = await send(bob, 'replying', { replyTo: original.id });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.message.replyTo.id, original.id);
    assert.equal(reply.body.message.replyTo.content, 'original');
    assert.equal(reply.body.message.replyTo.sender.displayName, 'Alice');

    const other = await request(app).post('/api/conversations/direct').set(auth(alice.token)).send({ userId: carol.id });
    const foreign = await request(app)
      .post(`/api/conversations/${other.body.conversation.id}/messages`)
      .set(auth(alice.token))
      .send({ content: 'nope', replyTo: original.id });
    assert.equal(foreign.status, 400);

    const list = await request(app).get(`/api/conversations/${conversation.id}/messages`).set(auth(bob.token));
    assert.equal(list.body.messages[1].replyTo.content, 'original', 'quotes are populated in history too');
  });

  it('lets the sender edit text messages for 15 minutes', async () => {
    const { message } = (await send(alice, 'typo')).body;

    const edited = await request(app).patch(`/api/messages/${message.id}`).set(auth(alice.token)).send({ content: 'fixed' });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.message.content, 'fixed');
    assert.ok(edited.body.message.editedAt);

    const notMine = await request(app).patch(`/api/messages/${message.id}`).set(auth(bob.token)).send({ content: 'hijack' });
    assert.equal(notMine.status, 403);

    const empty = await request(app).patch(`/api/messages/${message.id}`).set(auth(alice.token)).send({ content: '   ' });
    assert.equal(empty.status, 400);

    // Mongoose treats createdAt as immutable, so back-date through the raw driver.
    await Message.collection.updateOne({ _id: new mongoose.Types.ObjectId(message.id) }, { $set: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } });
    const tooLate = await request(app).patch(`/api/messages/${message.id}`).set(auth(alice.token)).send({ content: 'late' });
    assert.equal(tooLate.status, 400);
    assert.match(tooLate.body.error.message, /15 minutes/);
  });

  it('searches message text and file names within a conversation', async () => {
    await send(alice, 'Deploy the API tonight');
    await send(bob, 'deploy tomorrow instead');
    await send(alice, 'unrelated');

    const found = await request(app).get(`/api/conversations/${conversation.id}/messages/search?q=deploy`).set(auth(bob.token));
    assert.equal(found.status, 200);
    assert.deepEqual(found.body.messages.map((m) => m.content), ['deploy tomorrow instead', 'Deploy the API tonight']);

    const empty = await request(app).get(`/api/conversations/${conversation.id}/messages/search?q=`).set(auth(bob.token));
    assert.equal(empty.status, 400);

    const outsider = await request(app).get(`/api/conversations/${conversation.id}/messages/search?q=deploy`).set(auth(carol.token));
    assert.equal(outsider.status, 403);
  });

  it('admins can rename a group, change its photo and remove members', async () => {
    const group = (
      await request(app).post('/api/conversations/group').set(auth(alice.token)).send({ name: 'Team', memberIds: [bob.id, carol.id] })
    ).body.conversation;

    const denied = await request(app).patch(`/api/conversations/${group.id}`).set(auth(bob.token)).send({ name: 'Hijacked' });
    assert.equal(denied.status, 403);

    const renamed = await request(app)
      .patch(`/api/conversations/${group.id}`)
      .set(auth(alice.token))
      .send({ name: 'Core Team', avatarUrl: '/uploads/2026-01/group.png' });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.conversation.name, 'Core Team');
    assert.equal(renamed.body.conversation.avatarUrl, '/uploads/2026-01/group.png');
    assert.match(renamed.body.conversation.lastMessage.content, /renamed the group to "Core Team" and changed the group photo/);

    const notAdmin = await request(app).delete(`/api/conversations/${group.id}/members/${carol.id}`).set(auth(bob.token));
    assert.equal(notAdmin.status, 403);

    const removed = await request(app).delete(`/api/conversations/${group.id}/members/${carol.id}`).set(auth(alice.token));
    assert.equal(removed.status, 200);
    assert.equal(removed.body.conversation.participants.length, 2);
    assert.match(removed.body.conversation.lastMessage.content, /removed Carol/);

    const gone = await request(app).get(`/api/conversations/${group.id}`).set(auth(carol.token));
    assert.equal(gone.status, 403);

    const self = await request(app).delete(`/api/conversations/${group.id}/members/${alice.id}`).set(auth(alice.token));
    assert.equal(self.status, 400);

    const direct = await request(app).patch(`/api/conversations/${conversation.id}`).set(auth(alice.token)).send({ name: 'x' });
    assert.equal(direct.status, 400);
  });

  it('mutes a conversation for one member only', async () => {
    const muted = await request(app).post(`/api/conversations/${conversation.id}/mute`).set(auth(bob.token)).send({ muted: true });
    assert.equal(muted.status, 200);
    const bobEntry = muted.body.conversation.participants.find((p) => p.user.id === bob.id);
    const aliceEntry = muted.body.conversation.participants.find((p) => p.user.id === alice.id);
    assert.equal(bobEntry.muted, true);
    assert.equal(aliceEntry.muted, false);

    const unmuted = await request(app).post(`/api/conversations/${conversation.id}/mute`).set(auth(bob.token)).send({ muted: false });
    assert.equal(unmuted.body.conversation.participants.find((p) => p.user.id === bob.id).muted, false);
  });
});
