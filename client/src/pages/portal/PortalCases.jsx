import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, ArrowRight, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, EmptyState, ErrorState, PageSkeleton, SearchInput } from '../../components/ui';
import { date, relativeDays } from '../../lib/format';
import { CASE_STATUSES, VISA_CATEGORIES, labelFor } from '../../lib/constants';

export default function PortalCases() {
  const [q, setQ] = useState('');
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['portal', 'cases'], queryFn: () => api.get('/portal/cases') });
  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const rows = (data?.data || []).filter((c) => !q || `${c.reference} ${c.title} ${c.destinationCountry}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page-enter">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-lg font-extrabold tracking-tight text-ink">My cases</h1><p className="mt-0.5 text-xs text-ink-soft">{rows.length} case{rows.length === 1 ? '' : 's'} on file.</p></div>
        <SearchInput value={q} onChange={setQ} placeholder="Search reference or country…" className="w-full sm:w-64" />
      </div>
      {rows.length === 0 ? <div className="card"><EmptyState icon={Briefcase} title={q ? 'No matching cases' : 'No cases yet'} description={q ? 'Try a different search term.' : 'Your consultant will open a case after your consultation.'} /></div> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <Link key={c._id} to={`/portal/cases/${c._id}`} className="card group p-4 transition hover:border-brand-300">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-ui text-2xs font-semibold text-ink-faint">{c.reference}</p>
                  <h2 className="mt-0.5 truncate text-sm font-bold text-ink">{c.title}</h2>
                  <p className="mt-0.5 text-2xs text-ink-soft">{labelFor(VISA_CATEGORIES, c.visaCategory)} · {c.destinationCountry}</p>
                </div>
                <Badge tone={['APPROVED'].includes(c.status) ? 'success' : ['REFUSED', 'CLOSED'].includes(c.status) ? 'danger' : 'info'} size="sm">{labelFor(CASE_STATUSES, c.status)}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-2xs text-ink-soft">
                <span>{c.targetDeadline ? `Target: ${date(c.targetDeadline)}` : 'No deadline set'}</span>
                <span className="flex items-center gap-1 font-semibold text-brand-700">Open <ArrowRight size={11} className="transition group-hover:translate-x-0.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="mt-4 text-[10px] text-ink-faint">Case statuses are updated by your consultant. AI never changes a case status. Contact your consultant if something looks incorrect.</p>
    </div>
  );
}
