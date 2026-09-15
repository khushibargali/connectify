import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { auth, buildApp, clearDB, createUser, startDB, stopDB } from './helpers/setup.js';

describe('Conversations API', () => {
  let app;
  let alice;
  let bob;
  let carol;

  before(async () => {
    await startDB();
    app = buildApp();
  });
  after(stopDB);
  beforeEach(async () => {
    await clearDB();
    [alice, bob, carol] = await Promise.all([createUser('alice'), createUser('bob'), createUser('carol')]);
  });

  const direct = (from, to) =>
    request(app).post('/api/conversations/direct').set(auth(from.token)).send({ userId: to.id });

  const send = (from, conversationId, content) =>
    request(app).post(`/api/conversations/${conversationId}/messages`).set(auth(from.token)).send({ content });

  it('creates a direct conversation once per pair (idempotent from either side)', async () => {
    const first = await direct(alice, bob);
    assert.equal(first.status, 201);
    assert.equal(first.body.conversation.type, 'direct');
    assert.equal(first.body.conversation.participants.length, 2);
    assert.equal(first.body.conversation.participants[1].user.username, 'bob');

    const second = await direct(bob, alice);
    assert.equal(second.status, 200);
    assert.equal(second.body.conversation.id, first.body.conversation.id);
  });

  it('rejects a direct conversation with yourself or an unknown user', async () => {
    const self = await direct(alice, alice);
    assert.equal(self.status, 400);
    const ghost = await request(app)
      .post('/api/conversations/direct')
      .set(auth(alice.token))
      .send({ userId: '64b000000000000000000000' });
    assert.equal(ghost.status, 404);
  });

  it('lists conversations by activity with unread counts', async () => {
    const withBob = (await direct(alice, bob)).body.conversation;
    const withCarol = (await direct(alice, carol)).body.conversation;

    await send(bob, withBob.id, 'one');
    await send(bob, withBob.id, 'two');

    const list = await request(app).get('/api/conversations').set(auth(alice.token));
    assert.equal(list.status, 200);
    assert.equal(list.body.conversations.length, 2);
    assert.equal(list.body.conversations[0].id, withBob.id, 'most recent activity first');
    assert.equal(list.body.conversations[0].unreadCount, 2);
    assert.equal(list.body.conversations[0].lastMessage.content, 'two');
    assert.equal(list.body.conversations[1].id, withCarol.id);
    assert.equal(list.body.conversations[1].unreadCount, 0);

    const bobList = await request(app).get('/api/conversations').set(auth(bob.token));
    assert.equal(bobList.body.conversations[0].unreadCount, 0, 'senders have read their own messages');

    const read = await request(app).post(`/api/conversations/${withBob.id}/read`).set(auth(alice.token));
    assert.equal(read.status, 200);
    assert.ok(read.body.readAt);

    const after = await request(app).get('/api/conversations').set(auth(alice.token));
    assert.equal(after.body.conversations[0].unreadCount, 0);
  });

  it('creates a group with the creator as admin and a system message', async () => {
    const res = await request(app)
      .post('/api/conversations/group')
      .set(auth(alice.token))
      .send({ name: 'Team', memberIds: [bob.id, carol.id] });
    assert.equal(res.status, 201);
    const group = res.body.conversation;
    assert.equal(group.type, 'group');
    assert.equal(group.name, 'Team');
    assert.equal(group.participants.length, 3);
    assert.deepEqual(group.admins, [alice.id]);
    assert.equal(group.lastMessage.type, 'system');
    assert.equal(group.lastMessage.sender.username, 'alice');

    const bobList = await request(app).get('/api/conversations').set(auth(bob.token));
    assert.equal(bobList.body.conversations[0].id, group.id);
    assert.equal(bobList.body.conversations[0].unreadCount, 1);
  });

  it('only admins can add members; members can leave', async () => {
    const group = (
      await request(app)
        .post('/api/conversations/group')
        .set(auth(alice.token))
        .send({ name: 'Team', memberIds: [bob.id] })
    ).body.conversation;

    const denied = await request(app)
      .post(`/api/conversations/${group.id}/members`)
      .set(auth(bob.token))
      .send({ memberIds: [carol.id] });
    assert.equal(denied.status, 403);

    const added = await request(app)
      .post(`/api/conversations/${group.id}/members`)
      .set(auth(alice.token))
      .send({ memberIds: [carol.id] });
    assert.equal(added.status, 200);
    assert.equal(added.body.conversation.participants.length, 3);
    assert.match(added.body.conversation.lastMessage.content, /added Carol/);

    const left = await request(app).delete(`/api/conversations/${group.id}/members/me`).set(auth(carol.token));
    assert.equal(left.status, 200);

    const fetched = await request(app).get(`/api/conversations/${group.id}`).set(auth(alice.token));
    assert.equal(fetched.body.conversation.participants.length, 2);
    assert.match(fetched.body.conversation.lastMessage.content, /left the group/);

    const gone = await request(app).get(`/api/conversations/${group.id}`).set(auth(carol.token));
    assert.equal(gone.status, 403);
  });

  it('forbids non-members and validates ids', async () => {
    const conversation = (await direct(alice, bob)).body.conversation;
    const forbidden = await request(app).get(`/api/conversations/${conversation.id}`).set(auth(carol.token));
    assert.equal(forbidden.status, 403);

    const invalid = await request(app).get('/api/conversations/not-an-id').set(auth(alice.token));
    assert.equal(invalid.status, 400);

    const missing = await request(app)
      .get('/api/conversations/64b000000000000000000000')
      .set(auth(alice.token));
    assert.equal(missing.status, 404);
  });
});
