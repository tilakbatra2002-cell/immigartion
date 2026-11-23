import Subscription from '../models/Subscription.js';
import Organization from '../models/Organization.js';
import Lead from '../models/Lead.js';
import ImmigrationCase from '../models/ImmigrationCase.js';
import Membership from '../models/Membership.js';
import { ApiError } from '../utils/apiError.js';
import { ACTIVE_CASE_STATUSES, planFor, TRIAL_DAYS } from '../config/plans.js';
import { CONVERTIBLE_LEAD_STATUSES } from '../config/constants.js';

const ACTIVE_SUB_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE'];

/** Read the effective subscription for an org, lazily creating a trial if missing. */
export async function getSubscription(organizationId) {
  let sub = await Subscription.findOne({ organizationId });
  if (!sub) {
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000);
    sub = await Subscription.create({ organizationId, plan: 'STARTER', status: 'TRIALING', trialEndsAt, currentPeriodStart: new Date(), currentPeriodEnd: trialEndsAt });
  }
  return sub;
}

/**
 * Effective access for an org. Handles trial expiry, cancellation grace and
 * suspension. Never throws — returns a status the caller can act on.
 */
export async function getAccess(organizationId) {
  const org = await Organization.findById(organizationId).lean();
  if (!org) throw ApiError.notFound('Organization not found');
  if (org.status === 'SUSPENDED') return { org, blocked: true, reason: 'SUSPENDED', subscription: null, plan: planFor('STARTER') };
  const sub = await getSubscription(organizationId);
  const now = new Date();
  let status = sub.status;
  if (status === 'TRIALING' && sub.trialEndsAt && sub.trialEndsAt < now) status = 'EXPIRED';
  if (['ACTIVE', 'PAST_DUE'].includes(status) && sub.currentPeriodEnd && sub.currentPeriodEnd < new Date(now.getTime() - 3 * 24 * 3600 * 1000)) status = 'EXPIRED';
  if (status !== sub.status) { sub.status = status; await sub.save(); }
  const blocked = ['EXPIRED', 'CANCELLED'].includes(status) && !sub.cancelAtPeriodEnd;
  return { org, blocked, reason: blocked ? status : null, subscription: sub, plan: planFor(sub.plan) };
}

export function planLimitError(limitName, limit, current) {
  return ApiError.limitReached(
    `Your plan's ${limitName.toLowerCase()} limit (${limit}) has been reached. Upgrade your plan to continue.`,
    { limit: limitName, allowed: limit, current },
  );
}

/** Enforce active-user seat limits. */
export async function enforceSeatLimit(organizationId, { allowSelfId } = {}) {
  const { subscription, plan, blocked } = await getAccess(organizationId);
  if (blocked) throw ApiError.forbidden('Your subscription has expired. Renew your plan to add team members.');
  const seats = await Membership.countDocuments({
    organizationId, status: { $in: ['ACTIVE', 'INVITED'] },
    ...(allowSelfId ? { userId: { $ne: allowSelfId } } : {}),
  });
  if (seats + 1 > plan.limits.users) throw planLimitError('Team member', plan.limits.users, seats);
  return { seats, limit: plan.limits.users, plan };
}

export async function enforceLeadLimit(organizationId) {
  const { plan, blocked } = await getAccess(organizationId);
  if (blocked) throw ApiError.forbidden('Your subscription has expired. New records are disabled until renewal.');
  if (!plan.limits.activeLeads) return;
  const count = await Lead.countDocuments({ organizationId, status: { $in: CONVERTIBLE_LEAD_STATUSES } });
  if (count >= plan.limits.activeLeads) throw planLimitError('Active lead', plan.limits.activeLeads, count);
}

export async function enforceCaseLimit(organizationId) {
  const { plan, blocked } = await getAccess(organizationId);
  if (blocked) throw ApiError.forbidden('Your subscription has expired. New records are disabled until renewal.');
  if (!plan.limits.activeCases) return;
  const count = await ImmigrationCase.countDocuments({ organizationId, status: { $in: ACTIVE_CASE_STATUSES } });
  if (count >= plan.limits.activeCases) throw planLimitError('Active case', plan.limits.activeCases, count);
}

export async function assertFeature(organizationId, feature, label) {
  const { plan, blocked } = await getAccess(organizationId);
  if (blocked) throw ApiError.forbidden('Your subscription has expired.');
  if (!plan.limits[feature]) {
    throw ApiError.upgradeRequired(`${label} is available on the Professional plan and above.`, { feature, currentPlan: plan.key });
  }
  return plan;
}

export async function usageSummary(organizationId) {
  const [subs, leads, cases, members] = await Promise.all([
    getSubscription(organizationId),
    Lead.countDocuments({ organizationId, status: { $in: CONVERTIBLE_LEAD_STATUSES } }),
    ImmigrationCase.countDocuments({ organizationId, status: { $in: ACTIVE_CASE_STATUSES } }),
    Membership.countDocuments({ organizationId, status: { $in: ['ACTIVE', 'INVITED'] } }),
  ]);
  const plan = planFor(subs.plan);
  return {
    subscription: subs,
    plan,
    usage: {
      users: { used: members, limit: plan.limits.users },
      activeLeads: { used: leads, limit: plan.limits.activeLeads },
      activeCases: { used: cases, limit: plan.limits.activeCases },
    },
  };
}

export { ACTIVE_SUB_STATUSES };
