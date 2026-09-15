import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { auth, buildApp, clearDB, createUser, startDB, stopDB } from './helpers/setup.js';

const payload = { displayName: 'Alice Johnson', phone: '+1 (555) 010-0001', password: 'password123' };

describe('Auth API', () => {
  let app;

  before(async () => {
    await startDB();
    app = buildApp();
  });
  after(stopDB);
  beforeEach(clearDB);

  it('registers with a phone number, normalises it and generates a username', async () => {
    const res = await request(app).post('/api/auth/register').send(payload);
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.phone, '+15550100001');
    assert.equal(res.body.user.displayName, 'Alice Johnson');
    assert.equal(res.body.user.username, 'alice_johnson');
    assert.equal(res.body.user.email, undefined);
    assert.equal(res.body.user.passwordHash, undefined);
    assert.ok(res.body.user.id);
  });

  it('accepts optional username and email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, username: 'Alice', email: 'Alice@Test.dev' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.username, 'alice');
    assert.equal(res.body.user.email, 'alice@test.dev');
  });

  it('rejects invalid payloads with field details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ displayName: '', phone: '12', password: 'short', email: 'nope' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Validation failed');
    const paths = res.body.error.details.map((d) => d.path);
    for (const field of ['displayName', 'phone', 'password', 'email']) assert.ok(paths.includes(field), field);
  });

  it('rejects duplicate phone numbers, usernames and emails', async () => {
    await request(app).post('/api/auth/register').send({ ...payload, username: 'alice', email: 'alice@test.dev' });

    const dupPhone = await request(app).post('/api/auth/register').send({ ...payload, displayName: 'Other' });
    assert.equal(dupPhone.status, 409);
    assert.match(dupPhone.body.error.message, /phone/i);

    const dupUser = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, phone: '+15550100002', username: 'alice' });
    assert.equal(dupUser.status, 409);
    assert.match(dupUser.body.error.message, /username/i);

    const dupEmail = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, phone: '+15550100003', email: 'alice@test.dev' });
    assert.equal(dupEmail.status, 409);
    assert.match(dupEmail.body.error.message, /email/i);
  });

  it('generates a distinct username when the preferred one is taken', async () => {
    const first = await request(app).post('/api/auth/register').send(payload);
    const second = await request(app).post('/api/auth/register').send({ ...payload, phone: '+15550100009' });
    assert.equal(second.status, 201);
    assert.notEqual(second.body.user.username, first.body.user.username);
    assert.match(second.body.user.username, /^alice_johnson_\d{4}$/);
  });

  it('logs in with phone, username or email', async () => {
    await request(app).post('/api/auth/register').send({ ...payload, username: 'alice', email: 'alice@test.dev' });

    const byPhone = await request(app).post('/api/auth/login').send({ identifier: '555 010 0001', password: 'password123' });
    assert.equal(byPhone.status, 401, 'a number without country code is not the same account');

    const byFullPhone = await request(app).post('/api/auth/login').send({ identifier: '+1 555-010-0001', password: 'password123' });
    assert.equal(byFullPhone.status, 200);
    assert.ok(byFullPhone.body.token);

    const byUsername = await request(app).post('/api/auth/login').send({ identifier: 'ALICE', password: 'password123' });
    assert.equal(byUsername.status, 200);

    const byEmail = await request(app).post('/api/auth/login').send({ identifier: 'alice@test.dev', password: 'password123' });
    assert.equal(byEmail.status, 200);
    assert.equal(byEmail.body.user.username, 'alice');
  });

  it('rejects wrong passwords and unknown users', async () => {
    await request(app).post('/api/auth/register').send(payload);
    const wrong = await request(app).post('/api/auth/login').send({ identifier: '+15550100001', password: 'nope-nope' });
    assert.equal(wrong.status, 401);
    const unknown = await request(app).post('/api/auth/login').send({ identifier: 'ghost', password: 'whatever' });
    assert.equal(unknown.status, 401);
  });

  it('returns the current user from /me and rejects bad tokens', async () => {
    const { token } = await createUser('bob');
    const ok = await request(app).get('/api/auth/me').set(auth(token));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.username, 'bob');

    assert.equal((await request(app).get('/api/auth/me')).status, 401);
    assert.equal((await request(app).get('/api/auth/me').set(auth('not-a-token'))).status, 401);
  });

  it('updates the profile, searches users and looks them up by phone', async () => {
    const alice = await createUser('alice');
    const bob = await createUser('bob', { displayName: 'Bobby Tables' });

    const updated = await request(app)
      .patch('/api/users/me')
      .set(auth(alice.token))
      .send({ displayName: 'Alice Cooper', bio: 'hi', avatarUrl: '/uploads/2026-01/abc.png' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.user.displayName, 'Alice Cooper');
    assert.equal(updated.body.user.avatarUrl, '/uploads/2026-01/abc.png');

    const byName = await request(app).get('/api/users?q=bobby').set(auth(alice.token));
    assert.equal(byName.body.users.length, 1);
    assert.equal(byName.body.users[0].username, 'bob');
    assert.equal(byName.body.users[0].email, undefined, 'email is private');
    assert.ok(byName.body.users[0].phone, 'phone is visible to other users');

    const byDigits = await request(app).get(`/api/users?q=${bob.user.phone.slice(-6)}`).set(auth(alice.token));
    assert.equal(byDigits.body.users.length, 1);
    assert.equal(byDigits.body.users[0].id, bob.id);

    const all = await request(app).get('/api/users').set(auth(alice.token));
    assert.ok(!all.body.users.some((u) => u.username === 'alice'), 'search excludes the current user');

    const lookup = await request(app).get(`/api/users/lookup?phone=${encodeURIComponent(bob.user.phone)}`).set(auth(alice.token));
    assert.equal(lookup.status, 200);
    assert.equal(lookup.body.user.id, bob.id);

    const missing = await request(app).get('/api/users/lookup?phone=%2B15559999999').set(auth(alice.token));
    assert.equal(missing.status, 404);
  });
});
