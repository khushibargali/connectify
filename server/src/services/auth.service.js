import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { signToken } from '../utils/jwt.js';
import { looksLikePhone, normalizePhone } from '../utils/phone.js';

function usernameFromName(displayName) {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  return base.length >= 3 ? base : `user${base}`;
}

async function uniqueUsername(preferred) {
  let candidate = preferred;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!(await User.exists({ username: candidate }))) return candidate;
    candidate = `${preferred.slice(0, 24)}_${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `${preferred.slice(0, 16)}_${Date.now().toString(36)}`;
}

export async function register({ displayName, phone, password, username, email }) {
  const conflicts = [{ phone }];
  if (username) conflicts.push({ username });
  if (email) conflicts.push({ email });

  const existing = await User.findOne({ $or: conflicts }).select('phone username email').lean();
  if (existing) {
    const field = existing.phone === phone ? 'phone number' : existing.username === username ? 'username' : 'email';
    throw ApiError.conflict(`That ${field} is already registered`);
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    displayName,
    phone,
    username: username || (await uniqueUsername(usernameFromName(displayName))),
    email: email || undefined,
    passwordHash,
  });
  return { user, token: signToken(user._id) };
}

/** Accepts a phone number, username or email as the identifier. */
export async function login({ identifier, password }) {
  let lookup;
  if (identifier.includes('@')) lookup = { email: identifier.toLowerCase() };
  else if (looksLikePhone(identifier)) lookup = { phone: normalizePhone(identifier) };
  else lookup = { username: identifier.toLowerCase() };

  const user = await User.findOne(lookup).select('+passwordHash');
  const valid = user ? await user.comparePassword(password) : false;
  if (!valid) throw ApiError.unauthorized('Incorrect phone/username or password');

  return { user, token: signToken(user._id) };
}
