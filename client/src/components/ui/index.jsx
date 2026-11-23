import { forwardRef, useId } from 'react';
import { Loader2, X, ChevronLeft, ChevronRight, Search, Inbox, AlertCircle, RefreshCw } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

/* ─────────────── Button ─────────────── */
const BTN_VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-card disabled:bg-brand-300',
  secondary: 'bg-white text-ink border border-line hover:bg-slate-50 active:bg-slate-100 shadow-card disabled:text-ink-faint',
  ghost: 'text-ink-soft hover:bg-slate-100 hover:text-ink disabled:text-ink-faint',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-card disabled:bg-red-300',
  'danger-outline': 'border border-red-200 text-red-700 bg-white hover:bg-red-50',
  dark: 'bg-navy text-white hover:bg-slate-800 shadow-card',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-card',
};
const BTN_SIZES = { xs: 'h-7 px-2.5 text-xs gap-1', sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-9 px-3.5 text-sm gap-2', lg: 'h-10 px-5 text-sm gap-2' };

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading, icon: Icon, children, className, disabled, ...props }, ref,
) {
  return (
    <button ref={ref} disabled={disabled || loading}
      className={cx('focus-ring inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-colors', BTN_VARIANTS[variant], BTN_SIZES[size], className)}
      {...props}>
      {loading ? <Loader2 size={size === 'xs' ? 12 : 14} className="animate-spin" /> : Icon ? <Icon size={size === 'xs' ? 12 : 15} strokeWidth={2.2} /> : null}
      {children}
    </button>
  );
});

/* ─────────────── Badge ─────────────── */
const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  info: 'bg-brand-50 text-brand-700 ring-brand-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200',
  cyan: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  stone: 'bg-stone-100 text-stone-700 ring-stone-200',
  muted: 'bg-slate-50 text-ink-faint ring-slate-200',
  orange: 'bg-orange-50 text-orange-800 ring-orange-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  gray: 'bg-gray-100 text-gray-600 ring-gray-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};
export function Badge({ tone = 'neutral', children, dot, className, size = 'md' }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md font-semibold ring-1 ring-inset',
      size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs', TONES[tone] || TONES.neutral, className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', {
        success: 'bg-emerald-500', danger: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-brand-500',
      }[tone] || 'bg-slate-400')} />}
      {children}
    </span>
  );
}

/* ─────────────── Inputs ─────────────── */
export const Input = forwardRef(function Input({ label, error, hint, icon: Icon, suffix, required, className, id, ...props }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold text-ink">
          {label}{required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />}
        <input ref={ref} id={inputId} aria-invalid={Boolean(error)}
          className={cx('input-base', Icon && 'pl-9', suffix && 'pr-12', error && 'border-red-300 focus:border-red-400 focus:ring-red-500/10')} {...props} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-faint">{suffix}</span>}
      </div>
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, className, rows = 3, id, ...props }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold text-ink">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>}
      <textarea ref={ref} id={inputId} rows={rows} className={cx('input-base resize-y', error && 'border-red-300')} {...props} />
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, children, required, className, placeholder, id, ...props }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold text-ink">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>}
      <select ref={ref} id={inputId} className={cx('input-base appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23667085\' stroke-width=\'2.5\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8', error && 'border-red-300')} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
});

export function Checkbox({ label, checked, onChange, disabled, className, id }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <label htmlFor={inputId} className={cx('flex cursor-pointer select-none items-center gap-2 text-sm text-ink', disabled && 'cursor-not-allowed opacity-60', className)}>
      <input id={inputId} type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30" />
      {label}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cx('relative', className)}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="input-base h-9 w-full pl-9 pr-8" />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:bg-slate-100" aria-label="Clear search">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/* ─────────────── Modal ─────────────── */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true }) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-7xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]" onClick={closeOnBackdrop ? onClose : undefined} />
      <div className={cx('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-modal sm:rounded-xl', widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-faint hover:bg-slate-100" aria-label="Close dialog"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-slate-50/70 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ─────────────── States ─────────────── */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-slate-50 text-ink-faint">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <h3 className="mt-3.5 text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertCircle size={20} /></div>
      <h3 className="mt-3.5 text-sm font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-md text-xs text-ink-soft">{message}</p>}
      {onRetry && <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-4">Retry</Button>}
    </div>
  );
}

export const Skeleton = ({ className }) => <div className={cx('skeleton', className)} />;

export function TableSkeleton({ rows = 6, cols = 5, bare = false }) {
  // `bare` renders a <tbody> for tables that own their <table> element (DataTable).
  // Otherwise a self-contained <table> is rendered so table pages can drop it in
  // anywhere without invalid DOM nesting.
  const body = Array.from({ length: rows }).map((_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c} className="px-4 py-3.5">
          <Skeleton className={cx('h-3.5', c === 0 ? 'w-[70%]' : c === cols - 1 ? 'w-[40%] ml-auto' : 'w-[85%]')} />
        </td>
      ))}
    </tr>
  ));
  if (bare) return <>{body}</>; // rendered inside DataTable's own <tbody>
  return (
    <table className="w-full border-collapse" aria-busy="true" aria-live="polite">
      <thead><tr className="border-b border-line bg-slate-50/70">{[...Array(cols)].map((_, c) => <th key={c} className="table-th">&nbsp;</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{body}</tbody>
    </table>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-72" /></div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-card" />)}</div>
      <Skeleton className="h-80 rounded-card" />
    </div>
  );
}

/* ─────────────── Pagination ─────────────── */
export function Pagination({ meta, onPage, className }) {
  if (!meta || meta.pages <= 1) {
    return meta?.total ? <div className={cx('px-4 py-3 text-xs text-ink-soft', className)}>{meta.total} record{meta.total === 1 ? '' : 's'}</div> : null;
  }
  const start = (meta.page - 1) * meta.limit + 1;
  const endItem = Math.min(meta.page * meta.limit, meta.total);
  const window = [];
  for (let p = Math.max(1, meta.page - 1); p <= Math.min(meta.pages, meta.page + 1); p += 1) window.push(p);
  return (
    <div className={cx('flex flex-col items-center justify-between gap-2 border-t border-line px-4 py-3 sm:flex-row', className)}>
      <p className="text-xs text-ink-soft">Showing <span className="font-semibold text-ink">{start}–{endItem}</span> of <span className="font-semibold text-ink">{meta.total}</span></p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(meta.page - 1)} disabled={!meta.hasPrev}
          className="focus-ring rounded-md border border-line p-1.5 text-ink-soft hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button>
        {window[0] > 1 && <span className="px-1 text-xs text-ink-faint">…</span>}
        {window.map((p) => (
          <button key={p} onClick={() => onPage(p)}
            className={cx('focus-ring h-7 min-w-7 rounded-md px-2 text-xs font-semibold', p === meta.page ? 'bg-navy text-white' : 'border border-line text-ink-soft hover:bg-slate-50')}>{p}</button>
        ))}
        {window[window.length - 1] < meta.pages && <span className="px-1 text-xs text-ink-faint">…</span>}
        <button onClick={() => onPage(meta.page + 1)} disabled={!meta.hasNext}
          className="focus-ring rounded-md border border-line p-1.5 text-ink-soft hover:bg-slate-50 disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

/* ─────────────── Misc ─────────────── */
export function Avatar({ name = '', src, size = 'md', className }) {
  const sizes = { xs: 'h-6 w-6 text-2xs', sm: 'h-7 w-7 text-2xs', md: 'h-8 w-8 text-xs', lg: 'h-11 w-11 text-sm', xl: 'h-16 w-16 text-lg' };
  const init = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
  const palette = ['bg-brand-100 text-brand-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700'];
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  return src
    ? <img src={src} alt={name} className={cx('shrink-0 rounded-full object-cover', sizes[size], className)} />
    : <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-bold', sizes[size], palette[idx], className)}>{init}</span>;
}

export function Spinner({ className }) {
  return <Loader2 className={cx('animate-spin text-brand-600', className)} size={18} />;
}

export function Progress({ value = 0, tone = 'brand', className }) {
  const colors = { brand: 'bg-brand-600', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500' };
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className={cx('h-full rounded-full transition-all', colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto border-b border-line', className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={cx('focus-ring relative whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition',
            value === t.key ? 'text-ink' : 'text-ink-soft hover:text-ink')}>
          {t.label}
          {t.count !== undefined && <span className={cx('ml-1.5 rounded px-1.5 py-0.5 text-2xs', value === t.key ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-ink-faint')}>{t.count}</span>}
          {value === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  );
}

export function Tooltip({ label, children }) {
  return <span className="group relative inline-flex">{children}
    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-2xs font-medium text-white opacity-0 transition group-hover:opacity-100">{label}</span>
  </span>;
}

export function CopyButton({ text, className }) {
  return (
    <button type="button" onClick={() => navigator.clipboard?.writeText(text)} title="Copy"
      className={cx('rounded p-1 text-ink-faint hover:bg-slate-100 hover:text-ink', className)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
    </button>
  );
}
