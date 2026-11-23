import mongoose from 'mongoose';
import { PLAN_KEYS } from '../config/plans.js';

const subscriptionSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
  plan: { type: String, enum: PLAN_KEYS, default: 'STARTER' },
  status: { type: String, enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'PAUSED'], default: 'TRIALING', index: true },
  billingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },
  currency: { type: String, enum: ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'], default: 'INR' },
  trialEndsAt: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: Date,
  endedAt: Date,
  provider: { type: String, enum: ['NONE', 'STRIPE', 'RAZORPAY', 'MANUAL'], default: 'NONE' },
  providerCustomerId: String,
  providerSubscriptionId: String,
  providerPlanId: String,
  lastPaymentAt: Date,
  lastPaymentAmount: Number,
  billingHistory: { type: [{
    date: Date, plan: String, amount: Number, currency: String, status: String,
    provider: String, reference: String, invoicePdfUrl: String, description: String,
  }], default: [] },
}, { timestamps: true });

subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
