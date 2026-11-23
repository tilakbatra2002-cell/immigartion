import Task from '../models/Task.js';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import Document from '../models/Document.js';
import Subscription from '../models/Subscription.js';
import Organization from '../models/Organization.js';
import { notify } from './notifications.js';
import { emitToOrg } from '../realtime.js';

const INTERVAL_MS = 5 * 60 * 1000;
let timer = null;

/**
 * Lightweight in-process scheduler. For production, run a single dedicated
 * worker instance (WORKER=true) or move these jobs to a queue (BullMQ/Cron).
 */
async function runOnce() {
  const now = new Date();
  try {
    // 1) Overdue invoice status refresh
    await Invoice.updateMany(
      { status: { $in: ['SENT', 'PARTIALLY_PAID'] }, dueDate: { $lt: now }, balance: { $gt: 0 } },
      { $set: { status: 'OVERDUE' } },
    );

    // 2) Expired documents
    await Document.updateMany(
      { deletedAt: null, expiryDate: { $lt: now }, status: { $in: ['UPLOADED', 'UNDER_REVIEW', 'VERIFIED'] }, currentVersion: { $gt: 0 } },
      { $set: { status: 'EXPIRED' } },
    );

    // 3) Task reminders (due within 24h, not yet reminded)
    const dueTasks = await Task.find({
      status: { $in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { $lte: new Date(now.getTime() + 24 * 3600 * 1000), $gte: now },
      assignedToId: { $ne: null },
      $or: [{ reminderAt: null }, { reminderAt: { $lte: now } }],
      lastReminderSentAt: { $not: { $gte: new Date(now.getTime() - 20 * 3600 * 1000) } },
    }).limit(100);
    for (const t of dueTasks) {
      // eslint-disable-next-line no-await-in-loop
      await notify({ organizationId: t.organizationId, userIds: [t.assignedToId], type: 'TASK_DUE', title: 'Task due soon', body: t.title, link: '/tasks' });
      t.lastReminderSentAt = now;
      // eslint-disable-next-line no-await-in-loop
      await t.save();
    }

    // 4) Appointment reminders
    const appts = await Appointment.find({
      status: { $in: ['SCHEDULED', 'CONFIRMED'] },
      reminderSentAt: null,
      startAt: { $lte: new Date(now.getTime() + 60 * 60 * 1000), $gte: now },
    }).limit(100);
    for (const a of appts) {
      // eslint-disable-next-line no-await-in-loop
      await notify({ organizationId: a.organizationId, userIds: [a.consultantId], type: 'APPOINTMENT_REMINDER', title: 'Appointment starting soon', body: `${a.title || a.type} at ${a.startAt.toLocaleString('en-IN')}`, link: '/appointments' });
      a.reminderSentAt = now;
      // eslint-disable-next-line no-await-in-loop
      await a.save();
    }

    // 5) Trial expiry handling (graceful)
    const expiringTrials = await Subscription.find({ status: 'TRIALING', trialEndsAt: { $lt: now } }).limit(200);
    for (const s of expiringTrials) {
      s.status = 'EXPIRED';
      // eslint-disable-next-line no-await-in-loop
      await s.save();
      // eslint-disable-next-line no-await-in-loop
      await Organization.updateOne({ _id: s.organizationId, status: 'TRIAL' }, { status: 'CANCELLED' });
      // eslint-disable-next-line no-await-in-loop
      await notify({
        organizationId: s.organizationId, userIds: await ownerIds(s.organizationId), type: 'SUBSCRIPTION',
        title: 'Your trial has ended', body: 'Choose a plan to continue creating records. Existing data remains accessible.', link: '/app/subscription',
      });
    }

    // 6) Subscription period rollover
    const expired = await Subscription.find({ status: 'ACTIVE', currentPeriodEnd: { $lt: new Date(now.getTime() - 3 * 24 * 3600 * 1000) } }).limit(100);
    for (const s of expired) {
      s.status = 'EXPIRED';
      // eslint-disable-next-line no-await-in-loop
      await s.save();
      emitToOrg(s.organizationId, 'subscription:expired', {});
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[scheduler] job failed', err.message);
  }
}

async function ownerIds(organizationId) {
  const Membership = (await import('../models/Membership.js')).default;
  const owners = await Membership.find({ organizationId, role: 'OWNER', status: 'ACTIVE' }).select('userId').lean();
  return owners.map((o) => o.userId);
}

export function startScheduler() {
  if (timer || process.env.DISABLE_SCHEDULER === 'true') return;
  timer = setInterval(runOnce, INTERVAL_MS);
  if (timer.unref) timer.unref();
  setTimeout(runOnce, 8000).unref();
  // eslint-disable-next-line no-console
  console.log('[scheduler] reminders & maintenance jobs started (5 min interval)');
}
