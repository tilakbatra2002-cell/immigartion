import { Router } from 'express';
import mongoose from 'mongoose';
import Lead from '../models/Lead.js';
import Client from '../models/Client.js';
import ImmigrationCase, { CaseTimeline } from '../models/ImmigrationCase.js';
import Document from '../models/Document.js';
import Appointment from '../models/Appointment.js';
import Invoice, { Payment } from '../models/Invoice.js';
import Task from '../models/Task.js';
import Membership from '../models/Membership.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { query } from '../utils/validate.js';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { rangeFromQuery, lastNMonthKeys } from '../utils/dates.js';
import { CASE_STATUSES, LEAD_STATUSES, VISA_CATEGORIES } from '../config/constants.js';
import { assertFeature } from '../services/plans.js';
import { audit } from '../services/audit.js';

const router = Router();
router.use(requireAuth, requireOrg);

const rangeQuery = z.object({ from: z.string().optional(), to: z.string().optional(), days: z.coerce.number().min(7).max(730).optional() });

router.get('/lead-performance', requirePermission(PERMISSIONS.REPORTS_VIEW), query(rangeQuery), asyncHandler(async (req, res) => {
  const { start, end } = rangeFromQuery(req.validatedQuery);
  const orgId = new mongoose.Types.ObjectId(req.organizationId);
  const base = { organizationId: orgId, createdAt: { $gte: start, $lte: end } };
  const [byStatus, bySource, byAssignee] = await Promise.all([
    Lead.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: base }, { $group: { _id: '$leadSource', count: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0] } } } }, { $sort: { count: -1 } }]),
    Lead.aggregate([{ $match: base }, { $group: { _id: '$assignedToId', count: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0] } } } }, { $sort: { count: -1 } }]),
  ]);
  const users = await Membership.find({ organizationId: orgId }).populate('userId', 'name').lean();
  const nameOf = (id) => users.find((m) => String(m.userId?._id) === String(id))?.userId?.name || 'Unassigned';
  res.json({
    range: { start, end },
    byStatus: LEAD_STATUSES.map((s) => ({ key: s.key, label: s.label, count: byStatus.find((r) => r._id === s.key)?.count || 0 })),
    bySource: bySource.map((r) => ({ source: r._id, count: r.count, converted: r.converted, rate: r.count ? Math.round((r.converted / r.count) * 1000) / 10 : 0 })),
    byAssignee: byAssignee.map((r) => ({ name: nameOf(r._id), count: r.count, converted: r.converted, rate: r.count ? Math.round((r.converted / r.count) * 1000) / 10 : 0 })),
  });
}));

router.get('/case-status', requirePermission(PERMISSIONS.REPORTS_VIEW), query(rangeQuery), asyncHandler(async (req, res) => {
  const { start, end } = rangeFromQuery(req.validatedQuery);
  const orgId = new mongoose.Types.ObjectId(req.organizationId);
  const base = { organizationId: orgId, createdAt: { $gte: start, $lte: end } };
  const [byStatus, byVisa, byCountry, completion] = await Promise.all([
    ImmigrationCase.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ImmigrationCase.aggregate([{ $match: base }, { $group: { _id: '$visaCategory', count: { $sum: 1 } } }]),
    ImmigrationCase.aggregate([{ $match: base }, { $group: { _id: '$destinationCountry', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ImmigrationCase.aggregate([
      { $match: { organizationId: orgId, status: { $in: ['APPROVED', 'REFUSED', 'CLOSED', 'WITHDRAWN'] }, closedAt: { $gte: start, $lte: end } } },
      { $project: { daysToClose: { $divide: [{ $subtract: ['$closedAt', '$createdAt'] }, 86400000] }, status: 1 } },
      { $group: { _id: '$status', count: { $sum: 1 }, avgDays: { $avg: '$daysToClose' } } },
    ]),
  ]);
  res.json({
    range: { start, end },
    byStatus: CASE_STATUSES.map((s) => ({ key: s.key, label: s.label, count: byStatus.find((r) => r._id === s.key)?.count || 0 })),
    byVisa: VISA_CATEGORIES.map((v) => ({ key: v.key, label: v.label, count: byVisa.find((r) => r._id === v.key)?.count || 0 })),
    byCountry: byCountry.map((r) => ({ country: r._id, count: r.count })),
    completion: completion.map((r) => ({ status: r._id, count: r.count, avgDays: r.avgDays ? Math.round(r.avgDays * 10) / 10 : 0 })),
  });
}));

router.get('/consultant-performance', requirePermission(PERMISSIONS.REPORTS_VIEW), query(rangeQuery), asyncHandler(async (req, res) => {
  const { start, end } = rangeFromQuery(req.validatedQuery);
  const orgId = new mongoose.Types.ObjectId(req.organizationId);
  const members = await Membership.find({ organizationId: orgId, status: 'ACTIVE' }).populate('userId', 'name email').lean();
  const [casesByConsultant, tasksDone, leadsByConsultant, apptsByConsultant] = await Promise.all([
    ImmigrationCase.aggregate([{ $match: { organizationId: orgId, createdAt: { $gte: start, $lte: end } } }, { $group: { _id: '$consultantId', total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] } } } }]),
    Task.aggregate([{ $match: { organizationId: orgId, status: 'COMPLETED', completedAt: { $gte: start, $lte: end } } }, { $group: { _id: '$assignedToId', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: { organizationId: orgId, createdAt: { $gte: start, $lte: end } } }, { $group: { _id: '$assignedToId', total: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0] } } } }]),
    Appointment.aggregate([{ $match: { organizationId: orgId, startAt: { $gte: start, $lte: end }, status: { $in: ['COMPLETED', 'CONFIRMED', 'SCHEDULED'] } } }, { $group: { _id: '$consultantId', count: { $sum: 1 } } }]),
  ]);
  const rows = members.filter((m) => m.userId).map((m) => {
    const id = String(m.userId._id);
    const c = casesByConsultant.find((r) => String(r._id) === id);
    return {
      memberId: m._id, name: m.userId.name, email: m.userId.email, role: m.role,
      cases: c?.total || 0,
      approved: c?.approved || 0,
      leads: leadsByConsultant.find((r) => String(r._id) === id)?.total || 0,
      convertedLeads: leadsByConsultant.find((r) => String(r._id) === id)?.converted || 0,
      tasksCompleted: tasksDone.find((r) => String(r._id) === id)?.count || 0,
      appointments: apptsByConsultant.find((r) => String(r._id) === id)?.count || 0,
    };
  }).sort((a, b) => b.cases - a.cases);
  res.json({ range: { start, end }, rows });
}));

router.get('/revenue', requirePermission(PERMISSIONS.REPORTS_VIEW), query(rangeQuery), asyncHandler(async (req, res) => {
  const { start, end } = rangeFromQuery(req.validatedQuery);
  const orgId = new mongoose.Types.ObjectId(req.organizationId);
  const months = lastNMonthKeys(6, end);
  const [payments, byMethod, outstanding] = await Promise.all([
    Payment.aggregate([{ $match: { organizationId: orgId, status: 'SUCCESS', paidAt: { $gte: start, $lte: end } } }, { $group: { _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { organizationId: orgId, status: 'SUCCESS', paidAt: { $gte: start, $lte: end } } }, { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Invoice.aggregate([{ $match: { organizationId: orgId, type: 'INVOICE', status: { $in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } } }, { $group: { _id: '$status', total: { $sum: '$balance' }, count: { $sum: 1 } } }]),
  ]);
  const map = new Map(payments.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r]));
  res.json({
    range: { start, end },
    monthly: months.map((k) => ({ month: k, collected: map.get(k)?.total || 0, payments: map.get(k)?.count || 0 })),
    byMethod,
    outstanding,
    currency: req.org.settings?.currency || 'INR',
  });
}));

router.get('/pending-documents', requirePermission(PERMISSIONS.REPORTS_VIEW), asyncHandler(async (req, res) => {
  const orgId = new mongoose.Types.ObjectId(req.organizationId);
  const rows = await ImmigrationCase.find({ organizationId: orgId, status: { $in: ['DOCUMENTS_PENDING', 'DOCUMENTS_RECEIVED', 'ADDITIONAL_INFO_REQUESTED', 'READY_FOR_SUBMISSION'] } })
    .select('reference title status documentChecklist clientId destinationCountry')
    .populate('clientId', 'firstName lastName reference')
    .lean();
  const data = rows.map((c) => ({
    caseId: c._id, reference: c.reference, title: c.title, status: c.status,
    client: c.clientId ? `${c.clientId.firstName} ${c.clientId.lastName || ''}`.trim() : '—',
    missing: c.documentChecklist.filter((i) => i.required && ['REQUIRED', 'REJECTED'].includes(i.status)).length,
    total: c.documentChecklist.length,
  })).filter((r) => r.missing > 0).sort((a, b) => b.missing - a.missing);
  res.json({ data });
}));

router.get('/appointments', requirePermission(PERMISSIONS.REPORTS_VIEW), query(rangeQuery), asyncHandler(async (req, res) => {
  const { start, end } = rangeFromQuery(req.validatedQuery);
  const orgId = new mongoose.Types.ObjectId(req.organizationId);
  const [byStatus, byType] = await Promise.all([
    Appointment.aggregate([{ $match: { organizationId: orgId, startAt: { $gte: start, $lte: end } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Appointment.aggregate([{ $match: { organizationId: orgId, startAt: { $gte: start, $lte: end } } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
  ]);
  res.json({ range: { start, end }, byStatus, byType });
}));

// Generic CSV export for any report payload
router.post('/export-csv', requirePermission(PERMISSIONS.REPORTS_EXPORT), asyncHandler(async (req, res) => {
  await assertFeature(req.organizationId, 'advancedReports', 'Report exports');
  const { title = 'report', columns = [], rows = [] } = req.body;
  if (!Array.isArray(columns) || !Array.isArray(rows) || columns.length === 0) {
    return res.status(400).json({ error: 'columns and rows are required' });
  }
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [columns.map((c) => esc(c.label || c.key)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))].join('\n');
  await audit(req, 'report.exported', { description: `Exported "${title}" report (${rows.length} rows)` });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${String(title).replace(/[^a-z0-9-_]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\uFEFF' + csv);
}));

export default router;
