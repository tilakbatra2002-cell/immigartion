import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BarChart3, TrendingUp, Building2, CreditCard } from 'lucide-react';
import { api } from '../../lib/api';
import { ErrorState, PageSkeleton, EmptyState } from '../../components/ui';

const axis = { fontSize: 10, fill: '#6B7280' };

export default function AdminAnalytics() {
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get('/admin/overview') });
  const analytics = useQuery({ queryKey: ['admin', 'analytics'], queryFn: () => api.get('/admin/analytics') });
  if (overview.isLoading || analytics.isLoading) return <PageSkeleton />;
  if (overview.isError) return <ErrorState message={overview.error?.message} onRetry={overview.refetch} />;

  const orgMonthly = analytics.data?.organizationsByMonth || [];
  const caseMonthly = analytics.data?.casesByMonth || [];
  const o = overview.data;
  const totalOrgs = o.organizations.total;
  const activeOrgs = o.organizations.byStatus?.ACTIVE || 0;
  const trialOrgs = o.organizations.byStatus?.TRIAL || 0;

  return (
    <div className="page-enter">
      <div className="mb-4"><h1 className="text-lg font-extrabold tracking-tight text-ink">Platform analytics</h1><p className="mt-0.5 text-xs text-ink-soft">Aggregate metrics across all tenants. No per-client personal data is shown here.</p></div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Total organizations" value={totalOrgs} icon={Building2} />
        <Kpi label="Active" value={activeOrgs} icon={TrendingUp} />
        <Kpi label="On trial" value={trialOrgs} icon={TrendingUp} />
        <Kpi label="Conversion to paid" value={totalOrgs ? `${Math.round((activeOrgs / totalOrgs) * 100)}%` : '—'} icon={BarChart3} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="New organizations per month" empty={!orgMonthly.length}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={orgMonthly} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" vertical={false} />
              <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
              <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Bar dataKey="count" name="Organizations" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cases created per month" empty={!caseMonthly.length}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={caseMonthly} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" vertical={false} />
              <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
              <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Line type="monotone" dataKey="count" name="Cases" stroke="#101828" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-4 card overflow-hidden">
        <div className="border-b border-line px-4 py-3"><h2 className="text-sm font-bold text-ink">Subscription state breakdown</h2></div>
        {!o.subscriptions?.length ? <EmptyState icon={CreditCard} title="No subscription data" description="Data appears once organizations sign up." /> : (
          <table className="w-full"><thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Plan</th><th className="table-th">Status</th><th className="table-th text-right">Organizations</th></tr></thead>
            <tbody className="divide-y divide-line">{o.subscriptions.map((r) => (
              <tr key={`${r.plan}-${r.status}`}><td className="table-td text-xs font-medium">{r.plan.toLowerCase()}</td><td className="table-td text-2xs text-ink-soft">{r.status.toLowerCase()}</td><td className="table-td text-right text-xs font-semibold">{r.count}</td></tr>
            ))}</tbody></table>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return <div className="card p-3"><p className="text-2xs text-ink-faint">{label}</p><p className="font-ui text-lg font-bold text-ink">{value}</p></div>;
}
function ChartCard({ title, children, empty }) {
  return <div className="card p-4"><h2 className="mb-2 text-sm font-bold text-ink">{title}</h2>{empty ? <p className="py-16 text-center text-2xs text-ink-faint">Not enough data yet — charts fill in as the platform grows.</p> : children}</div>;
}
