export const CURRENCIES = ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'];
export const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', GBP: '£', AUD: 'A$', NZD: 'NZ$', CAD: 'C$' };
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function formatMoney(amount = 0, currency = 'INR', { compact = false } = {}) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: compact ? 0 : 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${CURRENCY_SYMBOLS[currency] || ''}${Number(amount || 0).toFixed(2)}`;
  }
}

/** Compute invoice totals server-side. Never trust client-sent totals. */
export function computeInvoiceTotals({ items = [], discountType = 'FIXED', discountValue = 0, taxRate = 0 }) {
  const normalized = items.map((it) => {
    const quantity = Number(it.quantity ?? 1);
    const unitPrice = Number(it.unitPrice ?? 0);
    const amount = round2(quantity * unitPrice);
    return { ...it, quantity, unitPrice, amount };
  });
  const subtotal = round2(normalized.reduce((s, it) => s + it.amount, 0));
  const discount = discountType === 'PERCENT'
    ? round2((subtotal * Number(discountValue || 0)) / 100)
    : round2(Number(discountValue || 0));
  const taxable = Math.max(0, round2(subtotal - discount));
  const taxAmount = round2((taxable * Number(taxRate || 0)) / 100);
  const total = round2(taxable + taxAmount);
  return { items: normalized, subtotal, discount: Math.min(discount, subtotal), taxRate: Number(taxRate || 0), taxAmount, total };
}
