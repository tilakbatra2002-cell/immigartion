import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock, FileText, Circle, XCircle, MessageSquare, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, EmptyState, ErrorState, PageSkeleton, Button, Progress } from '../../components/ui';
import { date, dateTime, timeAgo } from '../../lib/format';
import { CASE_STATUSES, VISA_CATEGORIES, DOC_STATUSES, DOC_CATEGORIES, labelFor } from '../../lib/constants';

export default function PortalCaseDetail() {
  const { id } = useParams();
  const { data: c, isLoading, isError, error, refetch } = useQuery({ queryKey: ['portal', 'case', id], queryFn: () => api.get(`/portal/cases/${id}`) });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const checklist = c.documentChecklist || [];
  const done = checklist.filter((i) => ['VERIFIED', 'WAIVED'].includes(i.status)).length;
  const docs = c.documents || [];

  return (
    <div className="page-enter space-y-4">
      <Link to="/portal/cases" className="inline-flex items-center gap-1 text-2xs font-medium text-ink-soft hover:text-ink"><ArrowLeft size={11} />All cases</Link>

      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-ui text-2xs font-semibold text-ink-faint">{c.reference}</p>
            <h1 className="mt-0.5 text-lg font-extrabold tracking-tight text-ink">{c.title}</h1>
            <p className="mt-0.5 text-xs text-ink-soft">{labelFor(VISA_CATEGORIES, c.visaCategory)} · {c.destinationCountry}</p>
          </div>
          <Badge tone={c.status === 'APPROVED' ? 'success' : ['REFUSED'].includes(c.status) ? 'danger' : 'info'} dot>{labelFor(CASE_STATUSES, c.status)}</Badge>
        </div>
        <div className="mt-3 grid gap-2 border-t border-line pt-3 text-xs sm:grid-cols-3">
          <div><p className="text-2xs text-ink-faint">Application date</p><p className="font-medium text-ink">{c.applicationDate ? date(c.applicationDate) : 'Not submitted'}</p></div>
          <div><p className="text-2xs text-ink-faint">Target deadline</p><p className="font-medium text-ink">{c.targetDeadline ? date(c.targetDeadline) : '—'}</p></div>
          <div><p className="text-2xs text-ink-faint">Last updated</p><p className="font-medium text-ink">{timeAgo(c.updatedAt)}</p></div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-ink">Document checklist</h2><span className="text-2xs font-semibold text-ink-soft">{done}/{checklist.length}</span></div>
            <Progress value={checklist.length ? (done / checklist.length) * 100 : 0} className="mt-2" />
            {checklist.length === 0 ? <p className="mt-2 text-2xs text-ink-soft">No checklist items on this case.</p> : (
              <ul className="mt-3 space-y-1.5">
                {checklist.map((i) => (
                  <li key={i.key} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
                    {['VERIFIED', 'WAIVED'].includes(i.status) ? <CheckCircle2 size={13} className="shrink-0 text-emerald-600" /> : ['REJECTED', 'EXPIRED'].includes(i.status) ? <XCircle size={13} className="shrink-0 text-red-500" /> : i.status === 'UPLOADED' || i.status === 'UNDER_REVIEW' ? <Clock size={13} className="shrink-0 text-amber-500" /> : <Circle size={13} className="shrink-0 text-slate-300" />}
                    <span className="flex-1 text-xs text-ink">{i.label}{i.required && <span className="text-red-500">*</span>}</span>
                    <Badge tone={['VERIFIED', 'WAIVED'].includes(i.status) ? 'success' : ['REJECTED', 'EXPIRED'].includes(i.status) ? 'danger' : i.status === 'REQUIRED' ? 'muted' : 'warning'} size="sm">{labelFor(DOC_STATUSES, i.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {checklist.some((i) => ['REQUIRED', 'REJECTED'].includes(i.status)) && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 p-2.5">
                <p className="text-2xs text-amber-900">You have documents waiting to be uploaded.</p>
                <Link to="/portal/documents"><Button size="xs" icon={Upload}>Upload</Button></Link>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3"><h2 className="text-sm font-bold text-ink">Documents on this case</h2></div>
            {docs.length === 0 ? <EmptyState icon={FileText} title="No documents" description="Uploaded documents will appear here." /> : (
              <div className="divide-y divide-line">{docs.map((d) => (
                <div key={d._id} className="flex items-center gap-2 px-4 py-2.5">
                  <FileText size={13} className="text-ink-faint" />
                  <div className="min-w-0 flex-1"><p className="truncate text-xs text-ink">{d.name}</p><p className="text-2xs text-ink-faint">{labelFor(DOC_CATEGORIES, d.category)} · {timeAgo(d.createdAt)}</p></div>
                  <Badge tone={['VERIFIED'].includes(d.status) ? 'success' : ['REJECTED'].includes(d.status) ? 'danger' : 'muted'} size="sm">{labelFor(DOC_STATUSES, d.status)}</Badge>
                </div>
              ))}</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-bold text-ink">Progress timeline</h2>
            {(c.timeline || []).length === 0 ? <p className="mt-2 text-2xs text-ink-soft">Updates from your consultant will appear here.</p> : (
              <ol className="mt-3 space-y-3">
                {c.timeline.map((t, i) => (
                  <li key={t._id} className="relative pl-4">
                    <span className={`absolute left-0 top-1 h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-brand-600' : 'bg-slate-300'}`} />
                    {i !== c.timeline.length - 1 && <span className="absolute left-[2.5px] top-3 h-full w-px bg-line" />}
                    <p className="text-2xs font-semibold text-ink">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-2xs leading-relaxed text-ink-soft">{t.description}</p>}
                    <p className="mt-0.5 text-[10px] text-ink-faint">{dateTime(t.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="rounded-card border border-line bg-white p-4">
            <h2 className="text-sm font-bold text-ink">Questions?</h2>
            <p className="mt-1 text-2xs text-ink-soft">Message your consultant about this case.</p>
            <Link to="/portal/messages"><Button size="sm" variant="secondary" className="mt-2" icon={MessageSquare}>Open messages</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
