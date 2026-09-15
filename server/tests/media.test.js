import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { uploadPathFor } from '../src/config/uploads.js';
import { auth, buildApp, clearDB, createUser, startDB, stopDB } from './helpers/setup.js';

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Media uploads and messages', () => {
  let app;
  let alice;
  let bob;
  let conversation;

  before(async () => {
    await startDB();
    app = buildApp();
  });
  after(stopDB);
  beforeEach(async () => {
    await clearDB();
    [alice, bob] = await Promise.all([createUser('alice'), createUser('bob')]);
    const res = await request(app).post('/api/conversations/direct').set(auth(alice.token)).send({ userId: bob.id });
    conversation = res.body.conversation;
  });

  const uploadPng = (as = alice) =>
    request(app).post('/api/uploads').set(auth(as.token)).attach('file', PNG, { filename: 'pixel.png', contentType: 'image/png' });

  it('stores an uploaded image and serves it back', async () => {
    const res = await uploadPng();
    assert.equal(res.status, 201);
    const { attachment } = res.body;
    assert.match(attachment.url, /^\/uploads\/\d{4}-\d{2}\/[0-9a-f-]{36}\.png$/);
    assert.equal(attachment.kind, 'image');
    assert.equal(attachment.mimeType, 'image/png');
    assert.equal(attachment.size, PNG.length);
    assert.equal(attachment.name, 'pixel.png');

    const served = await request(app).get(attachment.url);
    assert.equal(served.status, 200);
    assert.match(served.headers['content-type'], /image\/png/);
    assert.equal(served.headers['cross-origin-resource-policy'], 'cross-origin');
  });

  it('requires authentication and rejects unsupported types', async () => {
    const anonymous = await request(app).post('/api/uploads').attach('file', PNG, { filename: 'p.png', contentType: 'image/png' });
    assert.equal(anonymous.status, 401);

    const html = await request(app)
      .post('/api/uploads')
      .set(auth(alice.token))
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.html', contentType: 'text/html' });
    assert.equal(html.status, 400);
    assert.match(html.body.error.message, /unsupported/i);

    const empty = await request(app).post('/api/uploads').set(auth(alice.token));
    assert.equal(empty.status, 400);
  });

  it('sends an image message with a caption and lists it', async () => {
    const { attachment } = (await uploadPng()).body;
    const sent = await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set(auth(alice.token))
      .send({ type: 'image', content: 'look at this', attachment: { url: attachment.url, name: attachment.name, mimeType: attachment.mimeType, size: attachment.size } });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.message.type, 'image');
    assert.equal(sent.body.message.content, 'look at this');
    assert.equal(sent.body.message.attachment.url, attachment.url);

    const list = await request(app).get(`/api/conversations/${conversation.id}/messages`).set(auth(bob.token));
    assert.equal(list.body.messages[0].attachment.name, 'pixel.png');

    const convs = await request(app).get('/api/conversations').set(auth(bob.token));
    assert.equal(convs.body.conversations[0].lastMessage.type, 'image');
    assert.equal(convs.body.conversations[0].unreadCount, 1);
  });

  it('rejects media messages that do not reference an uploaded file', async () => {
    const foreign = await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set(auth(alice.token))
      .send({ type: 'image', attachment: { url: 'https://evil.example/x.png', name: 'x', mimeType: 'image/png', size: 1 } });
    assert.equal(foreign.status, 400);

    const ghost = await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set(auth(alice.token))
      .send({ type: 'image', attachment: { url: '/uploads/2026-01/00000000-0000-4000-8000-000000000000.png', name: 'x', mimeType: 'image/png', size: 1 } });
    assert.equal(ghost.status, 400);
    assert.match(ghost.body.error.message, /upload it first/i);

    const noAttachment = await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set(auth(alice.token))
      .send({ type: 'video' });
    assert.equal(noAttachment.status, 400);

    const emptyText = await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set(auth(alice.token))
      .send({ type: 'text', content: '   ' });
    assert.equal(emptyText.status, 400);
  });

  it('deleting a media message removes the stored file', async () => {
    const { attachment } = (await uploadPng()).body;
    const abs = uploadPathFor(attachment.url);
    assert.ok(fs.existsSync(abs));

    const sent = await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set(auth(alice.token))
      .send({ type: 'image', attachment: { url: attachment.url, name: attachment.name, mimeType: attachment.mimeType, size: attachment.size } });

    const deleted = await request(app).delete(`/api/messages/${sent.body.message.id}`).set(auth(alice.token));
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.message.attachment, undefined);
    assert.ok(deleted.body.message.deletedAt);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(fs.existsSync(abs), false);
  });
});
