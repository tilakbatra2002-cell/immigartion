import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, CalendarDays, ReceiptIndianRupee, FileWarning, ArrowRight, MessagesSquare, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, EmptyState, ErrorState, PageSkeleton, Button } from '../../components/ui';
import { money, date, dateTime, timeAgo, relativeDays } from '../../lib/format';
import { CASE_STATUSES, labelFor } from '../../lib/constants';

export default function PortalDashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['portal', 'dashboard'], queryFn: () => api.get('/portal/dashboard') });
  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { cases = [], nextAppointment, outstanding, documentsRequired, unreadMessages } = data;

  return (
    <div className="page-enter space-y-4">
      <div>
        <h1 className="text-lg font-extrabold tracking-tight text-ink">Your immigration overview</h1>
        <p className="mt-0.5 text-xs text-ink-soft">Everything about your application in one place.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Briefcase} label="Active cases" value={cases.filter((c) => !['APPROVED', 'REFUSED', 'CLOSED'].includes(c.status)).length} to="/portal/cases" />
        <Metric icon={FileWarning} label="Documents needed" value={documentsRequired} to="/portal/documents" tone={documentsRequired > 0 ? 'warning' : undefined} />
        <Metric icon={ReceiptIndianRupee} label="Outstanding balance" value={money(outstanding.total || 0, outstanding.currency || 'INR')} sub={outstanding.count ? `${outstanding.count} invoice${outstanding.count > 1 ? 's' : ''}` : 'Nothing due'} to="/portal/invoices" />
        <Metric icon={MessagesSquare} label="Unread messages" value={unreadMessages} to="/portal/messages" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-bold text-ink">Your cases</h2><Link to="/portal/cases" className="text-2xs font-semibold text-brand-700">View all</Link></div>
          {cases.length === 0 ? <EmptyState icon={Briefcase} title="No cases yet" description="Your consultant will create a case once your consultation is complete." /> : (
            <div className="divide-y divide-line">
              {cases.slice(0, 4).map((c) => (
                <Link key={c._id} to={`/portal/cases/${c._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-xs font-semibold text-ink">{c.title || c.reference}</p></div>
                    <p className="mt-0.5 text-2xs text-ink-faint">{c.reference} · {labelFor(CASE_STATUSES, c.status)} · updated {timeAgo(c.updatedAt)}</p>
                  </div>
                  {c.targetDeadline && <span className={`hidden shrink-0 text-2xs sm:block ${relativeDays(c.targetDeadline) < 0 ? 'text-red-600' : 'text-ink-soft'}`}>{date(c.targetDeadline)}</span>}
                  <ArrowRight size={13} className="text-ink-faint" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink"><CalendarDays size={14} />Next appointment</h2>
            {nextAppointment ? (
              <div className="mt-2 rounded-lg border border-line p-2.5">
                <p className="text-xs font-semibold text-ink">{nextAppointment.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-2xs text-ink-soft"><Clock size={10} />{dateTime(nextAppointment.startAt, nextAppointment.timezone)}</p>
                {nextAppointment.consultantId?.name && <p className="mt-1 text-2xs text-ink-faint">with {nextAppointment.consultantId.name}</p>}
                {nextAppointment.meetingLink && <a href={nextAppointment.meetingLink} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-2xs font-semibold text-brand-700">Join meeting →</a>}
              </div>
            ) : <p className="mt-2 text-2xs text-ink-soft">No upcoming appointments scheduled.</p>}
            <Link to="/portal/appointments" className="mt-2 inline-block text-2xs font-semibold text-brand-700">All appointments →</Link>
          </div>

          <div className="rounded-card border border-brand-200 bg-brand-25 p-4">
            <h2 className="text-sm font-bold text-brand-900">Need help?</h2>
            <p className="mt-1 text-2xs leading-relaxed text-brand-800">Send a message to your consultant directly — responses typically arrive within one business day.</p>
            <Button size="sm" className="mt-2.5" onClick={() => (window.location.href = '/portal/messages')}>Open messages</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, to, tone }) {
  return (
    <Link to={to} className="card flex items-start gap-2.5 p-3.5 transition hover:border-brand-300">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-700'}`}><Icon size={15} /></span>
      <div className="min-w-0"><p className="text-2xs font-medium text-ink-soft">{label}</p><p className="font-ui text-base font-bold leading-tight text-ink">{value}</p>{sub && <p className="text-[10px] text-ink-faint">{sub}</p>}</div>
    </Link>
  );
}
