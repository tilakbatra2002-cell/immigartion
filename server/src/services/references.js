import mongoose from 'mongoose';
import { nextSequence } from '../models/Counter.js';

const pad = (n, len = 4) => String(n).padStart(len, '0');

/** Human-readable per-tenant references: CASE-2026-0001, LED-2026-0001, INV-2026-0001, CLT-0001. */
export async function nextReference(organizationId, kind) {
  const year = new Date().getFullYear();
  const key = `${kind}-${year}`;
  const seq = await nextSequence(new mongoose.Types.ObjectId(organizationId), key);
  const prefix = { CASE: 'CASE', LEAD: 'LED', CLIENT: 'CLT', INVOICE: 'INV', QUOTATION: 'QTN', PAYMENT: 'PAY' }[kind] || 'REF';
  if (kind === 'CLIENT') return `${prefix}-${pad(seq, 5)}`;
  return `${prefix}-${year}-${pad(seq)}`;
}
