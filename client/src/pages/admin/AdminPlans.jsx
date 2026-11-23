import { useQuery } from '@tanstack/react-query';
import { Package, Check, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, ErrorState, PageSkeleton } from '../../components/ui';
import { money } from '../../lib/format';

export default function AdminPlans() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api.get('/admin/plans') });
  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const usage = data.usage || [];
  const countFor = (plan, status) => usage.find((u) => u._id.plan === plan && u._id.status === status)?.count || 0;

  return (
    <div className="page-enter">
      <div className="mb-4"><h1 className="text-lg font-extrabold tracking-tight text-ink">Plans</h1><p className="mt-0.5 text-xs text-ink-soft">Plan definitions are configured in the server (config/plans.js) so limits are always enforced backend-side. Pricing is immutable here.</p></div>

      <div className="grid gap-3 lg:grid-cols-3">
        {data.plans.map((p) => (
          <div key={p.key} className="card p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-ink">{p.name}</h2>{p.popular && <Badge tone="info" size="sm">Popular</Badge>}</div>
            <p className="mt-0.5 text-2xs text-ink-soft">{p.description}</p>
            <div className="mt-2 space-y-0.5">{Object.entries(p.price).map(([c, v]) => <div key={c} className="flex justify-between text-2xs"><span className="text-ink-faint">{c}</span><span className="font-semibold text-ink">{money(v, c)}/mo</span></div>)}</div>
            <div className="mt-2 rounded-lg bg-canvas p-2 text-2xs text-ink-soft">
              <p>{p.limits.users} users · {p.limits.activeLeads.toLocaleString()} leads · {p.limits.activeCases.toLocaleString()} cases</p>
              <p className="mt-1">Active: <strong className="text-ink">{countFor(p.key, 'ACTIVE')}</strong> · Trialing: <strong className="text-ink">{countFor(p.key, 'TRIALING')}</strong> · Past due: <strong className="text-ink">{countFor(p.key, 'PAST_DUE')}</strong></p>
            </div>
            <ul className="mt-2 space-y-0.5">{p.features.map((f) => <li key={f} className="flex gap-1.5 text-2xs text-ink-soft"><Check size={10} className="mt-0.5 shrink-0 text-emerald-600" />{f}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-card border border-line bg-white p-3">
        <Info size={13} className="mt-0.5 shrink-0 text-ink-faint" />
        <p className="text-2xs leading-relaxed text-ink-soft">Editing plan pricing or limits is intentionally not available in the UI — it requires a code change and redeploy, so a stray click cannot change what customers are billed. Trial length is controlled by <code className="rounded bg-slate-100 px-1 text-[10px]">TRIAL_DAYS</code> on the server.</p>
      </div>
    </div>
  );
}
