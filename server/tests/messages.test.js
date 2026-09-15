import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { auth, buildApp, clearDB, createUser, startDB, stopDB } from './helpers/setup.js';

describe('Messages API', () => {
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
    const res = await request(app)
      .post('/api/conversations/direct')
      .set(auth(alice.token))
      .send({ userId: bob.id });
    conversation = res.body.conversation;
  });

  const send = (from, content, extra = {}) =>
    request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set(auth(from.token))
      .send({ content, ...extra });

  const list = (as, query = {}) =>
    request(app).get(`/api/conversations/${conversation.id}/messages`).set(auth(as.token)).query(query);

  it('sends and lists messages in chronological order', async () => {
    const first = await send(alice, 'hello', { clientId: 'c-1' });
    assert.equal(first.status, 201);
    assert.equal(first.body.message.content, 'hello');
    assert.equal(first.body.message.clientId, 'c-1');
    assert.equal(first.body.message.sender.username, 'alice');
    assert.equal(first.body.message.conversation, conversation.id);

    await send(bob, 'hi!');

    const res = await list(bob);
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.messages.map((m) => m.content),
      ['hello', 'hi!'],
    );
    assert.equal(res.body.hasMore, false);
  });

  it('paginates backwards with a cursor', async () => {
    for (let i = 1; i <= 5; i += 1) await send(alice, `m${i}`);

    const page1 = await list(alice, { limit: 2 });
    assert.deepEqual(page1.body.messages.map((m) => m.content), ['m4', 'm5']);
    assert.equal(page1.body.hasMore, true);
    assert.ok(page1.body.nextCursor);

    const page2 = await list(alice, { limit: 2, before: page1.body.nextCursor });
    assert.deepEqual(page2.body.messages.map((m) => m.content), ['m2', 'm3']);
    assert.equal(page2.body.hasMore, true);

    const page3 = await list(alice, { limit: 2, before: page2.body.nextCursor });
    assert.deepEqual(page3.body.messages.map((m) => m.content), ['m1']);
    assert.equal(page3.body.hasMore, false);
    assert.equal(page3.body.nextCursor, null);
  });

  it('validates content and query parameters', async () => {
    assert.equal((await send(alice, '   ')).status, 400);
    assert.equal((await send(alice, 'x'.repeat(4001))).status, 400);
    assert.equal((await list(alice, { limit: 0 })).status, 400);
    assert.equal((await list(alice, { before: 'nope' })).status, 400);
  });

  it('forbids non-members from reading or sending', async () => {
    assert.equal((await list(carol)).status, 403);
    assert.equal((await send(carol, 'sneaky')).status, 403);
  });

  it('soft deletes own messages only', async () => {
    const { message } = (await send(alice, 'oops')).body;

    const denied = await request(app).delete(`/api/messages/${message.id}`).set(auth(bob.token));
    assert.equal(denied.status, 403);

    const deleted = await request(app).delete(`/api/messages/${message.id}`).set(auth(alice.token));
    assert.equal(deleted.status, 200);
    assert.ok(deleted.body.message.deletedAt);
    assert.equal(deleted.body.message.content, '');

    const res = await list(bob);
    assert.equal(res.body.messages.length, 1, 'row is kept for ordering');
    assert.ok(res.body.messages[0].deletedAt);

    const missing = await request(app).delete('/api/messages/64b000000000000000000000').set(auth(alice.token));
    assert.equal(missing.status, 404);
  });

  it('updates conversation activity and read markers when sending', async () => {
    await send(alice, 'ping');
    const aliceView = await request(app).get(`/api/conversations/${conversation.id}`).set(auth(alice.token));
    assert.equal(aliceView.body.conversation.lastMessage.content, 'ping');
    assert.equal(aliceView.body.conversation.unreadCount, 0);

    const bobView = await request(app).get(`/api/conversations/${conversation.id}`).set(auth(bob.token));
    assert.equal(bobView.body.conversation.unreadCount, 1);

    const aliceEntry = bobView.body.conversation.participants.find((p) => p.user.id === alice.id);
    assert.ok(new Date(aliceEntry.lastReadAt) >= new Date(aliceView.body.conversation.lastMessageAt));
  });
});
