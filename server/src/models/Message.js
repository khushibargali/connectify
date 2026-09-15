import mongoose from 'mongoose';
import { toJSONOptions } from '../utils/mongo.js';

const { Schema } = mongoose;

export const MESSAGE_TYPES = ['text', 'image', 'video', 'audio', 'file', 'system'];

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    name: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 100 },
    size: { type: Number, required: true, min: 0 },
    width: { type: Number },
    height: { type: Number },
    /** Seconds, for audio/video. */
    duration: { type: Number },
  },
  { _id: false, id: false },
);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: MESSAGE_TYPES, default: 'text' },
    /** Text body, or the caption for media messages. */
    content: { type: String, trim: true, maxlength: 4000, default: '' },
    attachment: { type: attachmentSchema, default: undefined },
    /** Client-generated id used to reconcile optimistic messages. */
    clientId: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

// Cursor pagination: newest first within a conversation (_id is time-ordered).
messageSchema.index({ conversation: 1, _id: -1 });

export default mongoose.model('Message', messageSchema);
