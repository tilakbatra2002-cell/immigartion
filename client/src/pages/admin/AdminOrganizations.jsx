import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Button, EmptyState, ErrorState, Select, SearchInput, TableSkeleton, Pagination } from '../../components/ui';
import { date, money } from '../../lib/format';

export default function AdminOrganizations() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'orgs', page, q, status, plan],
    queryFn: () => api.get(`/admin/organizations?page=${page}&limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}${status ? `&status=${status}` : ''}${plan ? `&plan=${plan}` : ''}`),
  });

  return (
    <div className="page-enter">
      <div className="mb-4"><h1 className="text-lg font-extrabold tracking-tight text-ink">Organizations</h1><p className="mt-0.5 text-xs text-ink-soft">Every tenant on the platform. Data isolation is enforced server-side per organization.</p></div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, slug or email…" className="w-full sm:w-64" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-8 w-32 text-xs" placeholder="All statuses">
            {['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
          </Select>
          <Select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className="h-8 w-32 text-xs" placeholder="All plans">
            {['STARTER', 'PROFESSIONAL', 'BUSINESS'].map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
          </Select>
          {data?.meta && <span className="ml-auto text-2xs text-ink-faint">{data.meta.total} organization{data.meta.total === 1 ? '' : 's'}</span>}
        </div>
        {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : isLoading ? <TableSkeleton rows={6} cols={5} /> : !data?.data?.length ? <EmptyState icon={Building2} title="No organizations found" description="Adjust filters or wait for the first signup." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Organization</th><th className="table-th">Plan</th><th className="table-th">Status</th><th className="table-th">Members</th><th className="table-th">Trial / renewal</th><th className="table-th">Created</th><th className="table-th"></th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.data.map((o) => (
                  <tr key={o._id} className="hover:bg-slate-50/60">
                    <td className="table-td"><p className="text-xs font-semibold text-ink">{o.name}</p><p className="text-2xs text-ink-faint">{o.email || o.slug}</p></td>
                    <td className="table-td"><Badge tone="info" size="sm">{o.subscription?.plan?.toLowerCase() || 'none'}</Badge></td>
                    <td className="table-td"><Badge tone={o.status === 'ACTIVE' ? 'success' : o.status === 'TRIAL' ? 'info' : o.status === 'SUSPENDED' ? 'danger' : 'warning'} size="sm" dot>{o.status.toLowerCase()}</Badge></td>
                    <td className="table-td text-xs">{o.memberCount}</td>
                    <td className="table-td text-2xs text-ink-soft">{o.subscription?.status === 'TRIALING' && o.subscription?.trialEndsAt ? `Trial ends ${date(o.subscription.trialEndsAt)}` : o.subscription?.currentPeriodEnd ? date(o.subscription.currentPeriodEnd) : '—'}</td>
                    <td className="table-td text-2xs text-ink-soft">{date(o.createdAt)}</td>
                    <td className="table-td text-right"><Link to={`/admin/organizations/${o._id}`} className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-700">Open <ArrowRight size={10} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.meta?.pages > 1 && <div className="border-t border-line px-3 py-2"><Pagination meta={data.meta} onPage={setPage} /></div>}
      </div>
    </div>
  );
}
