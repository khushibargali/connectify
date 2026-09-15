import { Router } from 'express';
import authRoutes from './auth.routes.js';
import conversationRoutes from './conversation.routes.js';
import messageRoutes from './message.routes.js';
import uploadRoutes from './upload.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/uploads', uploadRoutes);

export default router;
