import { Router } from 'express';
import * as controller from '../controllers/message.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateObjectIdParams } from '../middleware/validate.js';
import { editMessageSchema, reactSchema } from '../validation/schemas.js';

const router = Router();
const withId = validateObjectIdParams('id');

router.use(requireAuth);
router.patch('/:id', withId, validateBody(editMessageSchema), controller.edit);
router.put('/:id/reactions', withId, validateBody(reactSchema), controller.react);
router.delete('/:id', withId, controller.remove);

export default router;
