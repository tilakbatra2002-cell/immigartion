import { Badge } from '../ui';
import { CASE_STATUSES, LEAD_STATUSES, DOC_STATUSES, labelFor } from '../../lib/constants';

const CASE_TONE = Object.fromEntries(CASE_STATUSES.map((s) => [s.key, s.color]));
const LEAD_TONE = Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, s.color]));

export function CaseStatus({ status, size }) {
  return <Badge tone={CASE_TONE[status] || 'neutral'} dot size={size}>{labelFor(CASE_STATUSES, status)}</Badge>;
}
export function LeadStatus({ status, size }) {
  return <Badge tone={LEAD_TONE[status] || 'neutral'} dot size={size}>{labelFor(LEAD_STATUSES, status)}</Badge>;
}
export function DocStatus({ status, size }) {
  const tone = DOC_STATUSES.find((s) => s.key === status)?.tone || 'neutral';
  return <Badge tone={tone} size={size}>{labelFor(DOC_STATUSES, status)}</Badge>;
}
const PRIORITY_TONE = { LOW: 'muted', MEDIUM: 'info', HIGH: 'warning', URGENT: 'danger' };
export function Priority({ value, size }) {
  if (!value) return null;
  return <Badge tone={PRIORITY_TONE[value] || 'neutral'} size={size}>{value.charAt(0) + value.slice(1).toLowerCase()}</Badge>;
}
const INVOICE_TONE = { DRAFT: 'muted', SENT: 'info', PARTIALLY_PAID: 'warning', PAID: 'success', OVERDUE: 'danger', CANCELLED: 'neutral' };
export function InvoiceStatus({ status }) {
  return <Badge tone={INVOICE_TONE[status] || 'neutral'} dot>{String(status || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase())}</Badge>;
}
const APPT_TONE = { SCHEDULED: 'info', CONFIRMED: 'indigo', COMPLETED: 'success', CANCELLED: 'danger', NO_SHOW: 'warning', RESCHEDULED: 'violet' };
export function AppointmentStatus({ status }) {
  return <Badge tone={APPT_TONE[status] || 'neutral'} dot>{String(status || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase())}</Badge>;
}
const TASK_TONE = { OPEN: 'info', IN_PROGRESS: 'indigo', COMPLETED: 'success', CANCELLED: 'muted' };
export function TaskStatus({ status }) {
  return <Badge tone={TASK_TONE[status] || 'neutral'}>{String(status || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase())}</Badge>;
}
