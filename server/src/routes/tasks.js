import { Router } from 'express';
import { z } from 'zod';
import Task from '../models/Task.js';
import Client from '../models/Client.js';
import Lead from '../models/Lead.js';
import ImmigrationCase from '../models/ImmigrationCase.js';
import Membership from '../models/Membership.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body, query } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema, escapeRegex } from '../utils/pagination.js';
import { TASK_PRIORITIES, TASK_RECURRENCE, TASK_STATUSES } from '../config/constants.js';
import { addDays } from '../utils/dates.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notifications.js';

const router = Router();
router.use(requireAuth, requireOrg);

const taskBody = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(3000).optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueAt: z.string().datetime().nullable().optional().or(z.literal('')),
  relatedType: z.enum(['LEAD', 'CLIENT', 'CASE', 'NONE']).optional(),
  relatedId: z.string().nullable().optional(),
  recurrence: z.enum(TASK_RECURRENCE).optional(),
  recurrenceUntil: z.string().datetime().nullable().optional().or(z.literal('')),
  reminderAt: z.string().datetime().nullable().optional().or(z.literal('')),
});

async function validateAssignment(req, bodyIn) {
  if (bodyIn.assignedToId) {
    const m = await Membership.findOne({ organizationId: req.organizationId, userId: bodyIn.assignedToId, status: 'ACTIVE' });
    if (!m) throw ApiError.badRequest('Assignee is not an active team member.');
  }
  if (bodyIn.relatedType === 'CLIENT' && bodyIn.relatedId && !(await Client.exists({ _id: bodyIn.relatedId, organizationId: req.organizationId }))) throw ApiError.badRequest('Related client not found.');
  if (bodyIn.relatedType === 'LEAD' && bodyIn.relatedId && !(await Lead.exists({ _id: bodyIn.relatedId, organizationId: req.organizationId }))) throw ApiError.badRequest('Related lead not found.');
  if (bodyIn.relatedType === 'CASE' && bodyIn.relatedId && !(await ImmigrationCase.exists({ _id: bodyIn.relatedId, organizationId: req.organizationId }))) throw ApiError.badRequest('Related case not found.');
}

const listQuery = paginationSchema.extend({
  status: z.string().optional(), priority: z.string().optional(), assignedToId: z.string().optional(),
  relatedType: z.string().optional(), relatedId: z.string().optional(), overdue: z.enum(['true', 'false']).optional(),
  dueWithin: z.coerce.number().optional(),
});

router.get('/', requirePermission(PERMISSIONS.TASKS_VIEW), query(listQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId };
  if (q.status) filter.status = q.status === 'OPEN_ALL' ? { $in: ['OPEN', 'IN_PROGRESS'] } : q.status;
  if (q.priority) filter.priority = q.priority;
  if (q.assignedToId) filter.assignedToId = q.assignedToId === 'unassigned' ? null : q.assignedToId;
  if (q.relatedType) filter.relatedType = q.relatedType;
  if (q.relatedId) filter.relatedId = q.relatedId;
  if (q.overdue === 'true') { filter.dueAt = { $lt: new Date() }; filter.status = { $in: ['OPEN', 'IN_PROGRESS'] }; }
  else if (q.dueWithin) filter.dueAt = { $lte: addDays(new Date(), q.dueWithin), $gte: new Date() };
  if (q.q) filter.title = new RegExp(escapeRegex(q.q), 'i');

  const [items, total, counts] = await Promise.all([
    paginate(Task.find(filter).populate('assignedToId', 'name').populate('createdBy', 'name'), { page: q.page, limit: q.limit, sort: q.sort || 'dueAt' }).lean(),
    Task.countDocuments(filter),
    Task.aggregate([
      { $match: { organizationId: filter.organizationId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit), counts });
}));

router.post('/', requirePermission(PERMISSIONS.TASKS_CREATE), body(taskBody), asyncHandler(async (req, res) => {
  await validateAssignment(req, req.body);
  const doc = await Task.create({
    ...req.body, assignedToId: req.body.assignedToId || req.user._id,
    organizationId: req.organizationId, createdBy: req.user._id,
  });
  if (String(doc.assignedToId) !== String(req.user._id)) {
    await notify({ organizationId: req.organizationId, userIds: [doc.assignedToId], type: 'TASK_ASSIGNED', title: 'New task assigned', body: doc.title, link: '/tasks' });
  }
  await audit(req, 'task.created', { entityType: 'Task', entityId: doc._id, description: `Task "${doc.title}" created` });
  res.status(201).json(doc);
}));

router.patch('/:id', requirePermission(PERMISSIONS.TASKS_UPDATE), body(taskBody.partial()), asyncHandler(async (req, res) => {
  const doc = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Task not found');
  await validateAssignment(req, req.body);
  Object.entries(req.body).forEach(([k, v]) => { if (v === undefined) return; doc[k] = v === '' && ['dueAt', 'recurrenceUntil', 'reminderAt'].includes(k) ? undefined : v; });
  await doc.save();
  res.json(doc);
}));

router.patch('/:id/status', requirePermission(PERMISSIONS.TASKS_UPDATE), body(z.object({ status: z.enum(TASK_STATUSES) })), asyncHandler(async (req, res) => {
  const doc = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Task not found');
  if (req.body.status === 'COMPLETED' && !doc.completedAt) { doc.completedAt = new Date(); doc.completedBy = req.user._id; }
  if (req.body.status !== 'COMPLETED') { doc.completedAt = undefined; doc.completedBy = undefined; }
  doc.status = req.body.status;
  await doc.save();

  // Recurring tasks: spawn the next occurrence on completion
  if (req.body.status === 'COMPLETED' && doc.recurrence !== 'NONE' && doc.dueAt) {
    const stepDays = { DAILY: 1, WEEKLY: 7, MONTHLY: 30 }[doc.recurrence];
    const nextDue = addDays(doc.dueAt, stepDays);
    const withinWindow = !doc.recurrenceUntil || nextDue <= doc.recurrenceUntil;
    const exists = await Task.exists({ organizationId: req.organizationId, title: doc.title, status: { $in: ['OPEN', 'IN_PROGRESS'] }, dueAt: nextDue });
    if (withinWindow && !exists) {
      await Task.create({
        organizationId: req.organizationId, title: doc.title, description: doc.description, assignedToId: doc.assignedToId,
        createdBy: req.user._id, priority: doc.priority, dueAt: nextDue, relatedType: doc.relatedType, relatedId: doc.relatedId,
        recurrence: doc.recurrence, recurrenceUntil: doc.recurrenceUntil,
      });
    }
  }
  await audit(req, 'task.status_changed', { entityType: 'Task', entityId: doc._id, description: `Task "${doc.title}" → ${req.body.status}` });
  res.json(doc);
}));

router.delete('/:id', requirePermission(PERMISSIONS.TASKS_DELETE), asyncHandler(async (req, res) => {
  const doc = await Task.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Task not found');
  await audit(req, 'task.deleted', { entityType: 'Task', entityId: doc._id, description: `Task "${doc.title}" deleted` });
  res.json({ ok: true });
}));

export default router;
