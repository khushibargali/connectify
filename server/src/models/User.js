import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { toJSONOptions } from '../utils/mongo.js';
import { PHONE_REGEX } from '../utils/phone.js';

/** Fields safe to expose to other users. */
export const PUBLIC_USER_FIELDS = 'username displayName phone avatarUrl bio lastSeenAt createdAt';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/,
    },
    /** E.164 phone number, the primary identity (like WhatsApp). */
    phone: { type: String, required: true, unique: true, trim: true, match: PHONE_REGEX },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 50 },
    avatarUrl: { type: String, default: '', maxlength: 500 },
    bio: { type: String, default: 'Hey there! I am using Connectify.', maxlength: 160 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      ...toJSONOptions,
      transform(_doc, ret) {
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

export default mongoose.model('User', userSchema);
