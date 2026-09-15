import mongoose from 'mongoose';
import { idOf, toJSONOptions } from '../utils/mongo.js';

const { Schema } = mongoose;

const participantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** Everything created after this timestamp is unread for this participant. */
    lastReadAt: { type: Date, default: () => new Date(0) },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false, id: false },
);

const conversationSchema = new Schema(
  {
    type: { type: String, enum: ['direct', 'group'], required: true },
    name: { type: String, trim: true, maxlength: 80, default: '' },
    participants: { type: [participantSchema], default: [] },
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    /** Sorted "<idA>:<idB>" for direct chats — guarantees one conversation per pair. */
    directKey: { type: String, unique: true, sparse: true },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

conversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 });

conversationSchema.statics.directKeyFor = function directKeyFor(a, b) {
  return [String(a), String(b)].sort().join(':');
};

conversationSchema.methods.participantIds = function participantIds() {
  return this.participants.map((p) => idOf(p.user));
};

conversationSchema.methods.hasParticipant = function hasParticipant(userId) {
  return this.participantIds().includes(String(userId));
};

conversationSchema.methods.isAdmin = function isAdmin(userId) {
  return this.admins.some((admin) => idOf(admin) === String(userId));
};

export default mongoose.model('Conversation', conversationSchema);
