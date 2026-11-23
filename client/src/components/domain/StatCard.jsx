import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cx, Skeleton } from '../ui';

export default function StatCard({ label, value, icon: Icon, hint, delta, tone = 'default', to, loading, alert }) {
  const tones = {
    default: 'text-ink', brand: 'text-brand-700', success: 'text-emerald-700', warning: 'text-amber-700', danger: 'text-red-700',
  };
  const body = (
    <div className={cx('card group h-full p-3.5 transition', to && 'hover:border-slate-300 hover:shadow-pop', alert && 'border-red-200 bg-red-25/30')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
        {Icon && (
          <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', alert ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-ink-faint group-hover:text-ink-soft')}>
            <Icon size={14} strokeWidth={2} />
          </span>
        )}
      </div>
      {loading ? <Skeleton className="mt-2 h-7 w-20" /> : <p className={cx('mt-1.5 font-ui text-[22px] font-bold leading-tight tracking-tight', tones[tone])}>{value}</p>}
      <div className="mt-1 flex items-center gap-1.5">
        {delta !== undefined && delta !== null && (
          <span className={cx('flex items-center gap-0.5 text-2xs font-semibold', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(delta)}%
          </span>
        )}
        {hint && <p className="truncate text-2xs text-ink-faint">{hint}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}
