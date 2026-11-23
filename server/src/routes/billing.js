import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import Subscription from '../models/Subscription.js';
import Organization from '../models/Organization.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { PLANS, PLAN_KEYS, TRIAL_DAYS, planFor } from '../config/plans.js';
import { usageSummary } from '../services/plans.js';
import { audit } from '../services/audit.js';
import { flags } from '../config/env.js';
import env from '../config/env.js';

const router = Router();
router.use(requireAuth, requireOrg);

router.get('/plans', asyncHandler(async (req, res) => {
  res.json({ plans: Object.values(PLANS), currencies: ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'] });
}));

router.get('/', requirePermission(PERMISSIONS.BILLING_VIEW), asyncHandler(async (req, res) => {
  const { subscription, plan, usage } = await usageSummary(req.organizationId);
  res.json({
    subscription, plan, usage,
    plans: Object.values(PLANS),
    providers: { stripe: flags.stripe, razorpay: flags.razorpay },
    trialDays: TRIAL_DAYS,
  });
}));

/**
 * Plan change. When a payment provider is configured, checkout must go through
 * the provider (see /checkout). Without a provider, we only allow switching to
 * STARTER (free downgrade) or recording an internal "MANUAL" activation that a
 * platform admin must confirm — we never fake a paid subscription.
 */
router.post('/change-plan', requirePermission(PERMISSIONS.BILLING_MANAGE), body(z.object({
  plan: z.enum(PLAN_KEYS), billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(), confirmManual: z.boolean().optional(),
})), asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({ organizationId: req.organizationId });
  if (!sub) throw ApiError.notFound('Subscription not found');
  const target = planFor(req.body.plan);
  const isDowngrade = target.order < planFor(sub.plan).order;

  if (isDowngrade) {
    sub.plan = req.body.plan;
    sub.cancelAtPeriodEnd = false;
    await sub.save();
    await audit(req, 'subscription.downgraded', { description: `Plan changed to ${target.name}` });
    return res.json({ subscription: sub, requiresPayment: false, message: `Downgraded to ${target.name}. Usage limits now apply.` });
  }

  const hasProvider = flags.stripe || flags.razorpay;
  if (hasProvider) {
    return res.json({
      requiresPayment: true,
      message: 'Complete checkout with your payment provider to activate the new plan.',
      checkoutEndpoint: '/api/billing/checkout',
      provider: flags.razorpay ? 'razorpay' : 'stripe',
    });
  }
  // No provider configured: do NOT silently activate a paid plan.
  if (!req.body.confirmManual) {
    throw ApiError.serviceUnavailable('No payment provider is configured. Plans can only be activated by a platform administrator. Contact support to enable Stripe or Razorpay.');
  }
  throw ApiError.forbidden('Paid plan activation requires a configured payment provider or platform administrator approval.');
}));

router.post('/cancel', requirePermission(PERMISSIONS.BILLING_MANAGE), body(z.object({ atPeriodEnd: z.boolean().default(true) })), asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({ organizationId: req.organizationId });
  if (!sub) throw ApiError.notFound('Subscription not found');
  if (sub.status === 'CANCELLED') throw ApiError.badRequest('Subscription is already cancelled.');
  if (req.body.atPeriodEnd) {
    sub.cancelAtPeriodEnd = true;
    await sub.save();
  } else {
    sub.status = 'CANCELLED';
    sub.cancelledAt = new Date();
    sub.endedAt = new Date();
    await sub.save();
    await Organization.updateOne({ _id: req.organizationId }, { status: 'CANCELLED' });
  }
  await audit(req, 'subscription.cancelled', { description: req.body.atPeriodEnd ? 'Cancellation scheduled at period end' : 'Subscription cancelled immediately' });
  res.json({ subscription: sub });
}));

router.post('/resume', requirePermission(PERMISSIONS.BILLING_MANAGE), asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({ organizationId: req.organizationId });
  if (!sub) throw ApiError.notFound('Subscription not found');
  if (!sub.cancelAtPeriodEnd) throw ApiError.badRequest('Subscription is not scheduled for cancellation.');
  sub.cancelAtPeriodEnd = false;
  await sub.save();
  await audit(req, 'subscription.resumed', { description: 'Cancellation reversed' });
  res.json({ subscription: sub });
}));

/**
 * Checkout session. Requires a real provider configuration.
 */
router.post('/checkout', requirePermission(PERMISSIONS.BILLING_MANAGE), body(z.object({
  plan: z.enum(PLAN_KEYS), provider: z.enum(['stripe', 'razorpay']), billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
})), asyncHandler(async (req, res) => {
  const { plan, provider } = req.body;
  if (provider === 'stripe' && !flags.stripe) throw ApiError.serviceUnavailable('Stripe is not configured.');
  if (provider === 'razorpay' && !flags.razorpay) throw ApiError.serviceUnavailable('Razorpay is not configured.');

  if (provider === 'stripe') {
    const priceId = { STARTER: env.STRIPE_PRICE_STARTER, PROFESSIONAL: env.STRIPE_PRICE_PROFESSIONAL, BUSINESS: env.STRIPE_PRICE_BUSINESS }[plan];
    if (!priceId) throw ApiError.serviceUnavailable(`No Stripe price configured for ${plan}. Set STRIPE_PRICE_${plan}.`);
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${env.APP_URL}/app/subscription?checkout=success`,
      cancel_url: `${env.APP_URL}/app/subscription?checkout=cancelled`,
      client_reference_id: String(req.organizationId),
      'metadata[organizationId]': String(req.organizationId),
      'metadata[plan]': plan,
      'subscription_data[metadata][organizationId]': String(req.organizationId),
      'subscription_data[metadata][plan]': plan,
    });
    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message || 'Stripe checkout failed');
    await audit(req, 'billing.checkout_started', { description: `Stripe checkout for ${plan}` });
    return res.json({ url: data.url, provider: 'stripe' });
  }

  // Razorpay subscription checkout
  const planId = { STARTER: env.RAZORPAY_PLAN_STARTER, PROFESSIONAL: env.RAZORPAY_PLAN_PROFESSIONAL, BUSINESS: env.RAZORPAY_PLAN_BUSINESS }[plan];
  if (!planId) throw ApiError.serviceUnavailable(`No Razorpay plan configured for ${plan}. Set RAZORPAY_PLAN_${plan}.`);
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const resp = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_id: planId, total_count: req.body.billingCycle === 'YEARLY' ? 1 : 12, quantity: 1, notes: { organizationId: String(req.organizationId), plan } }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.description || 'Razorpay subscription failed');
  await audit(req, 'billing.checkout_started', { description: `Razorpay subscription for ${plan}` });
  res.json({ subscriptionId: data.id, keyId: env.RAZORPAY_KEY_ID, provider: 'razorpay' });
}));

router.get('/invoices', requirePermission(PERMISSIONS.BILLING_VIEW), asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({ organizationId: req.organizationId }).lean();
  res.json({ data: (sub?.billingHistory || []).sort((a, b) => new Date(b.date) - new Date(a.date)) });
}));

export default router;
