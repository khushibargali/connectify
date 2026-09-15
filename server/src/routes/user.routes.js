import { Router } from 'express';
import * as controller from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateObjectIdParams } from '../middleware/validate.js';
import { updateProfileSchema } from '../validation/schemas.js';

const router = Router();

router.use(requireAuth);
router.get('/', controller.search);
router.get('/lookup', controller.lookupByPhone);
router.patch('/me', validateBody(updateProfileSchema), controller.updateMe);
router.get('/:id', validateObjectIdParams('id'), controller.getOne);

export default router;
