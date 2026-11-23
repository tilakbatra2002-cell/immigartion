import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, CreditCard, Briefcase, TrendingUp, ArrowRight, Activity } from 'lucide-react';
import { api } from '../../lib/api';
import StatCard from '../../components/domain/StatCard';
import { Badge, ErrorState, PageSkeleton, EmptyState } from '../../components/ui';
import { money } from '../../lib/format';
import { date } from '../../lib/format';

export default function AdminDashboard() {
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get('/admin/overview') });
  const revenue = useQuery({ queryKey: ['admin', 'revenue'], queryFn: () => api.get('/admin/revenue') });
  const system = useQuery({ queryKey: ['admin', 'system'], queryFn: () => api.get('/admin/system') });

  if (overview.isLoading) return <PageSkeleton />;
  if (overview.isError) return <ErrorState message={overview.error?.message} onRetry={overview.refetch} />;
  const o = overview.data;
  const mrr = revenue.data?.monthlyRecurringByCurrency || {};

  return (
    <div className="page-enter">
      <div className="mb-4">
        <h1 className="text-lg font-extrabold tracking-tight text-ink">Platform overview</h1>
        <p className="mt-0.5 text-xs text-ink-soft">All figures are computed live from the production database.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Organizations" value={o.organizations.total} hint={`${o.organizations.byStatus?.ACTIVE || 0} active · ${o.organizations.byStatus?.TRIAL || 0} trial`} />
        <StatCard icon={Users} label="Platform users" value={o.users} sub="Staff accounts (excl. portal)" />
        <StatCard icon={CreditCard} label="Active subscriptions" value={revenue.data?.activeSubscriptions ?? '—'} hint={Object.entries(mrr).map(([c, v]) => money(v, c)).join(' · ') || 'No paid subscriptions'} />
        <StatCard icon={Briefcase} label="Records on platform" value={(o.totalCases + o.totalLeads).toLocaleString()} hint={`${o.totalCases.toLocaleString()} cases · ${o.totalLeads.toLocaleString()} leads`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-bold text-ink">Recent organizations</h2><Link to="/admin/organizations" className="text-2xs font-semibold text-brand-700">Manage →</Link></div>
          {!o.recentOrganizations?.length ? <EmptyState icon={Building2} title="No organizations" description="Signups will appear here." /> : (
            <div className="divide-y divide-line">
              {o.recentOrganizations.map((org) => (
                <Link key={org._id} to={`/admin/organizations/${org._id}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50/70">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-navy/5 font-ui text-2xs font-bold text-navy">{org.name?.[0]?.toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink">{org.name}</p><p className="text-2xs text-ink-faint">{org.slug} · joined {date(org.createdAt)}</p></div>
                  <Badge tone={org.status === 'ACTIVE' ? 'success' : org.status === 'TRIAL' ? 'info' : org.status === 'SUSPENDED' ? 'danger' : 'muted'} size="sm">{org.status.toLowerCase()}</Badge>
                  <ArrowRight size={12} className="text-ink-faint" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="card p-4">
            <h2 className="text-sm font-bold text-ink">Plan distribution</h2>
            <div className="mt-2 space-y-1.5">
              {['STARTER', 'PROFESSIONAL', 'BUSINESS'].map((p) => (
                <div key={p} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5">
                  <span className="text-xs text-ink">{p.charAt(0) + p.slice(1).toLowerCase()}</span>
                  <span className="font-ui text-xs font-bold text-ink">{o.activeByPlan?.[p] || 0}<span className="ml-1 text-[10px] font-normal text-ink-faint">active</span></span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink"><Activity size={13} />System status</h2>
            {system.data ? (
              <div className="mt-2 space-y-1 text-2xs">
                <Row k="Environment" v={system.data.environment} />
                <Row k="Database" v={system.data.database} ok={system.data.database === 'connected'} />
                <Row k="Storage" v={system.data.storageDriver} />
                <Row k="Uptime" v={`${Math.floor(system.data.uptimeSeconds / 60)} min`} />
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(system.data.integrations).map(([k, v]) => <Badge key={k} tone={v ? 'success' : 'muted'} size="sm">{k}</Badge>)}
                </div>
              </div>
            ) : <p className="mt-2 text-2xs text-ink-faint">Loading…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, ok }) {
  return <div className="flex justify-between"><span className="text-ink-soft">{k}</span><span className={`font-medium ${ok === false ? 'text-red-600' : ok ? 'text-emerald-600' : 'text-ink'}`}>{v}</span></div>;
}
