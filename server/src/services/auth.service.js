import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { signToken } from '../utils/jwt.js';

export async function register({ username, email, password, displayName }) {
  const existing = await User.findOne({ $or: [{ username }, { email }] }).select('username email').lean();
  if (existing) {
    const field = existing.username === username ? 'username' : 'email';
    throw ApiError.conflict(`That ${field} is already taken`);
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ username, email, passwordHash, displayName: displayName || username });
  return { user, token: signToken(user._id) };
}

export async function login({ identifier, password }) {
  const lookup = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { username: identifier.toLowerCase() };

  const user = await User.findOne(lookup).select('+passwordHash');
  const valid = user ? await user.comparePassword(password) : false;
  if (!valid) throw ApiError.unauthorized('Invalid username/email or password');

  return { user, token: signToken(user._id) };
}
