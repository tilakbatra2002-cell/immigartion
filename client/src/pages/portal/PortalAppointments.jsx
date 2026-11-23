import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Video, MapPin, Clock, UserRound } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, EmptyState, ErrorState, PageSkeleton, Tabs } from '../../components/ui';
import { dateTime, date } from '../../lib/format';
import { APPOINTMENT_TYPES, labelFor } from '../../lib/constants';

const STATUS_TONE = { SCHEDULED: 'info', CONFIRMED: 'success', COMPLETED: 'muted', CANCELLED: 'danger', NO_SHOW: 'danger', RESCHEDULED: 'warning' };

export default function PortalAppointments() {
  const [tab, setTab] = useState('upcoming');
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['portal', 'appointments'], queryFn: () => api.get('/portal/appointments') });
  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const now = new Date();
  const all = data?.data || [];
  const rows = all.filter((a) => (tab === 'upcoming' ? new Date(a.startAt) >= now && !['CANCELLED', 'NO_SHOW'].includes(a.status) : tab === 'past' ? new Date(a.startAt) < now || ['CANCELLED', 'NO_SHOW'].includes(a.status) : true));

  return (
    <div className="page-enter">
      <div className="mb-3"><h1 className="text-lg font-extrabold tracking-tight text-ink">Appointments</h1><p className="mt-0.5 text-xs text-ink-soft">Consultations and meetings with your consultant.</p></div>
      <div className="card overflow-hidden">
        <Tabs tabs={[{ key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past' }, { key: 'all', label: 'All', count: all.length }]} value={tab} onChange={setTab} className="px-3 pt-1" />
        {rows.length === 0 ? <EmptyState icon={CalendarDays} title={tab === 'upcoming' ? 'No upcoming appointments' : 'Nothing here yet'} description="Your consultant will schedule appointments as your case progresses." /> : (
          <div className="divide-y divide-line">
            {rows.map((a) => (
              <div key={a._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-800">
                  <span className="text-[9px] font-bold uppercase">{new Date(a.startAt).toLocaleString('en', { month: 'short' })}</span>
                  <span className="font-ui text-sm font-extrabold leading-none">{new Date(a.startAt).getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5"><p className="text-xs font-bold text-ink">{a.title}</p><Badge tone={STATUS_TONE[a.status]} size="sm">{a.status.toLowerCase().replace('_', ' ')}</Badge></div>
                  <p className="mt-0.5 text-2xs text-ink-soft">{labelFor(APPOINTMENT_TYPES, a.type)} · {dateTime(a.startAt, a.timezone)}{a.endAt ? ` – ${new Date(a.endAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-2xs text-ink-faint">
                    {a.consultantId?.name && <span className="flex items-center gap-1"><UserRound size={10} />{a.consultantId.name}</span>}
                    {a.location && <span className="flex items-center gap-1"><MapPin size={10} />{a.location}</span>}
                  </div>
                </div>
                {a.meetingLink && !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(a.status) && (
                  <a href={a.meetingLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start rounded-lg bg-brand-600 px-2.5 py-1.5 text-2xs font-semibold text-white hover:bg-brand-700"><Video size={12} />Join meeting</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-[10px] text-ink-faint">Need to reschedule? Message your consultant from the Messages tab — changes are confirmed by staff.</p>
    </div>
  );
}
