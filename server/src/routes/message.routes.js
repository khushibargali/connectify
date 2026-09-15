import { Router } from 'express';
import * as controller from '../controllers/message.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateObjectIdParams } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);
router.delete('/:id', validateObjectIdParams('id'), controller.remove);

export default router;
