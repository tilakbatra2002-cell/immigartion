import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, CalendarClock, UserCheck, MessageSquarePlus, Trash2, ArrowRight, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, EmptyState, ErrorState, PageSkeleton, Textarea, Select, Modal } from '../../components/ui';
import { LeadStatus, Priority } from '../../components/domain/StatusBadge';
import { LEAD_STATUSES, LEAD_SOURCES, VISA_CATEGORIES, labelFor, countryName } from '../../lib/constants';
import { date, timeAgo } from '../../lib/format';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);

  const { data: lead, isLoading, isError, error, refetch } = useQuery({ queryKey: ['lead', id], queryFn: () => api.get(`/leads/${id}`) });

  const changeStatus = useMutation({
    mutationFn: (status) => api.patch(`/leads/${id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['lead', id] }); qc.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (e) => toast.error('Update failed', e.message),
  });

  const addNote = useMutation({
    mutationFn: () => api.post(`/leads/${id}/notes`, { body: note }),
    onSuccess: () => { setNote(''); qc.invalidateQueries({ queryKey: ['lead', id] }); toast.success('Note added'); },
    onError: (e) => toast.error('Could not add note', e.message),
  });

  const convert = useMutation({
    mutationFn: () => api.post(`/leads/${id}/convert`, {}),
    onSuccess: (data) => { toast.success('Lead converted', `Client ${data.client.reference} created.`); navigate(`/app/clients/${data.client._id}`); },
    onError: (e) => toast.error('Conversion failed', e.message),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const l = lead;
  const canConvert = ['NEW', 'CONTACTED', 'CONSULTATION_BOOKED', 'QUALIFIED'].includes(l.status) && !l.convertedClientId;

  return (
    <div className="page-enter">
      <button onClick={() => navigate('/app/leads')} className="mb-3 flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"><ArrowLeft size={13} /> Back to leads</button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[19px] font-extrabold tracking-tight text-ink">{l.fullName}</h1>
            <LeadStatus status={l.status} />
            <Priority value={l.priority} />
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {l.email ? <a href={`mailto:${l.email}`} className="hover:text-ink">{l.email}</a> : 'No email'} {l.phone && <>· <a href={`tel:${l.phone}`} className="hover:text-ink">{l.phone}</a></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('leads.update') && (
            <Select value={l.status} onChange={(e) => changeStatus.mutate(e.target.value)} className="w-44">
              {LEAD_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          )}
          {canConvert && can('clients.create') && <Button size="sm" icon={UserCheck} onClick={() => setConvertOpen(true)}>Convert to client</Button>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <h2 className="text-sm font-bold text-ink">Enquiry details</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[['Destination', countryName(l.destinationCountry)], ['Visa category', labelFor(VISA_CATEGORIES, l.visaCategory)],
                ['Country of residence', l.countryOfResidence || l.destinationCountry || '—'],
                ['Lead source', String(l.leadSource || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase())],
                ['Assigned consultant', l.assignedToId?.name || 'Unassigned'], ['Follow-up', l.followUpAt ? date(l.followUpAt, { time: true }) : '—'],
                ['Created', date(l.createdAt, { time: true })], ['Last contacted', l.lastContactedAt ? timeAgo(l.lastContactedAt) : '—']].map(([k, v]) => (
                <div key={k}><dt className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{k}</dt><dd className="mt-0.5 text-xs text-ink">{v || '—'}</dd></div>
              ))}
            </dl>
            {l.notes && <div className="mt-4 rounded-lg bg-canvas p-3"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Notes</p><p className="mt-1 whitespace-pre-wrap text-xs text-ink">{l.notes}</p></div>}
            {l.convertedClient && (
              <Link to={`/app/clients/${l.convertedClient._id}`} className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                <UserCheck size={14} /> Converted to client {l.convertedClient.reference} <ArrowRight size={12} className="ml-auto" />
              </Link>
            )}
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold text-ink">Communication history</h2>
            <p className="text-2xs text-ink-faint">Notes recorded by your team. Emails and WhatsApp are in Communications.</p>
            <div className="mt-3">
              {can('leads.update') && (
                <div className="mb-3">
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a call, meeting or follow-up note…" />
                  <div className="mt-2 flex justify-end"><Button size="xs" loading={addNote.isPending} disabled={!note.trim()} onClick={() => addNote.mutate()}>Add note</Button></div>
                </div>
              )}
              {(!l.noteEntries || l.noteEntries.length === 0) ? (
                <EmptyState icon={MessageSquarePlus} title="No notes yet" description="Log calls and follow-ups so the whole team has context." className="py-8" />
              ) : (
                <div className="space-y-2">
                  {[...l.noteEntries].reverse().map((n) => (
                    <div key={n._id} className="rounded-lg border border-line p-2.5">
                      <p className="whitespace-pre-wrap text-xs text-ink">{n.body}</p>
                      <p className="mt-1 text-2xs text-ink-faint">{n.authorName} · {timeAgo(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-bold text-ink">Appointments</h2>
            {l.appointments?.length ? (
              <div className="mt-2 space-y-2">
                {l.appointments.map((a) => (
                  <div key={a._id} className="rounded-lg border border-line p-2.5">
                    <p className="text-xs font-semibold text-ink">{a.title || a.type.replace(/_/g, ' ')}</p>
                    <p className="text-2xs text-ink-soft">{date(a.startAt, { time: true })}</p>
                    <Badge size="sm" tone={a.status === 'SCHEDULED' ? 'info' : a.status === 'COMPLETED' ? 'success' : 'neutral'} className="mt-1">{a.status}</Badge>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={CalendarClock} title="No appointments" description="Book a consultation from the Appointments page." className="py-6" />}
          </div>
          <div className="card p-4">
            <h2 className="text-sm font-bold text-ink">Quick actions</h2>
            <div className="mt-2 space-y-1.5">
              {l.email && <a href={`mailto:${l.email}`}><Button variant="secondary" size="sm" icon={Mail} className="w-full justify-start">Send email</Button></a>}
              <Link to={`/app/communications?new=1&leadId=${l._id}`}><Button variant="secondary" size="sm" icon={MessageSquarePlus} className="w-full justify-start">Start conversation</Button></Link>
              <Link to={`/app/appointments?new=1&leadId=${l._id}`}><Button variant="secondary" size="sm" icon={CalendarClock} className="w-full justify-start">Book appointment</Button></Link>
            </div>
          </div>
        </div>
      </div>

      <Modal open={convertOpen} onClose={() => setConvertOpen(false)} title="Convert to client"
        description="A client record will be created with a permanent reference number. The lead will be marked as Converted."
        footer={<><Button variant="secondary" size="sm" onClick={() => setConvertOpen(false)}>Cancel</Button><Button size="sm" loading={convert.isPending} onClick={() => convert.mutate()}>Convert lead</Button></>}>
        <div className="rounded-lg bg-canvas p-3 text-xs text-ink-soft">
          <p><span className="font-semibold text-ink">{l.fullName}</span> will become a client in {l.destinationCountry ? countryName(l.destinationCountry) : 'your workspace'}.</p>
          <p className="mt-1">Contact details, notes and assignment carry over. You can add passport information after conversion.</p>
        </div>
      </Modal>
    </div>
  );
}
