import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Briefcase, List, LayoutGrid, Clock4, Filter } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import DataTable from '../../components/domain/DataTable';
import FilterBar, { FilterSelect } from '../../components/domain/FilterBar';
import { CaseStatus, Priority } from '../../components/domain/StatusBadge';
import { Button, SearchInput, Pagination, EmptyState, ErrorState, TableSkeleton, Badge, Avatar } from '../../components/ui';
import { CASE_STATUSES, VISA_CATEGORIES, COUNTRIES, PRIORITIES, labelFor, countryName, countryChip } from '../../lib/constants';
import { date, relativeDays } from '../../lib/format';
import CaseForm from './CaseForm';

export default function Cases() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ status: params.get('status') || '', priority: '', destinationCountry: '', visaCategory: '', consultantId: '' });
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const prefillClient = params.get('clientId') || '';

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, filters]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cases', { page, debounced, ...filters }],
    queryFn: () => api.get(`/cases${qs({ page, limit: 20, q: debounced, ...filters })}`),
    enabled: view === 'table',
  });
  const board = useQuery({ queryKey: ['cases', 'board'], queryFn: () => api.get('/cases/board'), enabled: view === 'board' });
  const teamQuery = useQuery({ queryKey: ['team', 'lite'], queryFn: () => api.get('/organization/team?limit=100'), select: (d) => d.data });

  const save = useMutation({
    mutationFn: (payload) => api.post('/cases', payload),
    onSuccess: (c) => {
      toast.success('Case created', c.reference);
      qc.invalidateQueries({ queryKey: ['cases'] }); qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false);
      navigate(`/app/cases/${c._id}`);
    },
    onError: (e) => toast.error('Could not create case', e.message),
  });

  const columns = [
    {
      key: 'reference', header: 'Case', render: (c) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ink">{c.title}</p>
          <p className="font-ui text-2xs text-ink-faint">{c.reference}</p>
        </div>
      ),
    },
    {
      key: 'client', header: 'Client', render: (c) => c.clientId ? (
        <div className="flex items-center gap-2"><Avatar name={`${c.clientId.firstName} ${c.clientId.lastName || ''}`} size="xs" />
          <div><p className="text-xs text-ink">{c.clientId.firstName} {c.clientId.lastName}</p><p className="font-ui text-2xs text-ink-faint">{c.clientId.reference}</p></div></div>
      ) : '—',
    },
    { key: 'destination', header: 'Destination', render: (c) => <span className="whitespace-nowrap text-xs">{countryChip(c.destinationCountry)} {countryName(c.destinationCountry)}</span> },
    { key: 'visaCategory', header: 'Category', render: (c) => <span className="whitespace-nowrap text-xs text-ink-soft">{labelFor(VISA_CATEGORIES, c.visaCategory, 'short')}</span> },
    { key: 'status', header: 'Status', render: (c) => <CaseStatus status={c.status} size="sm" /> },
    { key: 'priority', header: 'Priority', render: (c) => <Priority value={c.priority} size="sm" /> },
    {
      key: 'targetDeadline', header: 'Deadline', render: (c) => {
        if (!c.targetDeadline) return <span className="text-2xs text-ink-faint">—</span>;
        const d = relativeDays(c.targetDeadline);
        const terminal = ['APPROVED', 'REFUSED', 'WITHDRAWN', 'CLOSED'].includes(c.status);
        return <span className={`whitespace-nowrap text-xs font-medium ${terminal ? 'text-ink-faint' : d < 0 ? 'text-red-600' : d <= 14 ? 'text-amber-700' : 'text-ink-soft'}`}>
          {date(c.targetDeadline)}{!terminal && d < 0 ? ' · overdue' : ''}
        </span>;
      },
    },
    { key: 'consultantId', header: 'Consultant', render: (c) => c.consultantId ? <span className="whitespace-nowrap text-xs text-ink-soft">{c.consultantId.name}</span> : <span className="text-2xs text-ink-faint">—</span> },
  ];

  return (
    <div className="page-enter">
      <PageHeader title="Cases" description="Every immigration application with deadlines, checklists and a full audit trail."
        actions={can('cases.create') && <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>New case</Button>} />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search reference or title…" className="flex-1" />
          <FilterBar>
            <FilterSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} placeholder="All statuses" options={CASE_STATUSES} />
            <FilterSelect value={filters.visaCategory} onChange={(v) => setFilters({ ...filters, visaCategory: v })} placeholder="All categories" options={VISA_CATEGORIES} />
            <FilterSelect value={filters.destinationCountry} onChange={(v) => setFilters({ ...filters, destinationCountry: v })} placeholder="All destinations" options={COUNTRIES} />
            <div className="flex rounded-lg border border-line p-0.5">
              <button onClick={() => setView('table')} className={`rounded-md p-1.5 ${view === 'table' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-slate-50'}`} aria-label="Table view"><List size={14} /></button>
              <button onClick={() => setView('board')} className={`rounded-md p-1.5 ${view === 'board' ? 'bg-navy text-white' : 'text-ink-soft hover:bg-slate-50'}`} aria-label="Board view"><LayoutGrid size={14} /></button>
            </div>
          </FilterBar>
        </div>

        {view === 'table' ? (
          isError ? <ErrorState message={error?.message} onRetry={refetch} /> : (
            <>
              <DataTable columns={columns} rows={data?.data || []} onRowClick={(c) => navigate(`/app/cases/${c._id}`)} loading={isLoading}
                skeleton={<TableSkeleton rows={7} cols={7} bare />}
                empty={<EmptyState icon={Briefcase} title="No cases found" description={debounced || Object.values(filters).some(Boolean) ? 'No cases match these filters.' : 'Create your first immigration case to get started.'}
                  action={can('cases.create') ? <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>New case</Button> : null} />} />
              <Pagination meta={data?.meta} onPage={setPage} />
            </>
          )
        ) : (
          board.isError ? <ErrorState message={board.error?.message} onRetry={board.refetch} /> : (
            <div className="flex gap-3 overflow-x-auto p-3">
              {(board.data?.columns || []).map((col) => (
                <div key={col.key} className="flex w-[250px] shrink-0 flex-col rounded-lg bg-slate-50">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-2xs font-bold text-ink">{col.label}</span>
                    <span className="rounded bg-white px-1.5 py-0.5 font-ui text-2xs font-semibold text-ink-faint ring-1 ring-line">{col.items.length}</span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                    {board.isLoading ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)
                      : col.items.length === 0 ? <p className="px-2 py-5 text-center text-2xs text-ink-faint">Empty</p>
                      : col.items.map((c) => (
                        <button key={c._id} onClick={() => navigate(`/app/cases/${c._id}`)} className="w-full rounded-lg border border-line bg-white p-2.5 text-left shadow-card transition hover:border-slate-300 hover:shadow-pop">
                          <p className="text-xs font-semibold leading-tight text-ink">{c.clientId?.firstName} {c.clientId?.lastName}</p>
                          <p className="mt-0.5 font-ui text-2xs text-ink-faint">{c.reference}</p>
                          <p className="mt-1 text-2xs text-ink-soft">{countryChip(c.destinationCountry)} {labelFor(VISA_CATEGORIES, c.visaCategory, 'short')}</p>
                          <div className="mt-1.5 flex items-center justify-between">
                            <Priority value={c.priority} size="sm" />
                            {c.targetDeadline && <span className="text-[10px] text-ink-faint">{date(c.targetDeadline)}</span>}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <CaseForm open={showForm} onClose={() => setShowForm(false)} team={teamQuery.data || []} saving={save.isPending} onSubmit={(p) => save.mutate(p)} prefillClient={prefillClient} />
    </div>
  );
}
