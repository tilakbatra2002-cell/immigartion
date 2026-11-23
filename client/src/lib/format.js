export const CURRENCIES = ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'];
const SYMBOLS = { INR: '₹', USD: '$', GBP: '£', AUD: 'A$', NZD: 'NZ$', CAD: 'C$' };
export const currencySymbol = (c) => SYMBOLS[c] || '';

export function money(amount, currency = 'INR', compact = false) {
  const n = Number(amount) || 0;
  // Whole amounts read better without trailing ".00" on dashboards and tables.
  const isWhole = Math.abs(n % 1) < 0.005;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : isWhole ? 0 : 2,
      minimumFractionDigits: compact ? 0 : isWhole ? 0 : 2,
    }).format(n);
  } catch { return `${SYMBOLS[currency] || ''}${n.toFixed(0)}`; }
}

export function num(n, compact = false) {
  return new Intl.NumberFormat('en-IN', { notation: compact ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(n) || 0);
}

export function date(d, { time = false, tz, short = false } = {}) {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: short ? 'short' : 'short', year: 'numeric',
      ...(time ? { hour: '2-digit', minute: '2-digit' } : {}), ...(tz ? { timeZone: tz } : {}),
    }).format(new Date(d));
  } catch { return new Date(d).toLocaleDateString(); }
}

export function dateTime(d, tz) { return date(d, { time: true, tz }); }

export function timeAgo(d) {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return date(d);
}

export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

export const relativeDays = (d) => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
};

export const toInputDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
};

export const toInputDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const off = x.getTimezoneOffset();
  return new Date(x.getTime() - off * 60000).toISOString().slice(0, 16);
};

export const fileSize = (bytes) => {
  if (!bytes) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
};
