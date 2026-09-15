import { Router } from 'express';
import * as conversations from '../controllers/conversation.controller.js';
import * as messages from '../controllers/message.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateObjectIdParams } from '../middleware/validate.js';
import {
  addMembersSchema,
  createDirectSchema,
  createGroupSchema,
  sendMessageSchema,
} from '../validation/schemas.js';

const router = Router();
const withId = validateObjectIdParams('id');

router.use(requireAuth);

router.get('/', conversations.list);
router.post('/direct', validateBody(createDirectSchema), conversations.createDirect);
router.post('/group', validateBody(createGroupSchema), conversations.createGroup);

router.get('/:id', withId, conversations.getOne);
router.post('/:id/read', withId, conversations.markRead);
router.post('/:id/members', withId, validateBody(addMembersSchema), conversations.addMembers);
router.delete('/:id/members/me', withId, conversations.leave);

router.get('/:id/messages', withId, messages.list);
router.post('/:id/messages', withId, validateBody(sendMessageSchema), messages.send);

export default router;
