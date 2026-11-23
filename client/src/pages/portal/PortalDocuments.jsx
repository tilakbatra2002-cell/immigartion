import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Download, AlertCircle, CheckCircle2, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Select, Input, EmptyState, ErrorState, PageSkeleton, Modal, SearchInput, Tabs } from '../../components/ui';
import { date, timeAgo, fileSize } from '../../lib/format';
import { DOC_STATUSES, DOC_CATEGORIES, labelFor } from '../../lib/constants';

const MAX = 15 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

export default function PortalDocuments() {
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'PASSPORT', caseId: '', file: null });
  const [downloading, setDownloading] = useState(null);

  const docs = useQuery({ queryKey: ['portal', 'documents'], queryFn: () => api.get('/portal/documents') });
  const cases = useQuery({ queryKey: ['portal', 'cases'], queryFn: () => api.get('/portal/cases') });

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('name', form.name || form.file.name);
      fd.append('category', form.category);
      if (form.caseId) fd.append('caseId', form.caseId);
      return api.upload('/portal/documents', fd);
    },
    onSuccess: () => { toast.success('Document uploaded', 'Your consultant will review it.'); qc.invalidateQueries({ queryKey: ['portal'] }); setUploadOpen(false); setForm({ name: '', category: 'PASSPORT', caseId: '', file: null }); },
    onError: (e) => toast.error('Upload failed', e.message),
  });

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX) { toast.error('File too large', 'Maximum size is 15 MB.'); return; }
    setForm((s) => ({ ...s, file: f, name: s.name || f.name.replace(/\.[^.]+$/, '') }));
  };

  const download = async (d) => {
    setDownloading(d._id);
    try { const r = await api.get(`/portal/documents/${d._id}/download`); window.open(r.url, '_blank', 'noopener'); }
    catch (e) { toast.error('Download failed', e.message); } finally { setDownloading(null); }
  };

  if (docs.isLoading) return <PageSkeleton />;
  if (docs.isError) return <ErrorState message={docs.error?.message} onRetry={docs.refetch} />;

  const all = docs.data?.data || [];
  const filtered = all.filter((d) => {
    if (tab === 'action' && !['REQUIRED', 'REJECTED'].includes(d.status)) return false;
    if (tab === 'verified' && d.status !== 'VERIFIED') return false;
    if (q && !d.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const actionCount = all.filter((d) => ['REQUIRED', 'REJECTED'].includes(d.status)).length;

  return (
    <div className="page-enter">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-lg font-extrabold tracking-tight text-ink">Documents</h1><p className="mt-0.5 text-xs text-ink-soft">Upload requested documents and track verification.</p></div>
        <Button size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>Upload document</Button>
      </div>

      {actionCount > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 p-3">
          <AlertCircle size={14} className="mt-0.5 text-amber-600" />
          <p className="text-2xs text-amber-900"><strong>{actionCount} document{actionCount > 1 ? 's' : ''}</strong> need{actionCount === 1 ? 's' : ''} your attention — upload the requested files or replace rejected ones.</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <Tabs tabs={[{ key: 'all', label: 'All', count: all.length }, { key: 'action', label: 'Action needed', count: actionCount }, { key: 'verified', label: 'Verified' }]} value={tab} onChange={setTab} />
          <div className="ml-auto"><SearchInput value={q} onChange={setQ} placeholder="Search documents…" className="h-8 w-48 text-xs" /></div>
        </div>
        {filtered.length === 0 ? <EmptyState icon={FileText} title={q ? 'No matching documents' : 'No documents yet'} description={q ? 'Try a different term.' : 'Documents requested by your consultant appear here with an upload action.'} action={<Button size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>Upload now</Button>} /> : (
          <div className="divide-y divide-line">
            {filtered.map((d) => (
              <div key={d._id} className="flex flex-wrap items-center gap-2.5 px-4 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-50 text-ink-soft"><FileText size={13} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{d.name}</p>
                  <p className="text-2xs text-ink-faint">{labelFor(DOC_CATEGORIES, d.category)} · {d.hasFile ? `uploaded ${timeAgo(d.createdAt)}` : 'not uploaded yet'}</p>
                </div>
                <Badge tone={['VERIFIED', 'WAIVED'].includes(d.status) ? 'success' : ['REJECTED', 'EXPIRED'].includes(d.status) ? 'danger' : d.status === 'REQUIRED' ? 'warning' : 'muted'} size="sm">{labelFor(DOC_STATUSES, d.status)}</Badge>
                {['REQUIRED', 'REJECTED'].includes(d.status) ? (
                  <Button size="xs" onClick={() => { setForm({ name: d.name, category: d.category || 'OTHER', caseId: d.caseId || '', file: null }); setUploadOpen(true); }}>Upload</Button>
                ) : d.hasFile ? (
                  <Button size="xs" variant="secondary" loading={downloading === d._id} onClick={() => download(d)} icon={Download}>View</Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-[10px] text-ink-faint">Accepted: PDF, JPG, PNG, DOC, DOCX up to 15 MB. Files are private — only your case team can open them.</p>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload document" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setUploadOpen(false)}>Cancel</Button><Button size="sm" loading={upload.isPending} disabled={!form.file} onClick={() => upload.mutate()}>Upload</Button></>}>
        <div className="space-y-3">
          <div onClick={() => fileRef.current?.click()} className="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-canvas p-5 text-center hover:border-brand-400">
            <input ref={fileRef} type="file" accept={ACCEPT} onChange={pick} className="hidden" />
            {form.file ? (
              <div className="flex items-center justify-center gap-2"><FileText size={15} className="text-brand-700" /><div className="text-left"><p className="text-xs font-semibold text-ink">{form.file.name}</p><p className="text-2xs text-ink-faint">{fileSize(form.file.size)}</p></div>
                <button onClick={(e) => { e.stopPropagation(); setForm({ ...form, file: null }); }} className="ml-1 rounded p-1 text-ink-faint hover:bg-slate-100"><X size={12} /></button></div>
            ) : <><Upload size={18} className="mx-auto text-ink-faint" /><p className="mt-1 text-xs font-medium text-ink">Choose a file</p><p className="text-2xs text-ink-faint">PDF, JPG, PNG or Word · max 15 MB</p></>}
          </div>
          <Input label="Document name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Passport bio page" />
          <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
          <Select label="Related case (optional)" value={form.caseId} onChange={(e) => setForm({ ...form, caseId: e.target.value })} placeholder="No specific case">
            {(cases.data?.data || []).map((c) => <option key={c._id} value={c._id}>{c.reference} — {c.title}</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  );
}
