import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { auth, buildApp, clearDB, createUser, startDB, stopDB } from './helpers/setup.js';

const payload = { username: 'Alice', email: 'Alice@Test.dev', password: 'password123', displayName: 'Alice J' };

describe('Auth API', () => {
  let app;

  before(async () => {
    await startDB();
    app = buildApp();
  });
  after(stopDB);
  beforeEach(clearDB);

  it('registers a user, normalises username/email and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(payload);
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.username, 'alice');
    assert.equal(res.body.user.email, 'alice@test.dev');
    assert.equal(res.body.user.displayName, 'Alice J');
    assert.equal(res.body.user.passwordHash, undefined);
    assert.equal(res.body.user._id, undefined);
    assert.ok(res.body.user.id);
  });

  it('rejects invalid payloads with field details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a!', email: 'nope', password: 'short' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Validation failed');
    const paths = res.body.error.details.map((d) => d.path);
    assert.ok(paths.includes('username'));
    assert.ok(paths.includes('email'));
    assert.ok(paths.includes('password'));
  });

  it('rejects duplicate usernames and emails', async () => {
    await request(app).post('/api/auth/register').send(payload);
    const dupUser = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, email: 'other@test.dev' });
    assert.equal(dupUser.status, 409);
    assert.match(dupUser.body.error.message, /username/i);

    const dupEmail = await request(app)
      .post('/api/auth/register')
      .send({ ...payload, username: 'someoneelse' });
    assert.equal(dupEmail.status, 409);
    assert.match(dupEmail.body.error.message, /email/i);
  });

  it('logs in with username or email', async () => {
    await request(app).post('/api/auth/register').send(payload);

    const byUsername = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'ALICE', password: 'password123' });
    assert.equal(byUsername.status, 200);
    assert.ok(byUsername.body.token);

    const byEmail = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'alice@test.dev', password: 'password123' });
    assert.equal(byEmail.status, 200);
    assert.equal(byEmail.body.user.username, 'alice');
  });

  it('rejects wrong passwords and unknown users', async () => {
    await request(app).post('/api/auth/register').send(payload);
    const wrong = await request(app).post('/api/auth/login').send({ identifier: 'alice', password: 'nope-nope' });
    assert.equal(wrong.status, 401);
    const unknown = await request(app).post('/api/auth/login').send({ identifier: 'ghost', password: 'whatever' });
    assert.equal(unknown.status, 401);
  });

  it('returns the current user from /me and rejects bad tokens', async () => {
    const { token } = await createUser('bob');
    const ok = await request(app).get('/api/auth/me').set(auth(token));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.username, 'bob');

    const missing = await request(app).get('/api/auth/me');
    assert.equal(missing.status, 401);

    const bad = await request(app).get('/api/auth/me').set(auth('not-a-token'));
    assert.equal(bad.status, 401);
  });

  it('updates the profile and searches users', async () => {
    const alice = await createUser('alice');
    await createUser('bob', { displayName: 'Bobby Tables' });

    const updated = await request(app)
      .patch('/api/users/me')
      .set(auth(alice.token))
      .send({ displayName: 'Alice Cooper', bio: 'hi' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.user.displayName, 'Alice Cooper');

    const search = await request(app).get('/api/users?q=bobby').set(auth(alice.token));
    assert.equal(search.status, 200);
    assert.equal(search.body.users.length, 1);
    assert.equal(search.body.users[0].username, 'bob');
    assert.equal(search.body.users[0].email, undefined);

    const all = await request(app).get('/api/users').set(auth(alice.token));
    assert.ok(!all.body.users.some((u) => u.username === 'alice'), 'search excludes the current user');
  });
});
