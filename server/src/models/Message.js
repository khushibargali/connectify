import mongoose from 'mongoose';
import { toJSONOptions } from '../utils/mongo.js';

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'system'], default: 'text' },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    /** Client-generated id used to reconcile optimistic messages. */
    clientId: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

// Cursor pagination: newest first within a conversation (_id is time-ordered).
messageSchema.index({ conversation: 1, _id: -1 });

export default mongoose.model('Message', messageSchema);
