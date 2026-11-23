import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, UserSquare2 } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import DataTable from '../../components/domain/DataTable';
import FilterBar, { FilterSelect } from '../../components/domain/FilterBar';
import { Button, SearchInput, Pagination, EmptyState, ErrorState, TableSkeleton, Avatar, Badge, Select as UISelect, Input, Modal, PageSkeleton } from '../../components/ui';
import { COUNTRIES, RESIDENCE_COUNTRIES, countryName, countryChip } from '../../lib/constants';
import { date } from '../../lib/format';
import ClientForm from './ClientForm';

const STATUSES = [{ key: 'ACTIVE', label: 'Active' }, { key: 'INACTIVE', label: 'Inactive' }, { key: 'ARCHIVED', label: 'Archived' }];

export default function Clients() {
  const { can, user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ status: 'ACTIVE', preferredDestination: '' });
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, filters]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['clients', { page, debounced, ...filters }],
    queryFn: () => api.get(`/clients${qs({ page, limit: 20, q: debounced, ...filters })}`),
  });
  const teamQuery = useQuery({ queryKey: ['team', 'lite'], queryFn: () => api.get('/organization/team?limit=100'), select: (d) => d.data });

  const save = useMutation({
    mutationFn: (payload) => editing ? api.patch(`/clients/${editing._id}`, payload) : api.post('/clients', payload),
    onSuccess: (client) => {
      toast.success(editing ? 'Client updated' : 'Client created', editing ? undefined : `Reference ${client.reference}`);
      qc.invalidateQueries({ queryKey: ['clients'] }); qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false); setEditing(null);
      if (!editing && client?._id) navigate(`/app/clients/${client._id}`);
    },
    onError: (e) => toast.error('Could not save client', e.message),
  });

  const columns = [
    {
      key: 'name', header: 'Client', render: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={`${c.firstName} ${c.lastName || ''}`} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{c.firstName} {c.lastName}</p>
            <p className="truncate font-ui text-2xs text-ink-faint">{c.reference}</p>
          </div>
        </div>
      ),
    },
    { key: 'contact', header: 'Contact', render: (c) => <div><p className="text-xs text-ink">{c.email || '—'}</p><p className="text-2xs text-ink-faint">{c.phone || ''}</p></div> },
    { key: 'preferredDestination', header: 'Destination', render: (c) => c.preferredDestination ? <span className="text-xs">{countryChip(c.preferredDestination)} {countryName(c.preferredDestination)}</span> : <span className="text-xs text-ink-faint">—</span> },
    { key: 'assignedConsultantId', header: 'Consultant', render: (c) => c.assignedConsultantId ? <span className="text-xs text-ink-soft">{c.assignedConsultantId.name}</span> : <span className="text-2xs text-ink-faint">Unassigned</span> },
    { key: 'type', header: 'Type', render: (c) => <Badge tone={c.type === 'FAMILY' ? 'violet' : 'neutral'} size="sm">{c.type === 'FAMILY' ? 'Family' : 'Individual'}</Badge> },
    { key: 'portalAccess', header: 'Portal', render: (c) => <Badge tone={c.portalAccess?.enabled ? 'success' : 'muted'} size="sm">{c.portalAccess?.enabled ? 'Enabled' : 'Off'}</Badge> },
    { key: 'status', header: 'Status', render: (c) => <Badge tone={c.status === 'ACTIVE' ? 'success' : 'muted'} dot size="sm">{c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Badge> },
    { key: 'createdAt', header: 'Added', render: (c) => <span className="text-xs text-ink-soft">{date(c.createdAt)}</span> },
  ];

  return (
    <div className="page-enter">
      <PageHeader title="Clients" description="Client profiles with family members, sensitive identity data and linked cases."
        actions={can('clients.create') && <Button size="sm" icon={Plus} onClick={() => { setEditing(null); setShowForm(true); }}>Add client</Button>} />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, reference…" className="flex-1" />
          <FilterBar>
            <FilterSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} placeholder="All statuses" options={STATUSES} />
            <FilterSelect value={filters.preferredDestination} onChange={(v) => setFilters({ ...filters, preferredDestination: v })} placeholder="All destinations" options={COUNTRIES} />
          </FilterBar>
        </div>
        {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : (
          <>
            <DataTable columns={columns} rows={data?.data || []} onRowClick={(c) => navigate(`/app/clients/${c._id}`)} loading={isLoading}
              skeleton={<TableSkeleton rows={6} cols={7} bare />}
              empty={<EmptyState icon={UserSquare2} title="No clients found" description={debounced || filters.preferredDestination ? 'No clients match these filters.' : 'Convert a qualified lead or add a client directly.'}
                action={can('clients.create') ? <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>Add client</Button> : null} />} />
            <Pagination meta={data?.meta} onPage={setPage} />
          </>
        )}
      </div>

      <ClientForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} client={editing} team={teamQuery.data || []}
        saving={save.isPending} onSubmit={(p) => save.mutate(p)} canSensitive={can('clients.sensitive')} />
    </div>
  );
}
