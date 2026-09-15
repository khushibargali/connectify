import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const username = z
  .string({ error: 'Username is required' })
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-z0-9_]+$/, 'Username may only contain letters, numbers and underscores');

export const registerSchema = z.object({
  username,
  email: z.email({ error: 'Enter a valid email address' }).trim().toLowerCase(),
  password: z.string({ error: 'Password is required' }).min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().trim().min(1).max(50).optional(),
});

export const loginSchema = z.object({
  identifier: z.string({ error: 'Username or email is required' }).trim().min(1, 'Username or email is required'),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    bio: z.string().trim().max(160).optional(),
    avatarUrl: z.union([z.url('Enter a valid URL').max(500), z.literal('')]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const searchUsersQuerySchema = z.object({
  q: z.string().trim().max(50).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createDirectSchema = z.object({ userId: objectId });

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(80),
  memberIds: z.array(objectId).min(1, 'Add at least one member').max(100),
});

export const addMembersSchema = z.object({
  memberIds: z.array(objectId).min(1).max(100),
});

export const sendMessageSchema = z.object({
  content: z.string({ error: 'Message cannot be empty' }).trim().min(1, 'Message cannot be empty').max(4000),
  clientId: z.string().max(64).optional(),
});

export const sendMessageSocketSchema = sendMessageSchema.extend({ conversationId: objectId });

export const conversationIdSchema = z.object({ conversationId: objectId });

export const listMessagesQuerySchema = z.object({
  before: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
