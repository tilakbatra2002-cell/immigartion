import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, EmptyState, ErrorState, SearchInput, TableSkeleton, Select, Pagination } from '../../components/ui';
import { date, money } from '../../lib/format';

const STATUS_TONE = { TRIALING: 'info', ACTIVE: 'success', PAST_DUE: 'danger', CANCELLED: 'muted', EXPIRED: 'warning', PAUSED: 'warning' };

export default function AdminSubscriptions() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'subs', page, q, plan],
    queryFn: () => api.get(`/admin/organizations?page=${page}&limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}${plan ? `&plan=${plan}` : ''}`),
  });
  const revenue = useQuery({ queryKey: ['admin', 'revenue'], queryFn: () => api.get('/admin/revenue') });

  return (
    <div className="page-enter">
      <div className="mb-4"><h1 className="text-lg font-extrabold tracking-tight text-ink">Subscriptions</h1><p className="mt-0.5 text-xs text-ink-soft">Plan state per organization. Changes should normally arrive from payment provider webhooks.</p></div>

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <div className="card p-3"><p className="text-2xs text-ink-faint">Active subscriptions</p><p className="font-ui text-base font-bold text-ink">{revenue.data?.activeSubscriptions ?? '—'}</p></div>
        <div className="card p-3"><p className="text-2xs text-ink-faint">Monthly recurring revenue</p>
          <p className="font-ui text-base font-bold text-ink">{Object.entries(revenue.data?.monthlyRecurringByCurrency || {}).map(([c, v]) => money(v, c)).join(' · ') || money(0, 'INR')}</p>
          <p className="text-[10px] text-ink-faint">Subscription revenue only — derived from plan pricing</p></div>
        <div className="card p-3"><p className="text-2xs text-ink-faint">Payment providers</p>
          <div className="mt-1 flex gap-1"><Badge tone={revenue.data?.providers?.stripe ? 'success' : 'muted'} size="sm">stripe</Badge><Badge tone={revenue.data?.providers?.razorpay ? 'success' : 'muted'} size="sm">razorpay</Badge></div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search organization…" className="w-full sm:w-60" />
          <Select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className="h-8 w-36 text-xs" placeholder="All plans">
            {['STARTER', 'PROFESSIONAL', 'BUSINESS'].map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
          </Select>
        </div>
        {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : isLoading ? <TableSkeleton rows={6} cols={5} /> : !data?.data?.length ? <EmptyState icon={CreditCard} title="No subscriptions" description="Subscriptions are created when an organization signs up." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Organization</th><th className="table-th">Plan</th><th className="table-th">Status</th><th className="table-th">Cycle</th><th className="table-th">Renews / ends</th><th className="table-th">Provider</th><th className="table-th"></th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.data.map((o) => {
                  const s = o.subscription;
                  return (
                    <tr key={o._id} className="hover:bg-slate-50/60">
                      <td className="table-td"><p className="text-xs font-semibold text-ink">{o.name}</p><p className="text-2xs text-ink-faint">{o.memberCount} members</p></td>
                      <td className="table-td"><Badge tone="info" size="sm">{s?.plan?.toLowerCase() || '—'}</Badge></td>
                      <td className="table-td"><Badge tone={STATUS_TONE[s?.status] || 'muted'} size="sm">{s?.status?.toLowerCase() || 'none'}</Badge></td>
                      <td className="table-td text-2xs text-ink-soft">{s?.billingCycle?.toLowerCase() || '—'}</td>
                      <td className="table-td text-2xs text-ink-soft">{s?.status === 'TRIALING' && s?.trialEndsAt ? `Trial ends ${date(s.trialEndsAt)}` : s?.currentPeriodEnd ? date(s.currentPeriodEnd) : '—'}</td>
                      <td className="table-td text-2xs text-ink-soft">{s?.provider?.toLowerCase() || 'none'}</td>
                      <td className="table-td text-right"><Link to={`/admin/organizations/${o._id}`} className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-700">Manage <ArrowRight size={10} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data?.meta?.pages > 1 && <div className="border-t border-line px-3 py-2"><Pagination meta={data.meta} onPage={setPage} /></div>}
      </div>
    </div>
  );
}
