import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Download, LayoutGrid, List, Users, Trash2, Phone, Mail, CalendarClock, ArrowRight, MoreHorizontal } from 'lucide-react';
import { api, qs, downloadFile } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import StatCard from '../../components/domain/StatCard';
import DataTable from '../../components/domain/DataTable';
import { LeadStatus, Priority } from '../../components/domain/StatusBadge';
import FilterBar, { FilterSelect } from '../../components/domain/FilterBar';
import ConfirmDialog from '../../components/domain/ConfirmDialog';
import { Button, SearchInput, Pagination, EmptyState, ErrorState, TableSkeleton, Modal, Input, Textarea, Select, Badge, Avatar, PageSkeleton, Tabs } from '../../components/ui';
import { LEAD_STATUSES, LEAD_SOURCES, VISA_CATEGORIES, COUNTRIES, PRIORITIES, labelFor, countryName } from '../../lib/constants';
import { date, timeAgo, relativeDays } from '../../lib/format';
import LeadForm from './LeadForm';

export default function Leads() {
  const { can, user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ status: params.get('status') || '', priority: '', source: '', assignedToId: '', destinationCountry: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, filters, view]);

  const listQuery = useQuery({
    queryKey: ['leads', 'list', { page, debounced, ...filters }],
    queryFn: () => api.get(`/leads${qs({ page, limit: 20, q: debounced, ...filters })}`),
    enabled: view === 'table',
  });
  const kanbanQuery = useQuery({
    queryKey: ['leads', 'kanban', { debounced, ...filters }],
    queryFn: () => api.get(`/leads/kanban${qs({ q: debounced, ...filters })}`),
    enabled: view === 'kanban',
  });
  const teamQuery = useQuery({ queryKey: ['team', 'lite'], queryFn: () => api.get('/organization/team?limit=100'), select: (d) => d.data });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['badges'] }); };

  const saveLead = useMutation({
    mutationFn: (payload) => editing ? api.patch(`/leads/${editing._id}`, payload) : api.post('/leads', payload),
    onSuccess: () => { toast.success(editing ? 'Lead updated' : 'Lead created'); invalidate(); setShowForm(false); setEditing(null); },
    onError: (e) => toast.error('Could not save lead', e.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/leads/${id}/status`, { status }),
    onSuccess: () => { toast.success('Pipeline updated'); invalidate(); },
    onError: (e) => toast.error('Update failed', e.message),
  });

  const removeLead = useMutation({
    mutationFn: (id) => api.del(`/leads/${id}`),
    onSuccess: () => { toast.success('Lead deleted'); setDeleteTarget(null); invalidate(); },
    onError: (e) => { toast.error('Delete failed', e.message); setDeleteTarget(null); },
  });

  const pipeline = listQuery.data?.pipeline || [];
  const totalCount = pipeline.reduce((s, r) => s + r.count, 0);

  const columns = [
    {
      key: 'fullName', header: 'Lead', render: (l) => (
        <Link to={`/app/leads/${l._id}`} onClick={(e) => e.stopPropagation()} className="group flex items-center gap-2.5">
          <Avatar name={l.fullName} size="sm" />
          <div className="min-w-0"><p className="truncate text-xs font-semibold text-ink group-hover:text-brand-700">{l.fullName}</p>
            <p className="truncate text-2xs text-ink-faint">{l.email || l.phone || '—'}</p></div>
        </Link>
      ),
    },
    { key: 'destination', header: 'Destination', render: (l) => l.destinationCountry ? <span className="text-xs">{countryName(l.destinationCountry)}</span> : <span className="text-xs text-ink-faint">—</span> },
    { key: 'visaCategory', header: 'Visa', render: (l) => <span className="text-xs text-ink-soft">{labelFor(VISA_CATEGORIES, l.visaCategory) || '—'}</span> },
    { key: 'status', header: 'Status', render: (l) => <LeadStatus status={l.status} /> },
    { key: 'priority', header: 'Priority', render: (l) => <Priority value={l.priority} /> },
    { key: 'assignedToId', header: 'Owner', render: (l) => l.assignedToId ? <span className="text-xs text-ink-soft">{l.assignedToId.name}</span> : <span className="text-2xs text-ink-faint">Unassigned</span> },
    {
      key: 'followUpAt', header: 'Follow-up', render: (l) => {
        if (!l.followUpAt) return <span className="text-2xs text-ink-faint">—</span>;
        const d = relativeDays(l.followUpAt);
        return <span className={`text-xs font-medium ${d < 0 ? 'text-red-600' : d <= 2 ? 'text-amber-700' : 'text-ink-soft'}`}>{date(l.followUpAt)}</span>;
      },
    },
    { key: 'actions', header: '', align: 'right', render: (l) => (
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Link to={`/app/leads/${l._id}`} className="rounded p-1.5 text-ink-faint hover:bg-slate-100 hover:text-ink" aria-label="Open lead" title="Open lead"><ArrowRight size={13} /></Link>
        {l.email && <a href={`mailto:${l.email}`} className="rounded p-1.5 text-ink-faint hover:bg-slate-100 hover:text-ink" aria-label="Email"><Mail size={13} /></a>}
        {l.phone && <a href={`tel:${l.phone}`} className="rounded p-1.5 text-ink-faint hover:bg-slate-100 hover:text-ink" aria-label="Call"><Phone size={13} /></a>}
        {can('leads.delete') && <button onClick={() => setDeleteTarget(l)} className="rounded p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 size={13} /></button>}
      </div>
    ) },
  ];

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (lead) => { setEditing(lead); setShowForm(true); };

  return (
    <div className="page-enter">
      <PageHeader title="Leads" description="Every enquiry from first contact to conversion, with source tracking and follow-ups."
        actions={<>
          {can('leads.export') || can('leads.view') ? <Button size="sm" variant="secondary" icon={Download} onClick={() => downloadFile('/leads/export/csv' + qs({ q: debounced, ...filters }), 'leads.csv').catch((e) => toast.error('Export failed', e.message))}>Export CSV</Button> : null}
          {can('leads.create') && <Button size="sm" icon={Plus} onClick={openNew}>Add lead</Button>}
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {['NEW', 'CONTACTED', 'CONSULTATION_BOOKED', 'QUALIFIED', 'CONVERTED', 'LOST'].map((s) => {
          const info = LEAD_STATUSES.find((x) => x.key === s);
          const count = pipeline.find((p) => p._id === s)?.count || 0;
          return (
            <button key={s} onClick={() => setFilters({ ...filters, status: filters.status === s ? '' : s })}
              className={`card p-3 text-left transition ${filters.status === s ? 'border-brand-500 ring-1 ring-brand-500' : 'hover:border-slate-300'}`}>
              <p className="truncate text-2xs font-semibold uppercase tracking-wide text-ink-faint">{info?.label}</p>
              <p className="mt-0.5 font-ui text-lg font-bold text-ink">{count}</p>
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, phone…" className="flex-1" />
          <FilterBar>
            <FilterSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} placeholder="All statuses" options={LEAD_STATUSES} />
            <FilterSelect value={filters.source} onChange={(v) => setFilters({ ...filters, source: v })} placeholder="All sources" options={LEAD_SOURCES.map((s) => ({ key: s, label: s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase()) }))} />
            <FilterSelect value={filters.destinationCountry} onChange={(v) => setFilters({ ...filters, destinationCountry: v })} placeholder="All destinations" options={COUNTRIES} />
            <div className="flex rounded-lg border border-line p-0.5">
              <button onClick={() => setView('table')} className={`rounded-md p-1.5 ${view === 'table' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-slate-50'}`} aria-label="Table view"><List size={14} /></button>
              <button onClick={() => setView('kanban')} className={`rounded-md p-1.5 ${view === 'kanban' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-slate-50'}`} aria-label="Kanban view"><LayoutGrid size={14} /></button>
            </div>
          </FilterBar>
        </div>

        {view === 'table' ? (
          listQuery.isError ? <ErrorState message={listQuery.error?.message} onRetry={listQuery.refetch} /> : (
            <>
              <DataTable columns={columns} rows={listQuery.data?.data || []} onRowClick={(l) => navigate(`/app/leads/${l._id}`)} loading={listQuery.isLoading}
                skeleton={<TableSkeleton rows={6} cols={7} bare />}
                empty={<EmptyState icon={Users} title="No leads yet" description={debounced || Object.values(filters).some(Boolean) ? 'No leads match these filters. Try clearing the search or filters.' : 'Add your first enquiry to start tracking the pipeline.'}
                  action={can('leads.create') ? <Button size="sm" icon={Plus} onClick={openNew}>Add lead</Button> : null} />} />
              <Pagination meta={listQuery.data?.meta} onPage={setPage} />
            </>
          )
        ) : (
          kanbanQuery.isError ? <ErrorState message={kanbanQuery.error?.message} onRetry={kanbanQuery.refetch} />
            : <div className="flex gap-3 overflow-x-auto p-3">
              {LEAD_STATUSES.map((s) => {
                const items = kanbanQuery.data?.buckets?.[s.key] || [];
                return (
                  <div key={s.key} className="flex w-[260px] shrink-0 flex-col rounded-lg bg-slate-50">
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-1.5"><LeadStatus status={s.key} /><span className="text-2xs font-semibold text-ink-faint">{items.length}</span></div>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: 'calc(100vh - 330px)' }}>
                      {kanbanQuery.isLoading ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)
                        : items.length === 0 ? <p className="px-2 py-6 text-center text-2xs text-ink-faint">No leads</p>
                        : items.map((l) => (
                          <div key={l._id} className="group cursor-pointer rounded-lg border border-line bg-white p-2.5 shadow-card transition hover:border-slate-300 hover:shadow-pop" onClick={() => navigate(`/app/leads/${l._id}`)}>
                            <div className="flex items-start justify-between gap-1">
                              <p className="truncate text-xs font-semibold text-ink">{l.fullName}</p>
                              <button onClick={(e) => { e.stopPropagation(); openEdit(l); }} className="rounded p-0.5 text-ink-faint opacity-0 hover:bg-slate-100 hover:text-ink group-hover:opacity-100" aria-label="Edit lead"><MoreHorizontal size={12} /></button>
                            </div>
                            <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-faint">{l.email || l.phone || '—'}<Priority value={l.priority} size="sm" /></p>
                            {l.destinationCountry && <p className="mt-1 text-2xs text-ink-soft">{l.destinationCountry} · {labelFor(VISA_CATEGORIES, l.visaCategory, 'short')}</p>}
                            <div className="mt-1.5 flex items-center justify-between">
                              <span className="text-2xs text-ink-faint">{l.assignedToId?.name || 'Unassigned'}</span>
                              {can('leads.update') && (
                                <select onClick={(e) => e.stopPropagation()} value={l.status}
                                  onChange={(e) => changeStatus.mutate({ id: l._id, status: e.target.value })}
                                  className="rounded border border-line bg-white px-1 py-0.5 text-[10px] text-ink-soft">
                                  {LEAD_STATUSES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                                </select>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
        )}
      </div>

      <LeadForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} lead={editing} team={teamQuery.data || []} saving={saveLead.isPending} onSubmit={(p) => saveLead.mutate(p)} currentUserId={user?.id} />
      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => removeLead.mutate(deleteTarget._id)} busy={removeLead.isPending}
        title="Delete lead?" description={<>This permanently removes <strong className="text-ink">{deleteTarget?.fullName}</strong> and their notes. Converted leads cannot be deleted.</>}
        confirmLabel="Delete lead" />
    </div>
  );
}
