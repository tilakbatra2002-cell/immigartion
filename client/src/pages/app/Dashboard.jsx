import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, UserSquare2, Briefcase, FileWarning, Clock4, CheckCircle2, CheckSquare,
  CalendarDays, Wallet, AlertCircle, ArrowRight, Plus, Sparkles, TrendingUp, Inbox,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, BarChart, Bar, Cell } from 'recharts';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/domain/PageHeader';
import StatCard from '../../components/domain/StatCard';
import { Button, Skeleton, EmptyState, ErrorState, Badge, PageSkeleton, Avatar } from '../../components/ui';
import { money, num, date, timeAgo, relativeDays } from '../../lib/format';
import { CASE_STATUSES, labelFor } from '../../lib/constants';

const TONE_HEX = { slate: '#64748B', sky: '#0EA5E9', amber: '#F59E0B', blue: '#3B82F6', indigo: '#6366F1', violet: '#8B5CF6', cyan: '#06B6D4', orange: '#F97316', purple: '#A855F7', green: '#10B981', red: '#EF4444', stone: '#78716C', gray: '#6B7280' };

export default function Dashboard() {
  const { user, can } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/summary'),
    refetchInterval: 120000,
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const m = data.metrics;
  const currency = m.currency;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0];
  const hasData = m.totalLeads > 0 || m.activeCases > 0 || m.activeClients > 0;
  const pending = data.pendingActions;
  const totalPending = Object.values(pending).reduce((a, b) => a + b, 0);

  return (
    <div className="page-enter">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={hasData ? 'Live metrics from your organization — updated from your database.' : 'Your workspace is empty. Create your first lead to see metrics here.'}
        actions={<>
          {can('leads.create') && <Link to="/app/leads?new=1"><Button size="sm" variant="secondary" icon={Plus}>New lead</Button></Link>}
          {can('cases.create') && <Link to="/app/cases?new=1"><Button size="sm" icon={Plus}>New case</Button></Link>}
        </>}
      />

      {totalPending > 0 && (
        <div className="mb-5 flex flex-col gap-3 rounded-card border border-amber-200 bg-amber-50/60 p-3.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-amber-800"><AlertCircle size={16} /><p className="text-xs font-bold">Needs attention</p></div>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {pending.overdueTasks > 0 && <Link to="/app/tasks?overdue=true"><Badge tone="warning">{pending.overdueTasks} overdue task{pending.overdueTasks > 1 ? 's' : ''}</Badge></Link>}
            {pending.missingDocuments > 0 && <Link to="/app/documents?requested=true"><Badge tone="warning">{pending.missingDocuments} requested doc{pending.missingDocuments > 1 ? 's' : ''} pending</Badge></Link>}
            {pending.overdueInvoices > 0 && <Link to="/app/invoices?status=OVERDUE"><Badge tone="warning">{pending.overdueInvoices} overdue invoice{pending.overdueInvoices > 1 ? 's' : ''}</Badge></Link>}
            {pending.followUpsDue > 0 && <Link to="/app/leads"><Badge tone="warning">{pending.followUpsDue} lead follow-up{pending.followUpsDue > 1 ? 's' : ''} due</Badge></Link>}
            {pending.casesPastDeadline > 0 && <Link to="/app/cases"><Badge tone="warning">{pending.casesPastDeadline} case{pending.casesPastDeadline > 1 ? 's' : ''} past deadline</Badge></Link>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total leads" value={num(m.totalLeads)} icon={Users} hint={`${m.newLeadsThisMonth} new this month`} to="/app/leads" />
        <StatCard label="Active clients" value={num(m.activeClients)} icon={UserSquare2} to="/app/clients" />
        <StatCard label="Active cases" value={num(m.activeCases)} icon={Briefcase} hint={`${m.completedCases} completed`} to="/app/cases" tone="brand" />
        <StatCard label="Awaiting documents" value={num(m.awaitingDocs)} icon={FileWarning} tone={m.awaitingDocs > 0 ? 'warning' : 'default'} to="/app/cases?status=DOCUMENTS_PENDING" />
        <StatCard label="Due ≤ 14 days" value={num(m.nearingDeadline)} icon={Clock4} tone={m.nearingDeadline > 0 ? 'warning' : 'default'} hint="Case deadlines" to="/app/cases" />
        <StatCard label="Pending tasks" value={num(m.pendingTasks)} icon={CheckSquare} tone={m.overdueTasks > 0 ? 'danger' : 'default'} hint={m.overdueTasks ? `${m.overdueTasks} overdue` : 'All on track'} to="/app/tasks" alert={m.overdueTasks > 0} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-3.5">
          <div className="flex items-center justify-between"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Revenue this month</p><Wallet size={14} className="text-ink-faint" /></div>
          <p className="mt-1.5 font-ui text-[22px] font-bold tracking-tight text-emerald-700">{money(m.monthRevenue, currency, true)}</p>
          <p className="mt-0.5 text-2xs text-ink-faint">of {money(m.monthInvoiced, currency, true)} invoiced</p>
        </div>
        <div className="card p-3.5">
          <div className="flex items-center justify-between"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Outstanding</p><AlertCircle size={14} className={m.outstandingPayments > 0 ? 'text-amber-600' : 'text-ink-faint'} /></div>
          <p className={`mt-1.5 font-ui text-[22px] font-bold tracking-tight ${m.outstandingPayments > 0 ? 'text-amber-700' : 'text-ink'}`}>{money(m.outstandingPayments, currency, true)}</p>
          <p className="mt-0.5 text-2xs text-ink-faint">{m.outstandingInvoices} open invoice{m.outstandingInvoices === 1 ? '' : 's'}</p>
        </div>
        <div className="card p-3.5">
          <div className="flex items-center justify-between"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Lead conversion</p><TrendingUp size={14} className="text-ink-faint" /></div>
          <p className="mt-1.5 font-ui text-[22px] font-bold tracking-tight text-ink">{m.conversionRate}%</p>
          <p className="mt-0.5 text-2xs text-ink-faint">All-time converted leads</p>
        </div>
        <Link to="/app/appointments" className="card p-3.5 transition hover:border-slate-300 hover:shadow-pop">
          <div className="flex items-center justify-between"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Upcoming appointments</p><CalendarDays size={14} className="text-ink-faint" /></div>
          <p className="mt-1.5 font-ui text-[22px] font-bold tracking-tight text-ink">{num(m.upcomingAppointments)}</p>
          <p className="mt-0.5 text-2xs text-ink-faint">Scheduled · view calendar <ArrowRight size={10} className="inline" /></p>
        </Link>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="card p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className="text-sm font-bold text-ink">Lead conversion</h2><p className="text-2xs text-ink-faint">Leads created vs converted · last 6 months</p></div>
          </div>
          {data.conversion.every((c) => c.created === 0) ? (
            <EmptyState icon={Users} title="No lead data yet" description="Create your first lead and conversion trends will appear here." className="py-10" />
          ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.conversion} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="created" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.18} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#98A2B3' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#98A2B3' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(16,24,40,.08)' }} />
                  <Area type="monotone" dataKey="created" stroke="#2563EB" strokeWidth={2} fill="url(#created)" name="Created" />
                  <Area type="monotone" dataKey="converted" stroke="#10B981" strokeWidth={2} fill="transparent" name="Converted" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex gap-4 border-t border-line pt-2 text-2xs text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-600" />Leads created</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Converted to clients</span>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold text-ink">Case status</h2>
          <p className="text-2xs text-ink-faint">Active cases by workflow stage</p>
          {data.caseDistribution.length === 0 ? (
            <EmptyState icon={Briefcase} title="No active cases" description="Cases in progress will appear here by stage." className="py-10" />
          ) : (
            <div className="mt-2 space-y-2">
              {data.caseDistribution.slice(0, 7).map((s) => {
                const max = Math.max(...data.caseDistribution.map((x) => x.count));
                return (
                  <div key={s.key}>
                    <div className="mb-0.5 flex items-center justify-between text-2xs">
                      <span className="truncate text-ink-soft">{s.label}</span><span className="font-semibold text-ink">{s.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: TONE_HEX[s.color] || '#2563EB' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className="text-sm font-bold text-ink">Revenue</h2><p className="text-2xs text-ink-faint">Collected vs invoiced · last 6 months</p></div>
            <Badge tone="muted">{currency}</Badge>
          </div>
          {data.revenueSeries.every((r) => r.invoiced === 0) ? (
            <EmptyState icon={Wallet} title="No billing activity yet" description="Issue your first invoice to start tracking revenue." className="py-10" />
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueSeries} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#98A2B3' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#98A2B3' }} axisLine={false} tickLine={false} tickFormatter={(v) => num(v, true)} />
                  <RTooltip formatter={(v) => money(v, currency)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                  <Bar dataKey="invoiced" fill="#DBE6FE" radius={[3, 3, 0, 0]} name="Invoiced" />
                  <Bar dataKey="collected" fill="#2563EB" radius={[3, 3, 0, 0]} name="Collected" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card flex flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Upcoming appointments</h2>
            <Link to="/app/appointments" className="text-2xs font-semibold text-brand-700 hover:text-brand-800">View all</Link>
          </div>
          {data.upcomingAppointments.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Book a consultation to see it here." className="flex-1 py-8" />
          ) : (
            <div className="divide-y divide-line">
              {data.upcomingAppointments.map((a) => (
                <div key={a._id} className="flex items-center gap-3 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <span className="text-[9px] font-bold uppercase leading-none">{new Date(a.startAt).toLocaleString('en', { month: 'short' })}</span>
                    <span className="font-ui text-xs font-bold leading-tight">{new Date(a.startAt).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{a.title || a.type.replace(/_/g, ' ')}</p>
                    <p className="truncate text-2xs text-ink-soft">{a.clientId ? `${a.clientId.firstName} ${a.clientId.lastName || ''}` : '—'} · {new Date(a.startAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Recent activity</h2>
            <Link to="/app/settings/audit" className="text-2xs font-semibold text-brand-700 hover:text-brand-800">Audit log</Link>
          </div>
          {data.recentActivity.length === 0 ? (
            <EmptyState icon={Clock4} title="No activity yet" description="Case updates, status changes and notes will appear here." className="py-8" />
          ) : (
            <div className="space-y-0">
              {data.recentActivity.map((a) => (
                <div key={a._id} className="flex gap-2.5 border-b border-line py-2 last:border-0">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink">{a.title}</p>
                    {a.description && <p className="line-clamp-1 text-2xs text-ink-soft">{a.description}</p>}
                    <p className="text-2xs text-ink-faint">{a.actorName || 'System'} · {timeAgo(a.createdAt)}{a.case?.reference ? ` · ${a.case.reference}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-2 text-sm font-bold text-ink">Pending actions</h2>
          {totalPending === 0 ? (
            <EmptyState icon={CheckCircle2} title="You're all caught up" description="No overdue tasks, missing documents or unpaid invoices." className="py-8" />
          ) : (
            <div className="space-y-1.5">
              {[
                { label: 'Overdue tasks', count: pending.overdueTasks, to: '/app/tasks?overdue=true', icon: CheckSquare },
                { label: 'Documents requested but not received', count: pending.missingDocuments, to: '/app/documents?requested=true', icon: FileWarning },
                { label: 'Overdue invoices', count: pending.overdueInvoices, to: '/app/invoices?status=OVERDUE', icon: Wallet },
                { label: 'Lead follow-ups due', count: pending.followUpsDue, to: '/app/leads', icon: Users },
                { label: 'Cases past target deadline', count: pending.casesPastDeadline, to: '/app/cases', icon: Briefcase },
              ].filter((x) => x.count > 0).map((x) => (
                <Link key={x.label} to={x.to} className="flex items-center gap-3 rounded-lg border border-line p-2.5 transition hover:bg-slate-50">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><x.icon size={14} /></span>
                  <span className="flex-1 text-xs font-medium text-ink">{x.label}</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-ui text-xs font-bold text-amber-800">{x.count}</span>
                  <ArrowRight size={12} className="text-ink-faint" />
                </Link>
              ))}
            </div>
          )}
          {can('ai.use') && (
            <Link to="/app/ai" className="mt-3 flex items-center gap-2.5 rounded-lg border border-brand-200 bg-brand-25 p-2.5 transition hover:bg-brand-50">
              <Sparkles size={14} className="text-brand-700" />
              <span className="flex-1 text-xs font-semibold text-brand-800">Ask the AI assistant about pending work</span>
              <ArrowRight size={12} className="text-brand-700" />
            </Link>
          )}
        </div>
      </div>

      {!hasData && (
        <div className="card mt-4 overflow-hidden">
          <div className="grid gap-0 sm:grid-cols-3">
            {[['Add your first lead', 'Capture an enquiry with source, destination and follow-up date.', '/app/leads', Users],
              ['Convert to a client', 'Leads become clients with a permanent reference number.', '/app/clients', UserSquare2],
              ['Open an immigration case', 'Pick destination and visa category — a document checklist is added automatically.', '/app/cases', Briefcase]].map(([t, d, to, Icon]) => (
              <Link key={t} to={to} className="group border-line p-4 transition hover:bg-canvas sm:border-r sm:last:border-r-0">
                <Icon size={16} className="text-brand-700" />
                <p className="mt-2 text-xs font-bold text-ink">{t}</p>
                <p className="mt-1 text-2xs leading-relaxed text-ink-soft">{d}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-2xs font-semibold text-brand-700">Get started <ArrowRight size={10} /></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
