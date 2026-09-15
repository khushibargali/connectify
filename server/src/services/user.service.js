import User, { PUBLIC_USER_FIELDS } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { escapeRegex } from '../utils/mongo.js';

export async function search(currentUserId, { q = '', limit = 20 } = {}) {
  const filter = { _id: { $ne: currentUserId } };
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ username: pattern }, { displayName: pattern }];
  }
  return User.find(filter).select(PUBLIC_USER_FIELDS).sort({ displayName: 1 }).limit(limit);
}

export async function getById(id) {
  const user = await User.findById(id).select(PUBLIC_USER_FIELDS);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function updateProfile(userId, patch) {
  const user = await User.findByIdAndUpdate(userId, { $set: patch }, { returnDocument: 'after', runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}
