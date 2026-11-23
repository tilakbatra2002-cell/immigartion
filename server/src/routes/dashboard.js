import { Router } from 'express';
import mongoose from 'mongoose';
import ImmigrationCase, { CaseTimeline } from '../models/ImmigrationCase.js';
import Lead from '../models/Lead.js';
import Client from '../models/Client.js';
import Document from '../models/Document.js';
import Task from '../models/Task.js';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CASE_STATUSES, CONVERTIBLE_LEAD_STATUSES, LEAD_STATUSES } from '../config/constants.js';
import { ACTIVE_CASE_STATUSES } from '../config/plans.js';
import { lastNMonthKeys, startOfDay, endOfDay, addDays } from '../utils/dates.js';

const router = Router();
router.use(requireAuth, requireOrg);

/** All metrics computed live from MongoDB for THIS organization only. */
router.get('/summary', requirePermission(PERMISSIONS.DASHBOARD_VIEW), asyncHandler(async (req, res) => {
  const orgId = new mongoose.Types.ObjectId(req.organizationId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeStatuses = ACTIVE_CASE_STATUSES;
  const deadlineSoon = { $gte: now, $lte: addDays(now, 14) };

  const [
    totalLeads, newLeadsThisMonth, activeClients, activeCases, awaitingDocs, nearingDeadline, completedCases,
    pendingTasks, overdueTasks, upcomingAppointments, revenueAgg, outstandingAgg, pipelineAgg, caseStatusAgg, revenueByMonth, recentActivity, upcoming, pendingActions,
  ] = await Promise.all([
    Lead.countDocuments({ organizationId: orgId }),
    Lead.countDocuments({ organizationId: orgId, createdAt: { $gte: monthStart } }),
    Client.countDocuments({ organizationId: orgId, status: 'ACTIVE' }),
    ImmigrationCase.countDocuments({ organizationId: orgId, status: { $in: activeStatuses } }),
    ImmigrationCase.countDocuments({ organizationId: orgId, status: { $in: ['DOCUMENTS_PENDING', 'ADDITIONAL_INFO_REQUESTED'] } }),
    ImmigrationCase.countDocuments({ organizationId: orgId, status: { $in: activeStatuses }, targetDeadline: deadlineSoon }),
    ImmigrationCase.countDocuments({ organizationId: orgId, status: { $in: ['APPROVED', 'CLOSED'] } }),
    Task.countDocuments({ organizationId: orgId, status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
    Task.countDocuments({ organizationId: orgId, status: { $in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { $lt: now } }),
    Appointment.countDocuments({ organizationId: orgId, startAt: { $gte: now }, status: { $in: ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED'] } }),
    Invoice.aggregate([{ $match: { organizationId: orgId, type: 'INVOICE', status: { $ne: 'CANCELLED' }, issueDate: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amountPaid' }, invoiced: { $sum: '$total' } } }]),
    Invoice.aggregate([{ $match: { organizationId: orgId, type: 'INVOICE', status: { $in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } } }, { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: { organizationId: orgId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ImmigrationCase.aggregate([{ $match: { organizationId: orgId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Invoice.aggregate([
      { $match: { organizationId: orgId, type: 'INVOICE', status: { $ne: 'CANCELLED' } } },
      { $group: { _id: { y: { $year: '$issueDate' }, m: { $month: '$issueDate' } }, paid: { $sum: '$amountPaid' }, invoiced: { $sum: '$total' } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    CaseTimeline.find({ organizationId: orgId }).sort('-createdAt').limit(10).populate('caseId', 'reference title').lean(),
    Appointment.find({ organizationId: orgId, startAt: { $gte: startOfDay(now) }, status: { $in: ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED'] } })
      .sort('startAt').limit(5).populate('clientId', 'firstName lastName').populate('consultantId', 'name').lean(),
    Promise.all([
      Task.countDocuments({ organizationId: orgId, status: { $in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { $lt: now } }),
      Document.countDocuments({ organizationId: orgId, deletedAt: null, isRequested: true, status: 'REQUIRED' }),
      Invoice.countDocuments({ organizationId: orgId, type: 'INVOICE', status: 'OVERDUE' }),
      Lead.countDocuments({ organizationId: orgId, status: { $in: CONVERTIBLE_LEAD_STATUSES }, followUpAt: { $lt: endOfDay(now) } }),
      ImmigrationCase.countDocuments({ organizationId: orgId, status: { $in: activeStatuses }, targetDeadline: { $lt: now } }),
    ]),
  ]);

  // Lead conversion trend: leads created vs converted per month (last 6 months)
  const months = lastNMonthKeys(6);
  const leadTrend = await Lead.aggregate([
    { $match: { organizationId: orgId, createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
    { $group: {
      _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
      created: { $sum: 1 },
      converted: { $sum: { $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0] } },
    } },
  ]);
  const trendMap = new Map(leadTrend.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r]));
  const conversion = months.map((key) => {
    const r = trendMap.get(key);
    return { month: key, created: r?.created || 0, converted: r?.converted || 0 };
  });

  const revenueMap = new Map(revenueByMonth.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r]));
  const revenueSeries = months.map((key) => {
    const r = revenueMap.get(key);
    return { month: key, collected: Math.round((r?.paid || 0) * 100) / 100, invoiced: Math.round((r?.invoiced || 0) * 100) / 100 };
  });

  const totalLeadsForConversion = pipelineAgg.reduce((s, r) => s + r.count, 0);
  const converted = pipelineAgg.find((r) => r._id === 'CONVERTED')?.count || 0;

  res.json({
    metrics: {
      totalLeads, newLeadsThisMonth, activeClients, activeCases, awaitingDocs, nearingDeadline, completedCases,
      pendingTasks, overdueTasks, upcomingAppointments,
      monthRevenue: Math.round((revenueAgg[0]?.total || 0) * 100) / 100,
      monthInvoiced: Math.round((revenueAgg[0]?.invoiced || 0) * 100) / 100,
      outstandingPayments: Math.round((outstandingAgg[0]?.total || 0) * 100) / 100,
      outstandingInvoices: outstandingAgg[0]?.count || 0,
      conversionRate: totalLeadsForConversion ? Math.round((converted / totalLeadsForConversion) * 1000) / 10 : 0,
      currency: req.org.settings?.currency || 'INR',
    },
    leadPipeline: LEAD_STATUSES.map((s) => ({ key: s.key, label: s.label, color: s.color, count: pipelineAgg.find((r) => r._id === s.key)?.count || 0 })),
    caseDistribution: CASE_STATUSES.filter((s) => s.active).map((s) => ({ key: s.key, label: s.label, color: s.color, count: caseStatusAgg.find((r) => r._id === s.key)?.count || 0 })).filter((s) => s.count > 0),
    conversion, revenueSeries,
    recentActivity: recentActivity.map((a) => ({ _id: a._id, type: a.type, title: a.title, description: a.description, actorName: a.actorName, createdAt: a.createdAt, case: a.caseId })),
    upcomingAppointments: upcoming,
    pendingActions: {
      overdueTasks: pendingActions[0],
      missingDocuments: pendingActions[1],
      overdueInvoices: pendingActions[2],
      followUpsDue: pendingActions[3],
      casesPastDeadline: pendingActions[4],
    },
    generatedAt: now.toISOString(),
  });
}));

/** Compact endpoint for the sidebar badge counts. */
router.get('/badges', asyncHandler(async (req, res) => {
  const orgId = new mongoose.Types.ObjectId(req.organizationId);
  const now = new Date();
  const [overdueTasks, unreadNotifications, unreadMessages] = await Promise.all([
    Task.countDocuments({ organizationId: orgId, status: { $in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { $lt: now }, assignedToId: req.user._id }),
    (await import('../models/Notification.js')).default.countDocuments({ userId: req.user._id, readAt: null }),
    (await import('../models/Communication.js')).Conversation.countDocuments({ organizationId: orgId, unreadForStaff: { $gt: 0 } }),
  ]);
  res.json({ overdueTasks, unreadNotifications, unreadMessages });
}));

export default router;
