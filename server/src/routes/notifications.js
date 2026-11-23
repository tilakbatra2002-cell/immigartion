import { Router } from 'express';
import Notification from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginate, paginationSchema, pageMeta } from '../utils/pagination.js';
import { query } from '../utils/validate.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', query(paginationSchema.extend({ unread: z.enum(['true', 'false']).optional() })), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { userId: req.user._id };
  if (q.unread === 'true') filter.readAt = null;
  const [items, total, unread] = await Promise.all([
    paginate(Notification.find(filter), { page: q.page, limit: q.limit, sort: '-createdAt' }).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user._id, readAt: null }),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit), unread });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.user._id }, { readAt: new Date() });
  res.json({ ok: true });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ ok: true });
}));

export default router;
