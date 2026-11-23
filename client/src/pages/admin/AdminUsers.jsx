import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, ShieldCheck, UserX, UserCheck, Search, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, EmptyState, ErrorState, Select, SearchInput, TableSkeleton, Pagination, Modal } from '../../components/ui';
import { date, timeAgo } from '../../lib/format';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [confirmGrant, setConfirmGrant] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users', page, q, role, status],
    queryFn: () => api.get(`/admin/users?page=${page}&limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}${role ? `&role=${role}` : ''}${status ? `&status=${status}` : ''}`),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/admin/users/${id}`, payload),
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
    onError: (e) => toast.error('Update failed', e.message),
  });
  const grant = useMutation({
    mutationFn: (id) => api.post(`/admin/users/${id}/grant-superadmin`, { confirm: true }),
    onSuccess: () => { toast.success('Super admin access granted'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setConfirmGrant(null); },
    onError: (e) => toast.error('Could not grant access', e.message),
  });

  return (
    <div className="page-enter">
      <div className="mb-4"><h1 className="text-lg font-extrabold tracking-tight text-ink">Users</h1><p className="mt-0.5 text-xs text-ink-soft">All platform accounts including client portal users. Disabling a user revokes access immediately.</p></div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name or email…" className="w-full sm:w-60" />
          <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="h-8 w-36 text-xs" placeholder="All roles">
            {['OWNER', 'ADMIN', 'CONSULTANT', 'CASE_MANAGER', 'ACCOUNTANT', 'VIEWER', 'CLIENT', 'SAAS_ADMIN'].map((r) => <option key={r} value={r}>{r.toLowerCase().replace('_', ' ')}</option>)}
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-8 w-28 text-xs" placeholder="All statuses">
            {['ACTIVE', 'DISABLED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
          </Select>
          {data?.meta && <span className="ml-auto text-2xs text-ink-faint">{data.meta.total.toLocaleString()} users</span>}
        </div>
        {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : isLoading ? <TableSkeleton rows={8} cols={5} /> : !data?.data?.length ? <EmptyState icon={Users} title="No users found" description="Try a different search or filter." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">User</th><th className="table-th">Membership</th><th className="table-th">Platform role</th><th className="table-th">Last login</th><th className="table-th">Joined</th><th className="table-th"></th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.data.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/60">
                    <td className="table-td"><p className="text-xs font-semibold text-ink">{u.name}{u._id === me?.id && <span className="ml-1 text-2xs text-ink-faint">(you)</span>}</p><p className="text-2xs text-ink-faint">{u.email}</p></td>
                    <td className="table-td text-2xs text-ink-soft">{u.memberships?.length ? u.memberships.map((m) => `${m.organization} · ${m.role}`).join(', ') : u.role === 'CLIENT' ? 'Portal user' : 'No organization'}</td>
                    <td className="table-td"><div className="flex flex-wrap gap-1"><Badge tone={u.isSuperAdmin ? 'info' : u.status === 'DISABLED' ? 'danger' : 'muted'} size="sm">{u.isSuperAdmin ? 'Super admin' : u.role?.toLowerCase().replace('_', ' ')}</Badge>{u.status === 'DISABLED' && <Badge tone="danger" size="sm">disabled</Badge>}</div></td>
                    <td className="table-td text-2xs text-ink-soft">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                    <td className="table-td text-2xs text-ink-soft">{date(u.createdAt)}</td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        {u._id !== me?.id && (u.status === 'ACTIVE'
                          ? <Button size="xs" variant="ghost" icon={UserX} onClick={() => update.mutate({ id: u._id, payload: { status: 'DISABLED' } })}>Disable</Button>
                          : <Button size="xs" variant="ghost" icon={UserCheck} onClick={() => update.mutate({ id: u._id, payload: { status: 'ACTIVE' } })}>Enable</Button>)}
                        {!u.isSuperAdmin && u._id !== me?.id && <Button size="xs" variant="ghost" icon={ShieldAlert} onClick={() => setConfirmGrant(u)}>Grant admin</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.meta?.pages > 1 && <div className="border-t border-line px-3 py-2"><Pagination meta={data.meta} onPage={setPage} /></div>}
      </div>

      <Modal open={Boolean(confirmGrant)} onClose={() => setConfirmGrant(null)} title="Grant platform super admin" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setConfirmGrant(null)}>Cancel</Button><Button size="sm" variant="danger" loading={grant.isPending} onClick={() => grant.mutate(confirmGrant._id)}>Grant full platform access</Button></>}>
        <div className="space-y-2">
          <p className="text-xs text-ink-soft"><strong className="text-ink">{confirmGrant?.name}</strong> ({confirmGrant?.email}) will gain full read/write access to every organization on the platform, including the ability to grant super admin to others.</p>
          <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-2xs text-red-800">This is a high-risk action and is recorded in the platform audit trail. Only do this for trusted platform operators.</p>
        </div>
      </Modal>
    </div>
  );
}
