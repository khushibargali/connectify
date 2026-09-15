import mongoose from 'mongoose';

export const isValidObjectId = (value) => mongoose.isValidObjectId(value);

export const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

/** Extract a string id from an ObjectId, a document, a populated ref, a JSON object or a string. */
export function idOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (value._id != null) return String(value._id);
  if (value.id != null) return String(value.id);
  return String(value);
}

/** Shared toJSON options: expose `id`, hide `_id` and `__v`. */
export const toJSONOptions = {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
};

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
