import { Router } from 'express';
import express from 'express';
import Subscription from '../models/Subscription.js';
import Organization from '../models/Organization.js';
import { verifyStripeSignature, verifyRazorpaySignature } from '../middleware/security.js';
import { auditRaw } from '../services/audit.js';
import env, { flags } from '../config/env.js';

const router = Router();

const activatePlan = async (organizationId, plan, { provider, periodEnd, customerId, subscriptionId }) => {
  const sub = await Subscription.findOne({ organizationId });
  if (!sub) return null;
  sub.plan = plan || sub.plan;
  sub.status = 'ACTIVE';
  sub.provider = provider;
  sub.providerCustomerId = customerId || sub.providerCustomerId;
  sub.providerSubscriptionId = subscriptionId || sub.providerSubscriptionId;
  sub.currentPeriodStart = new Date();
  sub.currentPeriodEnd = periodEnd || new Date(Date.now() + 30 * 86400000);
  sub.cancelAtPeriodEnd = false;
  sub.cancelledAt = undefined;
  await sub.save();
  await Organization.updateOne({ _id: organizationId }, { status: 'ACTIVE' });
  await auditRaw({ organizationId, actorName: `${provider} webhook`, actorRole: 'SYSTEM', action: 'subscription.activated', description: `Plan ${sub.plan} activated via ${provider}` });
  return sub;
};

/** Stripe webhook — verified with the endpoint signing secret. */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!flags.stripe) return res.status(503).json({ error: 'Stripe is not configured' });
  const raw = req.body.toString('utf8');
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET)) {
    // eslint-disable-next-line no-console
    console.warn('[webhook] Stripe signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  try {
    const obj = event.data?.object || {};
    const orgId = obj.metadata?.organizationId || obj.subscription_details?.metadata?.organizationId;
    switch (event.type) {
      case 'checkout.session.completed':
        if (orgId) await activatePlan(orgId, obj.metadata?.plan, { provider: 'STRIPE', customerId: obj.customer, subscriptionId: obj.subscription });
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        if (orgId && ['active', 'trialing'].includes(obj.status)) {
          await activatePlan(orgId, obj.metadata?.plan, { provider: 'STRIPE', periodEnd: obj.current_period_end ? new Date(obj.current_period_end * 1000) : undefined, customerId: obj.customer, subscriptionId: obj.id });
        }
        break;
      case 'invoice.payment_succeeded':
        if (orgId) {
          const sub = await Subscription.findOne({ organizationId: orgId });
          if (sub) {
            sub.lastPaymentAt = new Date();
            sub.lastPaymentAmount = (obj.amount_paid || 0) / 100;
            sub.billingHistory.push({ date: new Date(), plan: sub.plan, amount: (obj.amount_paid || 0) / 100, currency: (obj.currency || 'usd').toUpperCase(), status: 'PAID', provider: 'STRIPE', reference: obj.id, description: 'Subscription payment' });
            if (sub.status !== 'ACTIVE') sub.status = 'ACTIVE';
            await sub.save();
            await Organization.updateOne({ _id: orgId }, { status: 'ACTIVE' });
          }
        }
        break;
      case 'invoice.payment_failed':
        if (orgId) {
          await Subscription.updateOne({ organizationId: orgId }, { status: 'PAST_DUE' });
          await Organization.updateOne({ _id: orgId }, { status: 'PAST_DUE' });
        }
        break;
      case 'customer.subscription.deleted':
        if (orgId) {
          await Subscription.updateOne({ organizationId: orgId }, { status: 'CANCELLED', cancelledAt: new Date(), endedAt: new Date() });
          await Organization.updateOne({ _id: orgId }, { status: 'CANCELLED' });
        }
        break;
      default: break;
    }
    res.json({ received: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[webhook] Stripe handling error', err.message);
    res.status(500).json({ error: 'Webhook handler error' });
  }
});

/** Razorpay webhook — HMAC SHA256 of raw body with the webhook secret. */
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!flags.razorpay) return res.status(503).json({ error: 'Razorpay is not configured' });
  const raw = req.body.toString('utf8');
  if (!verifyRazorpaySignature(raw, req.headers['x-razorpay-signature'], env.RAZORPAY_WEBHOOK_SECRET)) {
    // eslint-disable-next-line no-console
    console.warn('[webhook] Razorpay signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  try {
    const entity = event.payload?.subscription?.entity || event.payload?.payment?.entity || {};
    const orgId = entity.notes?.organizationId;
    if (event.event === 'subscription.activated' && orgId) {
      await activatePlan(orgId, entity.notes?.plan, { provider: 'RAZORPAY', subscriptionId: entity.id });
    } else if (['subscription.charged', 'payment.captured'].includes(event.event) && orgId) {
      const sub = await Subscription.findOne({ organizationId: orgId });
      if (sub) {
        sub.lastPaymentAt = new Date();
        sub.lastPaymentAmount = (entity.amount || 0) / 100;
        sub.billingHistory.push({ date: new Date(), plan: sub.plan, amount: (entity.amount || 0) / 100, currency: entity.currency || 'INR', status: 'PAID', provider: 'RAZORPAY', reference: entity.id, description: 'Subscription payment' });
        await sub.save();
      }
    } else if (['subscription.halted', 'subscription.cancelled'].includes(event.event) && orgId) {
      await Subscription.updateOne({ organizationId: orgId }, { status: event.event === 'subscription.cancelled' ? 'CANCELLED' : 'PAST_DUE' });
    }
    res.json({ received: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[webhook] Razorpay handling error', err.message);
    res.status(500).json({ error: 'Webhook handler error' });
  }
});

export default router;
