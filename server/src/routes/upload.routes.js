import { Router } from 'express';
import * as controller from '../controllers/upload.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

router.post('/', requireAuth, uploadSingle, controller.upload);

export default router;
