import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, EmptyState, ErrorState, SearchInput, Select, TableSkeleton, Pagination } from '../../components/ui';
import { date } from '../../lib/format';

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'audit', page, action],
    queryFn: () => api.get(`/admin/audit-logs?page=${page}&limit=30${action ? `&action=${encodeURIComponent(action)}` : ''}`),
  });

  return (
    <div className="page-enter">
      <div className="mb-4"><h1 className="text-lg font-extrabold tracking-tight text-ink">Platform audit trail</h1><p className="mt-0.5 text-xs text-ink-soft">Every security-relevant action across tenants. Entries are append-only.</p></div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="h-8 w-48 text-xs" placeholder="All actions">
            {['admin.', 'auth.', 'lead.', 'client.', 'case.', 'document.', 'invoice.', 'payment.', 'team.', 'billing.', 'portal.', 'subscription.'].map((a) => <option key={a} value={a}>{a.replace('.', '')}</option>)}
          </Select>
          {data?.meta && <span className="ml-auto text-2xs text-ink-faint">{data.meta.total.toLocaleString()} entries</span>}
        </div>
        {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : isLoading ? <TableSkeleton rows={10} cols={5} /> : !data?.data?.length ? <EmptyState icon={ScrollText} title="No audit entries" description="Platform events will be recorded here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Action</th><th className="table-th">Organization</th><th className="table-th">Actor</th><th className="table-th">Description</th><th className="table-th">When</th><th className="table-th">IP</th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.data.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50/60">
                    <td className="table-td"><code className="rounded bg-slate-100 px-1 py-0.5 font-ui text-[10px] text-ink-soft">{l.action}</code></td>
                    <td className="table-td text-2xs text-ink-soft">{l.organizationId?.name || <span className="text-ink-faint">platform</span>}</td>
                    <td className="table-td text-2xs">{l.actorName || '—'}<span className="block text-ink-faint">{l.actorRole}</span></td>
                    <td className="table-td text-2xs text-ink-soft"><span className="line-clamp-2">{l.description}</span></td>
                    <td className="table-td whitespace-nowrap text-2xs text-ink-soft">{date(l.createdAt, { time: true })}</td>
                    <td className="table-td font-ui text-2xs text-ink-faint">{l.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.meta?.pages > 1 && <div className="border-t border-line px-3 py-2"><Pagination meta={data.meta} onPage={setPage} /></div>}
      </div>
    </div>
  );
}
