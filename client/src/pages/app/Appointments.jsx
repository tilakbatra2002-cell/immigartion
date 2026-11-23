import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, CalendarDays, ChevronLeft, ChevronRight, Video, MapPin, Clock, XCircle } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import DataTable from '../../components/domain/DataTable';
import FilterBar, { FilterSelect } from '../../components/domain/FilterBar';
import { AppointmentStatus } from '../../components/domain/StatusBadge';
import { Button, SearchInput, Pagination, EmptyState, ErrorState, TableSkeleton, Modal, Input, Textarea, Select, Tabs, Badge } from '../../components/ui';
import ConfirmDialog from '../../components/domain/ConfirmDialog';
import { APPOINTMENT_TYPES, APPOINTMENT_STATUSES, labelFor } from '../../lib/constants';
import { date, dateTime, toInputDateTime } from '../../lib/format';

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  return cells;
}

export default function Appointments() {
  const { can, organization } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', type: '', consultantId: '' });
  const [page, setPage] = useState(1);
  const [cursor, setCursor] = useState(new Date());
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [form, setForm] = useState({ title: '', type: 'INITIAL_CONSULTATION', clientId: '', leadId: '', caseId: '', consultantId: '', startAt: '', endAt: '', timezone: organization?.timezone || 'Asia/Kolkata', location: '', meetingLink: '', notes: '', reminderMinutes: 60 });
  const [errors, setErrors] = useState({});

  useEffect(() => { setForm((f) => ({ ...f, timezone: organization?.timezone || 'Asia/Kolkata' })); }, [organization]);
  useEffect(() => { setPage(1); }, [filters, search]);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

  const list = useQuery({
    queryKey: ['appointments', 'list', { page, filters }],
    queryFn: () => api.get(`/appointments${qs({ page, limit: 20, ...filters })}`),
    enabled: view === 'list',
  });
  const calendar = useQuery({
    queryKey: ['appointments', 'calendar', monthStart.toISOString()],
    queryFn: () => api.get(`/appointments${qs({ from: monthStart.toISOString(), to: monthEnd.toISOString(), limit: 100 })}`),
    enabled: view === 'calendar',
  });
  const team = useQuery({ queryKey: ['team', 'lite'], queryFn: () => api.get('/organization/team?limit=100'), select: (d) => d.data });
  const clients = useQuery({ queryKey: ['clients', 'picker'], queryFn: () => api.get('/clients?limit=100&status=ACTIVE') });
  const cases = useQuery({ queryKey: ['cases', 'picker'], queryFn: () => api.get('/cases?limit=100') });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['appointments'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const save = useMutation({
    mutationFn: (payload) => editing ? api.patch(`/appointments/${editing._id}`, payload) : api.post('/appointments', payload),
    onSuccess: () => { toast.success(editing ? 'Appointment updated' : 'Appointment scheduled'); invalidate(); setFormOpen(false); setEditing(null); },
    onError: (e) => toast.error('Could not save appointment', e.details ? Object.values(e.details)[0] : e.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status, cancelReason }) => api.patch(`/appointments/${id}/status`, { status, cancelReason }),
    onSuccess: () => { toast.success('Appointment updated'); invalidate(); setCancelTarget(null); },
    onError: (e) => toast.error('Update failed', e.message),
  });

  const openNew = () => {
    const start = new Date(); start.setMinutes(0, 0, 0); start.setDate(start.getDate() + 1);
    const end = new Date(start.getTime() + 60 * 60000);
    setEditing(null);
    setForm({ title: '', type: 'INITIAL_CONSULTATION', clientId: '', leadId: params.get('leadId') || '', caseId: params.get('caseId') || '', consultantId: '', startAt: toInputDateTime(start), endAt: toInputDateTime(end), timezone: organization?.timezone || 'Asia/Kolkata', location: '', meetingLink: '', notes: '', reminderMinutes: 60 });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({ title: a.title || '', type: a.type, clientId: a.clientId?._id || a.clientId || '', leadId: a.leadId?._id || a.leadId || '', caseId: a.caseId?._id || a.caseId || '', consultantId: a.consultantId?._id || a.consultantId || '', startAt: toInputDateTime(a.startAt), endAt: toInputDateTime(a.endAt), timezone: a.timezone, location: a.location || '', meetingLink: a.meetingLink || '', notes: a.notes || '', reminderMinutes: a.reminderMinutes ?? 60 });
    setErrors({});
    setFormOpen(true);
  };

  const submit = () => {
    const err = {};
    if (!form.consultantId) err.consultantId = 'Select a consultant.';
    if (!form.startAt) err.startAt = 'Start time is required.';
    if (!form.endAt) err.endAt = 'End time is required.';
    if (form.startAt && form.endAt && new Date(form.endAt) <= new Date(form.startAt)) err.endAt = 'End must be after start.';
    if (form.meetingLink && !/^https?:\/\/.+/.test(form.meetingLink)) err.meetingLink = 'Enter a valid URL.';
    setErrors(err);
    if (Object.keys(err).length) return;
    save.mutate({
      title: form.title || undefined, type: form.type, clientId: form.clientId || null, leadId: form.leadId || null,
      caseId: form.caseId || null, consultantId: form.consultantId,
      startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString(),
      timezone: form.timezone, location: form.location, meetingLink: form.meetingLink || '', notes: form.notes, reminderMinutes: Number(form.reminderMinutes),
    });
  };

  const tz = organization?.timezone || 'Asia/Kolkata';
  const columns = [
    { key: 'title', header: 'Appointment', render: (a) => <div><p className="text-xs font-semibold text-ink">{a.title || labelFor(APPOINTMENT_TYPES, a.type)}</p><p className="text-2xs text-ink-faint">{labelFor(APPOINTMENT_TYPES, a.type)}</p></div> },
    { key: 'attendee', header: 'Client', render: (a) => a.clientId ? <span className="text-xs text-ink">{a.clientId.firstName} {a.clientId.lastName}</span> : a.leadId ? <span className="text-xs text-ink-soft">{a.leadId.fullName} <Badge size="sm" tone="muted">Lead</Badge></span> : <span className="text-xs text-ink-faint">—</span> },
    { key: 'startAt', header: 'When', render: (a) => <span className="whitespace-nowrap text-xs text-ink-soft">{dateTime(a.startAt, tz)}</span> },
    { key: 'consultantId', header: 'Consultant', render: (a) => <span className="text-xs text-ink-soft">{a.consultantId?.name || '—'}</span> },
    { key: 'status', header: 'Status', render: (a) => <AppointmentStatus status={a.status} /> },
    { key: 'meeting', header: 'Meeting', render: (a) => a.meetingLink ? <a href={a.meetingLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"><Video size={12} />Join</a> : a.location ? <span className="flex items-center gap-1 text-xs text-ink-soft"><MapPin size={12} />{a.location}</span> : <span className="text-2xs text-ink-faint">—</span> },
    {
      key: 'actions', header: '', align: 'right', render: (a) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {can('appointments.manage') && !['CANCELLED', 'COMPLETED'].includes(a.status) && <>
            <Button size="xs" variant="ghost" onClick={() => openEdit(a)}>Edit</Button>
            <Button size="xs" variant="ghost" onClick={() => changeStatus.mutate({ id: a._id, status: 'COMPLETED' })}>Complete</Button>
            <button onClick={() => setCancelTarget(a)} className="rounded p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600" title="Cancel"><XCircle size={13} /></button>
          </>}
        </div>
      ),
    },
  ];

  const cells = useMemo(() => monthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const byDay = useMemo(() => {
    const map = {};
    (calendar.data?.data || []).forEach((a) => {
      const key = new Date(a.startAt).toDateString();
      (map[key] = map[key] || []).push(a);
    });
    return map;
  }, [calendar.data]);

  return (
    <div className="page-enter">
      <PageHeader title="Appointments" description={`Consultations display in ${tz.replace('_', ' ')}. Reminders are sent to consultants.`}
        actions={<>
          <div className="flex rounded-lg border border-line bg-white p-0.5">
            <button onClick={() => setView('list')} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${view === 'list' ? 'bg-navy text-white' : 'text-ink-soft'}`}>List</button>
            <button onClick={() => setView('calendar')} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${view === 'calendar' ? 'bg-navy text-white' : 'text-ink-soft'}`}>Calendar</button>
          </div>
          {can('appointments.manage') && <Button size="sm" icon={Plus} onClick={openNew}>New appointment</Button>}
        </>} />

      {view === 'list' ? (
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center">
            <FilterBar>
              <FilterSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} placeholder="All statuses" options={APPOINTMENT_STATUSES.map((s) => ({ key: s, label: s.replace(/_/g, ' ').toLowerCase() }))} />
              <FilterSelect value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })} placeholder="All types" options={APPOINTMENT_TYPES} />
              <FilterSelect value={filters.consultantId} onChange={(v) => setFilters({ ...filters, consultantId: v })} placeholder="All consultants" options={(team.data || []).map((m) => ({ key: m.user.id, label: m.user.name }))} />
            </FilterBar>
          </div>
          {list.isError ? <ErrorState message={list.error?.message} onRetry={list.refetch} /> : (
            <>
              <DataTable columns={columns} rows={list.data?.data || []} loading={list.isLoading} skeleton={<TableSkeleton rows={5} cols={6} bare />}
                onRowClick={(a) => can('appointments.manage') && openEdit(a)}
                empty={<EmptyState icon={CalendarDays} title="No appointments" description="Schedule a consultation to get started."
                  action={can('appointments.manage') ? <Button size="sm" icon={Plus} onClick={openNew}>New appointment</Button> : null} />} />
              <Pagination meta={list.data?.meta} onPage={setPage} />
            </>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-bold text-ink">{cursor.toLocaleString('en', { month: 'long', year: 'numeric' })}</h2>
            <div className="flex gap-1">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-md border border-line p-1.5 text-ink-soft hover:bg-slate-50"><ChevronLeft size={14} /></button>
              <button onClick={() => setCursor(new Date())} className="rounded-md border border-line px-2 text-xs font-medium text-ink-soft hover:bg-slate-50">Today</button>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-md border border-line p-1.5 text-ink-soft hover:bg-slate-50"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-line bg-slate-50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="px-2 py-2 text-center text-2xs font-bold uppercase tracking-wide text-ink-faint">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="min-h-[92px] border-b border-r border-line bg-slate-50/40" />;
              const items = byDay[d.toDateString()] || [];
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={d.toISOString()} className="min-h-[92px] border-b border-r border-line p-1.5">
                  <p className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-2xs font-semibold ${isToday ? 'bg-brand-600 text-white' : 'text-ink-soft'}`}>{d.getDate()}</p>
                  <div className="space-y-0.5">
                    {items.slice(0, 2).map((a) => (
                      <button key={a._id} onClick={() => can('appointments.manage') && openEdit(a)} className="block w-full truncate rounded bg-brand-50 px-1 py-0.5 text-left text-[9px] font-medium text-brand-800 hover:bg-brand-100">
                        {new Date(a.startAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} {a.clientId?.firstName || a.title || 'Appt'}
                      </button>
                    ))}
                    {items.length > 2 && <p className="px-1 text-[9px] font-medium text-ink-faint">+{items.length - 2} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title={editing ? 'Edit appointment' : 'New appointment'} size="lg"
        footer={<><Button variant="secondary" size="sm" onClick={() => setFormOpen(false)}>Cancel</Button><Button size="sm" loading={save.isPending} onClick={submit}>{editing ? 'Save changes' : 'Schedule'}</Button></>}>
        <div className="space-y-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input label="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="PR eligibility consultation" />
            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {APPOINTMENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Select label="Client" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} placeholder="No client (internal)">
              {(clients.data?.data || []).map((c) => <option key={c._id} value={c._id}>{c.firstName} {c.lastName} · {c.reference}</option>)}
            </Select>
            <Select label="Related case" value={form.caseId} onChange={(e) => setForm({ ...form, caseId: e.target.value })} placeholder="No case">
              {(cases.data?.data || []).map((c) => <option key={c._id} value={c._id}>{c.reference} — {c.clientId?.firstName}</option>)}
            </Select>
          </div>
          <Select label="Consultant" required value={form.consultantId} error={errors.consultantId} onChange={(e) => setForm({ ...form, consultantId: e.target.value })} placeholder="Select team member">
            {(team.data || []).map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name} · {m.roleLabel}</option>)}
          </Select>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input label="Starts" type="datetime-local" required value={form.startAt} error={errors.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            <Input label="Ends" type="datetime-local" required value={form.endAt} error={errors.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input label="Meeting link" value={form.meetingLink} error={errors.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} placeholder="https://meet.google.com/…" />
            <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Office / address" />
          </div>
          <Select label="Reminder" value={form.reminderMinutes} onChange={(e) => setForm({ ...form, reminderMinutes: e.target.value })}>
            {[[15, '15 minutes before'], [30, '30 minutes before'], [60, '1 hour before'], [1440, '1 day before']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} onConfirm={() => changeStatus.mutate({ id: cancelTarget._id, status: 'CANCELLED', cancelReason: 'Cancelled by consultant' })}
        title="Cancel appointment?" description="The appointment will be marked cancelled and the consultant notified." confirmLabel="Cancel appointment" />
    </div>
  );
}
