import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, CheckSquare, CheckCircle2, Circle, Clock, Trash2, Repeat, Flag } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import FilterBar, { FilterSelect } from '../../components/domain/FilterBar';
import DataTable from '../../components/domain/DataTable';
import { TaskStatus, Priority } from '../../components/domain/StatusBadge';
import ConfirmDialog from '../../components/domain/ConfirmDialog';
import { Button, SearchInput, Pagination, EmptyState, ErrorState, TableSkeleton, Modal, Input, Textarea, Select, Tabs, Badge } from '../../components/ui';
import { TASK_STATUSES, TASK_RECURRENCE, PRIORITIES, labelFor } from '../../lib/constants';
import { date, relativeDays, toInputDateTime, timeAgo } from '../../lib/format';

export default function Tasks() {
  const { can, user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('overdue') === 'true' ? 'overdue' : 'open');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ assignedToId: '', priority: '' });
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', assignedToId: '', priority: 'MEDIUM', dueAt: '', relatedType: 'NONE', relatedId: '', recurrence: 'NONE', recurrenceUntil: '', reminderAt: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, filters, tab]);

  const queryParams = {
    page, limit: 25, q: debounced, ...filters,
    ...(tab === 'overdue' ? { overdue: 'true' } : {}),
    ...(tab === 'open' ? { status: 'OPEN_ALL' } : {}),
    ...(tab === 'completed' ? { status: 'COMPLETED' } : {}),
  };
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['tasks', queryParams], queryFn: () => api.get(`/tasks${qs(queryParams)}`) });
  const team = useQuery({ queryKey: ['team', 'lite'], queryFn: () => api.get('/organization/team?limit=100'), select: (d) => d.data });
  const clients = useQuery({ queryKey: ['clients', 'picker'], queryFn: () => api.get('/clients?limit=100&status=ACTIVE') });
  const cases = useQuery({ queryKey: ['cases', 'picker'], queryFn: () => api.get('/cases?limit=100') });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['badges'] }); };

  const save = useMutation({
    mutationFn: (payload) => editing ? api.patch(`/tasks/${editing._id}`, payload) : api.post('/tasks', payload),
    onSuccess: () => { toast.success(editing ? 'Task updated' : 'Task created'); invalidate(); setFormOpen(false); setEditing(null); },
    onError: (e) => toast.error('Could not save task', e.message),
  });
  const toggle = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/tasks/${id}/status`, { status }),
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error('Update failed', e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => api.del(`/tasks/${id}`),
    onSuccess: () => { toast.success('Task deleted'); setDeleteTarget(null); invalidate(); },
    onError: (e) => { toast.error('Delete failed', e.message); setDeleteTarget(null); },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', description: '', assignedToId: user?.id || '', priority: 'MEDIUM', dueAt: '', relatedType: 'NONE', relatedId: params.get('caseId') ? 'CASE' : 'NONE', recurrence: 'NONE', recurrenceUntil: '', reminderAt: '' });
    setErrors({}); setFormOpen(true);
  };
  const openEdit = (t) => {
    setEditing(t);
    setForm({ title: t.title, description: t.description || '', assignedToId: t.assignedToId?._id || t.assignedToId || '', priority: t.priority, dueAt: toInputDateTime(t.dueAt), relatedType: t.relatedType, relatedId: t.relatedId || '', recurrence: t.recurrence, recurrenceUntil: toInputDateTime(t.recurrenceUntil), reminderAt: toInputDateTime(t.reminderAt) });
    setErrors({}); setFormOpen(true);
  };

  const submit = () => {
    const err = {};
    if (form.title.trim().length < 2) err.title = 'Title is required.';
    if (form.relatedType !== 'NONE' && !form.relatedId) err.relatedId = 'Select the linked record.';
    setErrors(err);
    if (Object.keys(err).length) return;
    save.mutate({
      title: form.title.trim(), description: form.description, assignedToId: form.assignedToId || null,
      priority: form.priority, dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      relatedType: form.relatedType, relatedId: form.relatedType === 'NONE' ? null : form.relatedId,
      recurrence: form.recurrence, recurrenceUntil: form.recurrenceUntil ? new Date(form.recurrenceUntil).toISOString() : null,
      reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : null,
    });
  };

  const rows = data?.data || [];
  const counts = Object.fromEntries((data?.counts || []).map((c) => [c._id, c.count]));

  return (
    <div className="page-enter">
      <PageHeader title="Tasks" description="Follow-ups, reminders and internal work — linked to leads, clients or cases."
        actions={can('tasks.create') && <Button size="sm" icon={Plus} onClick={openNew}>New task</Button>} />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <Tabs tabs={[{ key: 'open', label: 'Open', count: (counts.OPEN || 0) + (counts.IN_PROGRESS || 0) }, { key: 'overdue', label: 'Overdue' }, { key: 'completed', label: 'Completed', count: counts.COMPLETED || 0 }, { key: 'all', label: 'All' }]}
            value={tab} onChange={setTab} className="flex-1 border-0" />
        </div>
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" className="flex-1" />
          <FilterBar>
            <FilterSelect value={filters.assignedToId} onChange={(v) => setFilters({ ...filters, assignedToId: v })} placeholder="All assignees" options={[{ key: user?.id, label: 'Assigned to me' }, ...(team.data || []).map((m) => ({ key: m.user.id, label: m.user.name })), { key: 'unassigned', label: 'Unassigned' }]} />
            <FilterSelect value={filters.priority} onChange={(v) => setFilters({ ...filters, priority: v })} placeholder="All priorities" options={PRIORITIES.map((p) => ({ key: p, label: p.charAt(0) + p.slice(1).toLowerCase() }))} />
          </FilterBar>
        </div>

        {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : isLoading ? <TableSkeleton rows={6} cols={5} /> : rows.length === 0 ? (
          <EmptyState icon={CheckSquare} title={tab === 'overdue' ? 'No overdue tasks' : tab === 'completed' ? 'No completed tasks' : 'No tasks yet'}
            description={tab === 'overdue' ? 'You are on top of your follow-ups.' : 'Create a task to track a follow-up or internal action.'}
            action={can('tasks.create') && tab !== 'completed' ? <Button size="sm" icon={Plus} onClick={openNew}>New task</Button> : null} />
        ) : (
          <>
            <div className="divide-y divide-line">
              {rows.map((t) => {
                const overdue = t.dueAt && new Date(t.dueAt) < new Date() && ['OPEN', 'IN_PROGRESS'].includes(t.status);
                const days = t.dueAt ? relativeDays(t.dueAt) : null;
                return (
                  <div key={t._id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60">
                    <button onClick={() => toggle.mutate({ id: t._id, status: t.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED' })}
                      className="mt-0.5 shrink-0 text-ink-faint transition hover:text-emerald-600" aria-label={t.status === 'COMPLETED' ? 'Reopen task' : 'Complete task'}>
                      {t.status === 'COMPLETED' ? <CheckCircle2 size={17} className="text-emerald-600" /> : <Circle size={17} />}
                    </button>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => can('tasks.update') && openEdit(t)}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className={`text-xs font-semibold ${t.status === 'COMPLETED' ? 'text-ink-faint line-through' : 'text-ink'}`}>{t.title}</p>
                        <Priority value={t.priority} size="sm" />
                        {t.recurrence !== 'NONE' && <Badge tone="muted" size="sm"><Repeat size={9} className="mr-0.5 inline" />{t.recurrence.toLowerCase()}</Badge>}
                        {t.relatedType !== 'NONE' && <Badge tone="info" size="sm">{t.relatedType.toLowerCase()}</Badge>}
                      </div>
                      {t.description && <p className="mt-0.5 line-clamp-1 text-2xs text-ink-soft">{t.description}</p>}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-2xs text-ink-faint">
                        <span>{t.assignedToId?.name || 'Unassigned'}</span>
                        {t.dueAt && <span className={`flex items-center gap-1 ${overdue ? 'font-semibold text-red-600' : days !== null && days <= 2 ? 'text-amber-700' : ''}`}>
                          <Clock size={10} />{date(t.dueAt)}{overdue ? ' · overdue' : ''}
                        </span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <TaskStatus status={t.status} />
                      {can('tasks.delete') && <button onClick={() => setDeleteTarget(t)} className="rounded p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600" aria-label="Delete task"><Trash2 size={13} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination meta={data?.meta} onPage={setPage} />
          </>
        )}
      </div>

      <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title={editing ? 'Edit task' : 'New task'}
        footer={<><Button variant="secondary" size="sm" onClick={() => setFormOpen(false)}>Cancel</Button><Button size="sm" loading={save.isPending} onClick={submit}>{editing ? 'Save changes' : 'Create task'}</Button></>}>
        <div className="space-y-3.5">
          <Input label="Task title" required value={form.title} error={errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Follow up on IELTS scores" autoFocus />
          <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Select label="Assign to" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} placeholder="Me (default)">
              {(team.data || []).map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </Select>
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </Select>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input label="Due date" type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            <Input label="Reminder" type="datetime-local" value={form.reminderAt} onChange={(e) => setForm({ ...form, reminderAt: e.target.value })} hint="Optional" />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Select label="Link to" value={form.relatedType} onChange={(e) => setForm({ ...form, relatedType: e.target.value, relatedId: '' })}>
              <option value="NONE">Nothing</option><option value="CLIENT">Client</option><option value="CASE">Case</option>
            </Select>
            {form.relatedType !== 'NONE' && (
              <Select label={form.relatedType === 'CASE' ? 'Case' : 'Client'} value={form.relatedId} error={errors.relatedId} onChange={(e) => setForm({ ...form, relatedId: e.target.value })} placeholder="Select…">
                {(form.relatedType === 'CASE' ? cases.data?.data || [] : clients.data?.data || []).map((x) => (
                  <option key={x._id} value={x._id}>{x.reference} — {x.title || `${x.firstName} ${x.lastName}`}</option>
                ))}
              </Select>
            )}
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Select label="Recurrence" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
              {TASK_RECURRENCE.map((r) => <option key={r} value={r}>{r === 'NONE' ? 'Does not repeat' : r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
            </Select>
            {form.recurrence !== 'NONE' && <Input label="Repeat until" type="datetime-local" value={form.recurrenceUntil} onChange={(e) => setForm({ ...form, recurrenceUntil: e.target.value })} />}
          </div>
          {form.recurrence !== 'NONE' && <p className="rounded-lg bg-canvas p-2.5 text-2xs text-ink-soft">Completing this task automatically creates the next occurrence with the same details.</p>}
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => remove.mutate(deleteTarget._id)} busy={remove.isPending}
        title="Delete task?" description={<>“{deleteTarget?.title}” will be removed permanently.</>} confirmLabel="Delete task" />
    </div>
  );
}
