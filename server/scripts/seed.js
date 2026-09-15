import { pathToFileURL } from 'node:url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Conversation from '../src/models/Conversation.js';
import Message from '../src/models/Message.js';
import User from '../src/models/User.js';
import logger from '../src/utils/logger.js';

export const DEMO_PASSWORD = 'password123';

const DEMO_USERS = [
  { username: 'alice', phone: '+15550000101', displayName: 'Alice Johnson', bio: 'Front-end engineer. Coffee first.' },
  { username: 'bob', phone: '+15550000102', displayName: 'Bob Martinez', bio: 'Back-end & infra. Ask me about sockets.' },
  { username: 'carol', phone: '+15550000103', displayName: 'Carol Nguyen', bio: 'Product designer.' },
  { username: 'dave', phone: '+15550000104', displayName: 'Dave Okafor', bio: 'QA and release manager.' },
];

async function createThread(conversation, lines, startedAt) {
  let at = startedAt;
  let last = null;
  for (const [user, content] of lines) {
    at = new Date(at.getTime() + 45_000);
    last = await Message.create({ conversation: conversation._id, sender: user._id, content, createdAt: at });
  }
  conversation.lastMessage = last._id;
  conversation.lastMessageAt = last.createdAt;
  for (const p of conversation.participants) {
    p.lastReadAt = last.createdAt;
    p.lastDeliveredAt = last.createdAt;
  }
  await conversation.save();
}

/** Creates demo users, a direct chat and a group. Skips when users already exist unless `force`. */
export async function seedDemoData({ force = false } = {}) {
  if (force) {
    await Promise.all([User.deleteMany({}), Conversation.deleteMany({}), Message.deleteMany({})]);
  } else if (await User.countDocuments()) {
    logger.info('Seed skipped — users already exist');
    return;
  }

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);
  const [alice, bob, carol, dave] = await User.create(
    DEMO_USERS.map((u) => ({ ...u, email: `${u.username}@example.com`, passwordHash })),
  );

  const direct = await Conversation.create({
    type: 'direct',
    directKey: Conversation.directKeyFor(alice._id, bob._id),
    createdBy: alice._id,
    participants: [{ user: alice._id }, { user: bob._id }],
  });
  await createThread(
    direct,
    [
      [alice, 'Hey Bob! Did you get the Socket.IO integration working?'],
      [bob, 'Yes — messages are flowing in real time now 🎉'],
      [alice, 'Amazing. Typing indicators too?'],
      [bob, 'Typing, presence and read receipts. Open the group chat and try it.'],
    ],
    new Date(Date.now() - 2 * 60 * 60 * 1000),
  );

  const group = await Conversation.create({
    type: 'group',
    name: 'Connectify Team',
    createdBy: alice._id,
    admins: [alice._id],
    participants: [alice, bob, carol, dave].map((u) => ({ user: u._id })),
  });
  await createThread(
    group,
    [
      [alice, 'created the group "Connectify Team"'],
      [carol, 'Sharing the new sidebar mockups later today.'],
      [dave, 'Release checklist is ready — QA starts tomorrow.'],
      [bob, 'API and sockets are green in CI. Ship it!'],
    ],
    new Date(Date.now() - 40 * 60 * 1000),
  );
  await Message.updateOne({ conversation: group._id, sender: alice._id }, { $set: { type: 'system' } });

  logger.info(`Demo data seeded — log in as ${DEMO_USERS.map((u) => `${u.username} (${u.phone})`).join(', ')} with password "${DEMO_PASSWORD}"`);
}

// CLI: `node scripts/seed.js [--force]`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const force = process.argv.includes('--force');
  connectDB()
    .then(() => seedDemoData({ force }))
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
