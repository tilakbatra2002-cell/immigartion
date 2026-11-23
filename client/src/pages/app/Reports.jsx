import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Users, Briefcase, Wallet, FileWarning, CalendarDays, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { api, qs, downloadFile } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import FilterBar, { FilterSelect } from '../../components/domain/FilterBar';
import { Button, Tabs, EmptyState, ErrorState, PageSkeleton, Badge, Input } from '../../components/ui';
import { money, num, date } from '../../lib/format';
import { CASE_STATUSES, LEAD_STATUSES, VISA_CATEGORIES, labelFor } from '../../lib/constants';

const TONE = { slate: '#64748B', sky: '#0EA5E9', amber: '#F59E0B', blue: '#3B82F6', indigo: '#6366F1', violet: '#8B5CF6', cyan: '#06B6D4', orange: '#F97316', purple: '#A855F7', green: '#10B981', red: '#EF4444', stone: '#78716C', gray: '#6B7280' };
const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316', '#6366F1', '#64748B'];

export default function Reports() {
  const { can, organization } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('leads');
  const [range, setRange] = useState({ from: '', to: '', days: 90 });

  const query = qs({ from: range.from || undefined, to: range.to || undefined, days: range.days });

  const leads = useQuery({ queryKey: ['report', 'leads', query], queryFn: () => api.get(`/reports/lead-performance${query}`), enabled: tab === 'leads' });
  const cases = useQuery({ queryKey: ['report', 'cases', query], queryFn: () => api.get(`/reports/case-status${query}`), enabled: tab === 'cases' });
  const consultants = useQuery({ queryKey: ['report', 'consultants', query], queryFn: () => api.get(`/reports/consultant-performance${query}`), enabled: tab === 'consultants' });
  const revenue = useQuery({ queryKey: ['report', 'revenue', query], queryFn: () => api.get(`/reports/revenue${query}`), enabled: tab === 'revenue' });
  const docs = useQuery({ queryKey: ['report', 'docs'], queryFn: () => api.get('/reports/pending-documents'), enabled: tab === 'documents' });
  const appts = useQuery({ queryKey: ['report', 'appts', query], queryFn: () => api.get(`/reports/appointments${query}`), enabled: tab === 'appointments' });

  const exportCsv = async (title, columns, rows) => {
    if (!can('reports.export')) { toast.error('Export not permitted', 'Your role cannot export reports.'); return; }
    try {
      const { getAccessToken, API_BASE } = await import('../../lib/api');
      const res = await fetch(`${API_BASE}/reports/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken()}` },
        body: JSON.stringify({ title, columns, rows }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Export failed'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${title}.csv`; a.click(); URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch (e) { toast.error('Export failed', e.message); }
  };

  const tabs = [
    { key: 'leads', label: 'Lead performance' },
    { key: 'cases', label: 'Cases' },
    { key: 'consultants', label: 'Consultants' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'documents', label: 'Pending documents' },
    { key: 'appointments', label: 'Appointments' },
  ];

  const active = { leads, cases, consultants, revenue, docs, appts }[tab];
  const currency = revenue.data?.currency || organization?.currency || 'INR';

  return (
    <div className="page-enter">
      <PageHeader title="Reports" description="Computed live from your organization's database, filtered by date range and permission-restricted."
        actions={<Badge tone="muted">Range: {range.from || range.to ? `${range.from || '…'} → ${range.to || 'today'}` : `Last ${range.days} days`}</Badge>} />

      <div className="card mb-3 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="border-0" />
          <FilterBar>
            <FilterSelect value={String(range.days)} onChange={(v) => setRange({ ...range, days: Number(v), from: '', to: '' })} options={[{ key: '30', label: 'Last 30 days' }, { key: '90', label: 'Last 90 days' }, { key: '180', label: 'Last 180 days' }, { key: '365', label: 'Last 12 months' }]} />
            <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 rounded-lg border border-line px-2 text-xs text-ink-soft" aria-label="From date" />
            <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 rounded-lg border border-line px-2 text-xs text-ink-soft" aria-label="To date" />
          </FilterBar>
        </div>

        <div className="p-4">
          {active.isLoading ? <PageSkeleton />
            : active.isError ? <ErrorState message={active.error?.message} onRetry={active.refetch} />
            : tab === 'leads' && leads.data ? (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard title="Leads by status" subtitle="Current pipeline distribution">
                    {leads.data.byStatus.every((s) => s.count === 0) ? <EmptyState icon={Users} title="No lead data in range" className="py-8" /> : (
                      <div className="h-[220px]"><ResponsiveContainer>
                        <BarChart data={leads.data.byStatus} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#98A2B3' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={44} />
                          <YAxis tick={{ fontSize: 10, fill: '#98A2B3' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                          <Bar dataKey="count" radius={[3, 3, 0, 0]} name="Leads">
                            {leads.data.byStatus.map((s, i) => <Cell key={s.key} fill={TONE[LEAD_STATUSES.find((x) => x.key === s.key)?.color] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer></div>
                    )}
                  </ChartCard>
                  <ChartCard title="Conversion by source" subtitle="Leads created vs converted to clients">
                    {leads.data.bySource.length === 0 ? <EmptyState icon={TrendingUp} title="No sources in range" className="py-8" /> : (
                      <div className="overflow-hidden rounded-lg border border-line">
                        <table className="w-full">
                          <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Source</th><th className="table-th text-right">Leads</th><th className="table-th text-right">Converted</th><th className="table-th text-right">Rate</th></tr></thead>
                          <tbody className="divide-y divide-line">
                            {leads.data.bySource.map((r) => (
                              <tr key={r.source}><td className="table-td py-2 text-xs">{String(r.source).replace(/_/g, ' ').toLowerCase()}</td>
                                <td className="table-td py-2 text-right text-xs">{r.count}</td><td className="table-td py-2 text-right text-xs">{r.converted}</td>
                                <td className="table-td py-2 text-right text-xs font-semibold">{r.rate}%</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ChartCard>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-ink">Performance by consultant</h3>
                    <Button size="xs" variant="secondary" icon={Download} onClick={() => exportCsv('lead-performance', [{ key: 'name', label: 'Consultant' }, { key: 'count', label: 'Leads' }, { key: 'converted', label: 'Converted' }, { key: 'rate', label: 'Rate %' }], leads.data.byAssignee)}>Export CSV</Button>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-line">
                    <table className="w-full">
                      <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Consultant</th><th className="table-th text-right">Leads</th><th className="table-th text-right">Converted</th><th className="table-th text-right">Conversion</th></tr></thead>
                      <tbody className="divide-y divide-line">
                        {leads.data.byAssignee.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-ink-faint">No leads in this range.</td></tr>
                          : leads.data.byAssignee.map((r) => (
                          <tr key={r.name}><td className="table-td py-2 text-xs">{r.name}</td><td className="table-td py-2 text-right text-xs">{r.count}</td>
                            <td className="table-td py-2 text-right text-xs">{r.converted}</td><td className="table-td py-2 text-right text-xs font-semibold">{r.rate}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : tab === 'cases' && cases.data ? (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  <ChartCard title="Cases by destination">
                    {cases.data.byCountry.length === 0 ? <EmptyState icon={Briefcase} title="No cases in range" className="py-8" /> : (
                      <div className="h-[200px]"><ResponsiveContainer>
                        <PieChart><Pie data={cases.data.byCountry} dataKey="count" nameKey="country" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                          {cases.data.byCountry.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie><RTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} /></PieChart>
                      </ResponsiveContainer></div>
                    )}
                  </ChartCard>
                  <div className="lg:col-span-2">
                    <ChartCard title="Cases by visa category">
                      <div className="space-y-1.5">
                        {cases.data.byVisa.filter((v) => v.count > 0).length === 0 ? <EmptyState icon={Briefcase} title="No cases in range" className="py-8" />
                          : cases.data.byVisa.filter((v) => v.count > 0).map((v) => {
                            const max = Math.max(...cases.data.byVisa.map((x) => x.count));
                            return (<div key={v.key} className="flex items-center gap-2"><span className="w-36 truncate text-2xs text-ink-soft">{v.label}</span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(v.count / max) * 100}%` }} /></div>
                              <span className="w-6 text-right text-2xs font-semibold text-ink">{v.count}</span></div>);
                          })}
                      </div>
                    </ChartCard>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-ink">Case status breakdown</h3>
                    <Button size="xs" variant="secondary" icon={Download} onClick={() => exportCsv('case-status', [{ key: 'label', label: 'Status' }, { key: 'count', label: 'Count' }], cases.data.byStatus)}>Export CSV</Button></div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {cases.data.byStatus.filter((s) => s.count > 0).map((s) => (
                      <div key={s.key} className="rounded-lg border border-line p-2.5"><p className="text-2xs text-ink-soft">{s.label}</p><p className="font-ui text-base font-bold text-ink">{s.count}</p></div>
                    ))}
                  </div>
                </div>
                {cases.data.completion.length > 0 && (
                  <div><h3 className="mb-2 text-xs font-bold text-ink">Completion metrics</h3>
                    <div className="overflow-hidden rounded-lg border border-line"><table className="w-full">
                      <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Outcome</th><th className="table-th text-right">Cases</th><th className="table-th text-right">Avg days to close</th></tr></thead>
                      <tbody className="divide-y divide-line">{cases.data.completion.map((r) => <tr key={r.status}><td className="table-td py-2 text-xs">{r.status.replace(/_/g, ' ').toLowerCase()}</td>
                        <td className="table-td py-2 text-right text-xs">{r.count}</td><td className="table-td py-2 text-right text-xs">{r.avgDays}</td></tr>)}</tbody>
                    </table></div></div>
                )}
              </div>
            ) : tab === 'consultants' && consultants.data ? (
              <>
                <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-ink">Consultant activity</h3>
                  <Button size="xs" variant="secondary" icon={Download} onClick={() => exportCsv('consultant-performance', [
                    { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'cases', label: 'Cases' }, { key: 'approved', label: 'Approved' },
                    { key: 'leads', label: 'Leads' }, { key: 'convertedLeads', label: 'Converted Leads' }, { key: 'tasksCompleted', label: 'Tasks Done' }, { key: 'appointments', label: 'Appointments' },
                  ], consultants.data.rows)}>Export CSV</Button></div>
                <div className="overflow-x-auto overflow-hidden rounded-lg border border-line"><table className="w-full">
                  <thead><tr className="border-b border-line bg-slate-50">
                    <th className="table-th">Team member</th><th className="table-th">Role</th><th className="table-th text-right">Cases</th><th className="table-th text-right">Approved</th>
                    <th className="table-th text-right">Leads</th><th className="table-th text-right">Converted</th><th className="table-th text-right">Tasks</th><th className="table-th text-right">Appts</th>
                  </tr></thead>
                  <tbody className="divide-y divide-line">
                    {consultants.data.rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-ink-faint">No team activity in this range.</td></tr>
                      : consultants.data.rows.map((r) => (
                      <tr key={r.memberId}><td className="table-td py-2 text-xs font-medium">{r.name}<p className="text-2xs text-ink-faint">{r.email}</p></td>
                        <td className="table-td py-2 text-2xs text-ink-soft">{r.role.replace(/_/g, ' ').toLowerCase()}</td>
                        <td className="table-td py-2 text-right text-xs">{r.cases}</td><td className="table-td py-2 text-right text-xs">{r.approved}</td>
                        <td className="table-td py-2 text-right text-xs">{r.leads}</td><td className="table-td py-2 text-right text-xs">{r.convertedLeads}</td>
                        <td className="table-td py-2 text-right text-xs">{r.tasksCompleted}</td><td className="table-td py-2 text-right text-xs">{r.appointments}</td></tr>
                    ))}
                  </tbody>
                </table></div>
              </>
            ) : tab === 'revenue' && revenue.data ? (
              <div className="space-y-5">
                <ChartCard title="Collections" subtitle="Successful payments received per month">
                  {revenue.data.monthly.every((m) => m.collected === 0) ? <EmptyState icon={Wallet} title="No payments in range" className="py-8" /> : (
                    <div className="h-[230px]"><ResponsiveContainer>
                      <BarChart data={revenue.data.monthly} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#98A2B3' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: '#98A2B3' }} axisLine={false} tickLine={false} tickFormatter={(v) => num(v, true)} />
                        <RTooltip formatter={(v) => money(v, currency)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar dataKey="collected" fill="#2563EB" radius={[3, 3, 0, 0]} name="Collected" />
                      </BarChart>
                    </ResponsiveContainer></div>
                  )}
                </ChartCard>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div><h3 className="mb-2 text-xs font-bold text-ink">Collected by method</h3>
                    <div className="overflow-hidden rounded-lg border border-line"><table className="w-full">
                      <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Method</th><th className="table-th text-right">Payments</th><th className="table-th text-right">Amount</th></tr></thead>
                      <tbody className="divide-y divide-line">{revenue.data.byMethod.length === 0 ? <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-ink-faint">None</td></tr>
                        : revenue.data.byMethod.map((r) => <tr key={r._id}><td className="table-td py-2 text-xs">{String(r._id).replace(/_/g, ' ').toLowerCase()}</td><td className="table-td py-2 text-right text-xs">{r.count}</td>
                          <td className="table-td py-2 text-right text-xs font-semibold">{money(r.total, currency)}</td></tr>)}</tbody>
                    </table></div></div>
                  <div><h3 className="mb-2 text-xs font-bold text-ink">Outstanding invoices</h3>
                    <div className="overflow-hidden rounded-lg border border-line"><table className="w-full">
                      <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Status</th><th className="table-th text-right">Invoices</th><th className="table-th text-right">Balance</th></tr></thead>
                      <tbody className="divide-y divide-line">{revenue.data.outstanding.length === 0 ? <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-ink-faint">Nothing outstanding — nice.</td></tr>
                        : revenue.data.outstanding.map((r) => <tr key={r._id}><td className="table-td py-2 text-xs">{String(r._id).replace(/_/g, ' ').toLowerCase()}</td><td className="table-td py-2 text-right text-xs">{r.count}</td>
                          <td className="table-td py-2 text-right text-xs font-semibold text-amber-700">{money(r.total, currency)}</td></tr>)}</tbody>
                    </table></div></div>
                </div>
              </div>
            ) : tab === 'documents' && docs.data ? (
              <>
                <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-ink">Cases awaiting documents</h3>
                  <Button size="xs" variant="secondary" icon={Download} onClick={() => exportCsv('pending-documents', [
                    { key: 'reference', label: 'Case' }, { key: 'client', label: 'Client' }, { key: 'missing', label: 'Missing' }, { key: 'total', label: 'Checklist' }, { key: 'status', label: 'Status' },
                  ], docs.data.data)}>Export CSV</Button></div>
                {docs.data.data.length === 0 ? <EmptyState icon={FileWarning} title="No pending documents" description="Every required document is verified or waived." />
                  : <div className="overflow-hidden rounded-lg border border-line"><table className="w-full">
                    <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Case</th><th className="table-th">Client</th><th className="table-th">Missing</th><th className="table-th">Status</th></tr></thead>
                    <tbody className="divide-y divide-line">{docs.data.data.map((r) => (
                      <tr key={r.caseId}><td className="table-td py-2"><p className="text-xs font-semibold text-ink">{r.reference}</p><p className="text-2xs text-ink-faint">{r.title}</p></td>
                        <td className="table-td py-2 text-xs">{r.client}</td>
                        <td className="table-td py-2"><Badge tone={r.missing > 3 ? 'danger' : 'warning'} size="sm">{r.missing} of {r.total}</Badge></td>
                        <td className="table-td py-2 text-2xs text-ink-soft">{labelFor(CASE_STATUSES, r.status)}</td></tr>))}</tbody>
                  </table></div>}
              </>
            ) : tab === 'appointments' && appts.data ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Appointments by status">
                  <div className="space-y-1.5">{appts.data.byStatus.length === 0 ? <EmptyState icon={CalendarDays} title="No appointments in range" className="py-8" />
                    : appts.data.byStatus.map((r) => <div key={r._id} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5"><span className="text-2xs text-ink-soft">{r._id.replace(/_/g, ' ').toLowerCase()}</span><span className="font-ui text-xs font-semibold text-ink">{r.count}</span></div>)}</div>
                </ChartCard>
                <ChartCard title="Appointments by type">
                  <div className="space-y-1.5">{appts.data.byType.length === 0 ? <EmptyState icon={CalendarDays} title="No appointments in range" className="py-8" />
                    : appts.data.byType.map((r) => <div key={r._id} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5"><span className="text-2xs text-ink-soft">{r._id.replace(/_/g, ' ').toLowerCase()}</span><span className="font-ui text-xs font-semibold text-ink">{r.count}</span></div>)}</div>
                </ChartCard>
              </div>
            ) : null}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-lg border border-line p-3.5">
      <h3 className="text-xs font-bold text-ink">{title}</h3>
      {subtitle && <p className="mb-1 text-2xs text-ink-faint">{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
