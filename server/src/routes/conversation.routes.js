import { Router } from 'express';
import * as conversations from '../controllers/conversation.controller.js';
import * as messages from '../controllers/message.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateObjectIdParams } from '../middleware/validate.js';
import {
  addMembersSchema,
  createDirectSchema,
  createGroupSchema,
  muteSchema,
  sendMessageSchema,
  updateConversationSchema,
} from '../validation/schemas.js';

const router = Router();
const withId = validateObjectIdParams('id');

router.use(requireAuth);

router.get('/', conversations.list);
router.post('/direct', validateBody(createDirectSchema), conversations.createDirect);
router.post('/group', validateBody(createGroupSchema), conversations.createGroup);

router.get('/:id', withId, conversations.getOne);
router.patch('/:id', withId, validateBody(updateConversationSchema), conversations.update);
router.post('/:id/read', withId, conversations.markRead);
router.post('/:id/mute', withId, validateBody(muteSchema), conversations.mute);
router.post('/:id/members', withId, validateBody(addMembersSchema), conversations.addMembers);
router.delete('/:id/members/me', withId, conversations.leave);
router.delete('/:id/members/:userId', validateObjectIdParams('id', 'userId'), conversations.removeMember);

router.get('/:id/messages', withId, messages.list);
router.get('/:id/messages/search', withId, messages.search);
router.post('/:id/messages', withId, validateBody(sendMessageSchema), messages.send);

export default router;
