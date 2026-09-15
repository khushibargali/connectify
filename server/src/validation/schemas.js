import { z } from 'zod';
import { PHONE_REGEX, normalizePhone } from '../utils/phone.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const username = z
  .string({ error: 'Username is required' })
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-z0-9_]+$/, 'Username may only contain letters, numbers and underscores');

export const phone = z
  .string({ error: 'Phone number is required' })
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(PHONE_REGEX, 'Enter a valid phone number including the country code'));

const optionalEmail = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.email({ error: 'Enter a valid email address' }).trim().toLowerCase().optional(),
);

const optionalUsername = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  username.optional(),
);

export const registerSchema = z.object({
  displayName: z.string({ error: 'Name is required' }).trim().min(1, 'Name is required').max(50),
  phone,
  password: z.string({ error: 'Password is required' }).min(8, 'Password must be at least 8 characters').max(128),
  username: optionalUsername,
  email: optionalEmail,
});

export const loginSchema = z.object({
  identifier: z.string({ error: 'Phone, username or email is required' }).trim().min(1, 'Phone, username or email is required'),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

const avatarUrl = z.union([
  z.url('Enter a valid URL').max(500),
  z.string().regex(/^\/uploads\/[\w-]+\/[\w-]+\.[a-z0-9]{1,8}$/i),
  z.literal(''),
]);

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    bio: z.string().trim().max(160).optional(),
    avatarUrl: avatarUrl.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const searchUsersQuerySchema = z.object({
  q: z.string().trim().max(50).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const lookupPhoneQuerySchema = z.object({ phone });

export const createDirectSchema = z.object({ userId: objectId });

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(80),
  memberIds: z.array(objectId).min(1, 'Add at least one member').max(100),
});

export const addMembersSchema = z.object({
  memberIds: z.array(objectId).min(1).max(100),
});

export const attachmentSchema = z.object({
  url: z.string().regex(/^\/uploads\/[\w-]+\/[\w-]+\.[a-z0-9]{1,8}$/i, 'Invalid attachment'),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  size: z.number().int().min(0),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().min(0).optional(),
});

const messageBody = z.object({
  type: z.enum(['text', 'image', 'video', 'audio', 'file']).default('text'),
  content: z.string().trim().max(4000, 'Message is too long').default(''),
  clientId: z.string().max(64).optional(),
  attachment: attachmentSchema.optional(),
});

const requireBodyOrAttachment = (value, ctx) => {
  if (value.type === 'text' && !value.content) {
    ctx.addIssue({ code: 'custom', path: ['content'], message: 'Message cannot be empty' });
  }
  if (value.type !== 'text' && !value.attachment) {
    ctx.addIssue({ code: 'custom', path: ['attachment'], message: 'Attachment is required for media messages' });
  }
};

export const sendMessageSchema = messageBody.superRefine(requireBodyOrAttachment);

export const sendMessageSocketSchema = messageBody
  .extend({ conversationId: objectId })
  .superRefine(requireBodyOrAttachment);

export const conversationIdSchema = z.object({ conversationId: objectId });

export const listMessagesQuerySchema = z.object({
  before: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
