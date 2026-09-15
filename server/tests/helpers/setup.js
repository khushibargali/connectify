import './env.js';
import fs from 'node:fs';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { io as connect } from 'socket.io-client';
import { createApp } from '../../src/app.js';
import { Conversation, Message, User } from '../../src/models/index.js';
import { initSocket } from '../../src/socket/index.js';
import { signToken } from '../../src/utils/jwt.js';

let mongo;

export async function startDB() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('connectify-test'));
  mongoose.set('bufferCommands', false);
  await Promise.all([User.init(), Conversation.init(), Message.init()]);
}

export async function stopDB() {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
}

export async function clearDB() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export const buildApp = () => createApp();

let phoneCounter = 0;

export async function createUser(username, overrides = {}) {
  phoneCounter += 1;
  const user = await User.create({
    username,
    phone: `+1555${String(phoneCounter).padStart(7, '0')}`,
    email: `${username}@test.dev`,
    passwordHash: await User.hashPassword('password123'),
    displayName: username.charAt(0).toUpperCase() + username.slice(1),
    ...overrides,
  });
  return { user, id: String(user._id), token: signToken(user._id) };
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Starts the full HTTP + Socket.IO stack on a random port. */
export async function listen() {
  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);
  app.set('io', io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    app,
    server,
    io,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => io.close(() => resolve())),
  };
}

export function socketClient(url, token) {
  return connect(url, { auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false });
}

export function once(socket, event, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves once the server has joined the socket to its rooms (it emits presence:list last). */
export async function connectReady(url, token) {
  const socket = socketClient(url, token);
  await once(socket, 'presence:list');
  return socket;
}

export function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}
