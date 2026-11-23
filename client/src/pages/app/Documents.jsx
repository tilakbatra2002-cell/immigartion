import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { FileText, Upload, Download, CheckCircle2, XCircle, Trash2, Eye, AlertTriangle, FilePlus2, FolderOpen } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import DataTable from '../../components/domain/DataTable';
import FilterBar, { FilterSelect } from '../../components/domain/FilterBar';
import ConfirmDialog from '../../components/domain/ConfirmDialog';
import { DocStatus } from '../../components/domain/StatusBadge';
import { Button, SearchInput, Pagination, EmptyState, ErrorState, TableSkeleton, Modal, Input, Select, Textarea } from '../../components/ui';
import { DOC_CATEGORIES, DOC_STATUSES, labelFor } from '../../lib/constants';
import { date, fileSize, relativeDays } from '../../lib/format';

export default function Documents() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ status: '', category: '', requested: params.get('requested') || '' });
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({ name: '', category: 'OTHER', caseId: '', clientId: '', expiryDate: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, filters]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['documents', { page, debounced, ...filters }],
    queryFn: () => api.get(`/documents${qs({ page, limit: 20, q: debounced, ...filters })}`),
  });
  const cases = useQuery({ queryKey: ['cases', 'picker'], queryFn: () => api.get('/cases?limit=100') });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const doUpload = async () => {
    if (!file) { toast.error('Choose a file'); return; }
    if (!uploadForm.name.trim()) { toast.error('Give the document a name'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', uploadForm.name);
    fd.append('category', uploadForm.category);
    if (uploadForm.caseId) fd.append('caseId', uploadForm.caseId);
    if (uploadForm.clientId) fd.append('clientId', uploadForm.clientId);
    if (uploadForm.expiryDate) fd.append('expiryDate', uploadForm.expiryDate);
    if (uploadForm.description) fd.append('description', uploadForm.description);
    setBusy(true);
    try {
      await api.upload('/documents', fd);
      toast.success('Document uploaded');
      invalidate(); setUploadOpen(false); setFile(null); setUploadForm({ name: '', category: 'OTHER', caseId: '', clientId: '', expiryDate: '', description: '' });
    } catch (e) { toast.error('Upload failed', e.message); } finally { setBusy(false); }
  };

  const verify = useMutation({
    mutationFn: ({ id, status, reason }) => api.patch(`/documents/${id}/status`, { status, rejectionReason: reason }),
    onSuccess: (_, v) => { toast.success(v.status === 'VERIFIED' ? 'Document verified' : 'Document rejected'); invalidate(); },
    onError: (e) => toast.error('Update failed', e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => api.del(`/documents/${id}`),
    onSuccess: () => { toast.success('Document deleted'); setDeleteTarget(null); invalidate(); },
    onError: (e) => { toast.error('Delete failed', e.message); setDeleteTarget(null); },
  });

  const openDoc = async (d, mode = 'download') => {
    try {
      const r = await api.get(`/documents/${d._id}/download`);
      if (mode === 'preview' && r.previewable) setPreview({ ...r, name: d.name });
      else window.open(r.url, '_blank', 'noopener');
    } catch (e) { toast.error('Could not open file', e.message); }
  };

  const columns = [
    {
      key: 'name', header: 'Document', render: (d) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-ink-faint"><FileText size={14} /></div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{d.name}</p>
            <p className="truncate text-2xs text-ink-faint">
              {d.versions?.[d.versions.length - 1]?.fileName || (d.isRequested ? 'Awaiting upload' : 'No file')}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (d) => <span className="text-xs text-ink-soft">{labelFor(DOC_CATEGORIES, d.category)}</span> },
    {
      key: 'linked', header: 'Linked to', render: (d) => (
        <div className="text-xs">
          {d.caseId ? <span className="font-ui text-ink-soft">{d.caseId.reference}</span> : d.clientId ? <span className="text-ink-soft">{d.clientId.firstName} {d.clientId.lastName}</span> : <span className="text-ink-faint">Unlinked</span>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (d) => <DocStatus status={d.status} size="sm" /> },
    {
      key: 'expiryDate', header: 'Expiry', render: (d) => {
        if (!d.expiryDate) return <span className="text-2xs text-ink-faint">—</span>;
        const days = relativeDays(d.expiryDate);
        return <span className={`text-xs ${days < 0 ? 'text-red-600' : days < 60 ? 'text-amber-700' : 'text-ink-soft'}`}>{date(d.expiryDate)}{days < 0 ? ' · expired' : ''}</span>;
      },
    },
    { key: 'size', header: 'Size', render: (d) => <span className="text-2xs text-ink-faint">{d.versions?.length ? fileSize(d.versions[d.versions.length - 1].size) : '—'}</span> },
    { key: 'createdAt', header: 'Uploaded', render: (d) => <span className="whitespace-nowrap text-xs text-ink-soft">{date(d.createdAt)}</span> },
    {
      key: 'actions', header: '', align: 'right', render: (d) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {d.versions?.length > 0 && <>
            <button onClick={() => openDoc(d, 'preview')} className="rounded p-1.5 text-ink-faint hover:bg-slate-100 hover:text-ink" title="Preview"><Eye size={13} /></button>
            <button onClick={() => openDoc(d, 'download')} className="rounded p-1.5 text-ink-faint hover:bg-slate-100 hover:text-ink" title="Download"><Download size={13} /></button>
          </>}
          {can('documents.verify') && d.versions?.length > 0 && d.status !== 'VERIFIED' && (
            <button onClick={() => verify.mutate({ id: d._id, status: 'VERIFIED' })} className="rounded p-1.5 text-ink-faint hover:bg-emerald-50 hover:text-emerald-600" title="Verify"><CheckCircle2 size={13} /></button>
          )}
          {can('documents.verify') && d.versions?.length > 0 && d.status !== 'REJECTED' && (
            <button onClick={() => verify.mutate({ id: d._id, status: 'REJECTED', reason: 'Rejected by reviewer' })} className="rounded p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600" title="Reject"><XCircle size={13} /></button>
          )}
          {can('documents.delete') && <button onClick={() => setDeleteTarget(d)} className="rounded p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>}
        </div>
      ),
    },
  ];

  return (
    <div className="page-enter">
      <PageHeader title="Documents" description="Secure document collection with verification, version history and expiry tracking. Files are private and served through short-lived signed links."
        actions={can('documents.upload') && <Button size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>Upload document</Button>} />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search documents…" className="flex-1" />
          <FilterBar>
            <FilterSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} placeholder="All statuses" options={DOC_STATUSES} />
            <FilterSelect value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })} placeholder="All categories" options={DOC_CATEGORIES} />
            <FilterSelect value={filters.requested} onChange={(v) => setFilters({ ...filters, requested: v })} placeholder="Any" options={[{ key: 'true', label: 'Awaiting upload' }, { key: 'false', label: 'Files only' }]} />
          </FilterBar>
        </div>
        {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : (
          <>
            <DataTable columns={columns} rows={data?.data || []} loading={isLoading} skeleton={<TableSkeleton rows={6} cols={6} bare />}
              empty={<EmptyState icon={FolderOpen} title="No documents" description={debounced || Object.values(filters).some(Boolean) ? 'No documents match these filters.' : 'Upload passports, financials and supporting letters against client cases.'}
                action={can('documents.upload') ? <Button size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>Upload document</Button> : null} />} />
            <Pagination meta={data?.meta} onPage={setPage} />
          </>
        )}
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload document"
        description="Files are validated by type and size, stored privately and never publicly indexed."
        footer={<><Button variant="secondary" size="sm" onClick={() => setUploadOpen(false)}>Cancel</Button><Button size="sm" loading={busy} onClick={doUpload}>Upload</Button></>}>
        <div className="space-y-3.5">
          <div onClick={() => fileRef.current?.click()} className="cursor-pointer rounded-lg border-2 border-dashed border-line p-6 text-center transition hover:border-brand-400 hover:bg-brand-25/30">
            <Upload size={18} className="mx-auto text-ink-faint" />
            <p className="mt-2 text-xs font-semibold text-ink">{file ? file.name : 'Click to choose a file'}</p>
            <p className="mt-0.5 text-2xs text-ink-faint">PDF, JPG, PNG, WEBP, TIFF, DOC, DOCX · max 20 MB</p>
          </div>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff,.doc,.docx" onChange={(e) => {
            const f = e.target.files?.[0];
            setFile(f || null);
            if (f && !uploadForm.name) setUploadForm((s) => ({ ...s, name: f.name.replace(/\.[^.]+$/, '') }));
          }} />
          <Input label="Document name" required value={uploadForm.name} onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })} placeholder="Passport bio page" />
          <div className="grid grid-cols-2 gap-3.5">
            <Select label="Category" value={uploadForm.category} onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}>
              {DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
            <Input label="Expiry date" type="date" value={uploadForm.expiryDate} onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })} hint="For passports / PCC" />
          </div>
          <Select label="Link to case" value={uploadForm.caseId} onChange={(e) => setUploadForm({ ...uploadForm, caseId: e.target.value })} placeholder="Not linked to a case">
            {(cases.data?.data || []).map((c) => <option key={c._id} value={c._id}>{c.reference} — {c.clientId?.firstName} {c.clientId?.lastName}</option>)}
          </Select>
        </div>
      </Modal>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name} size="xl"
        footer={<><Button variant="secondary" size="sm" onClick={() => setPreview(null)}>Close</Button><Button size="sm" icon={Download} onClick={() => window.open(preview?.url, '_blank', 'noopener')}>Download</Button></>}>
        {preview && (
          preview.mimeType === 'application/pdf'
            ? <iframe title="Document preview" src={preview.url} className="h-[65vh] w-full rounded-lg border border-line" />
            : <img src={preview.url} alt={preview.name} className="mx-auto max-h-[65vh] rounded-lg" />
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => remove.mutate(deleteTarget._id)} busy={remove.isPending}
        title="Delete document?" description={<><strong className="text-ink">{deleteTarget?.name}</strong> and all its versions will be permanently removed from storage. An audit record is retained.</>} confirmLabel="Delete document" />
    </div>
  );
}
