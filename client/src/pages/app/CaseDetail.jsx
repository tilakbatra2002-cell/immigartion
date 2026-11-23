import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Briefcase, FileText, Upload, CheckCircle2, XCircle, Clock, MessageSquarePlus,
  CalendarDays, CheckSquare, ArrowRight, Download, Eye, Sparkles, Trash2, AlertCircle, User, Timer,
} from 'lucide-react';
import { api, downloadFile } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Button, Badge, EmptyState, ErrorState, PageSkeleton, Tabs, Modal, Textarea, Select, Input,
  Avatar, Progress, Spinner,
} from '../../components/ui';
import { CaseStatus, Priority, DocStatus, TaskStatus } from '../../components/domain/StatusBadge';
import { CASE_STATUSES, VISA_CATEGORIES, DOC_CATEGORIES, DOC_STATUSES, labelFor, countryName, countryChip, APPOINTMENT_TYPES } from '../../lib/constants';
import { date, dateTime, timeAgo, relativeDays, fileSize } from '../../lib/format';

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [tab, setTab] = useState('overview');
  const [statusModal, setStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', note: '', clientVisible: true, completionReason: '' });
  const [noteForm, setNoteForm] = useState({ title: '', description: '', visibility: 'INTERNAL' });
  const [noteOpen, setNoteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadChecklist, setUploadChecklist] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  const { data: c, isLoading, isError, error, refetch } = useQuery({ queryKey: ['case', id], queryFn: () => api.get(`/cases/${id}`) });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['case', id] }); qc.invalidateQueries({ queryKey: ['cases'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const changeStatus = useMutation({
    mutationFn: (payload) => api.patch(`/cases/${id}/status`, payload),
    onSuccess: () => { toast.success('Case status updated'); invalidate(); setStatusModal(false); },
    onError: (e) => toast.error('Status change failed', e.message),
  });

  const addNote = useMutation({
    mutationFn: () => api.post(`/cases/${id}/timeline`, noteForm),
    onSuccess: () => { toast.success(noteForm.visibility === 'CLIENT' ? 'Client update posted' : 'Internal note added'); invalidate(); setNoteOpen(false); setNoteForm({ title: '', description: '', visibility: 'INTERNAL' }); },
    onError: (e) => toast.error('Could not add note', e.message),
  });

  const updateChecklist = useMutation({
    mutationFn: ({ key, patch }) => api.patch(`/cases/${id}/checklist/${key}`, patch),
    onSuccess: () => { invalidate(); toast.success('Checklist updated'); },
    onError: (e) => toast.error('Update failed', e.message),
  });

  const summarize = async () => {
    setAiBusy(true);
    try {
      const res = await api.post('/ai/summarize-case', { caseId: id });
      setAiSummary(res);
    } catch (e) { toast.error('AI summary unavailable', e.message); } finally { setAiBusy(false); }
  };

  const doUpload = async () => {
    if (!uploadFile) { toast.error('Choose a file first'); return; }
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('name', uploadChecklist?.label || uploadFile.name);
    fd.append('category', uploadChecklist?.category || 'OTHER');
    fd.append('caseId', id);
    if (uploadChecklist?.key) fd.append('checklistKey', uploadChecklist.key);
    setUploadBusy(true);
    try {
      await api.upload('/documents', fd);
      toast.success('Document uploaded');
      invalidate(); qc.invalidateQueries({ queryKey: ['documents'] });
      setUploadOpen(false); setUploadFile(null); setUploadChecklist(null);
    } catch (e) { toast.error('Upload failed', e.message); } finally { setUploadBusy(false); }
  };

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const checklist = c.documentChecklist || [];
  const required = checklist.filter((i) => i.required);
  const done = required.filter((i) => ['VERIFIED', 'WAIVED'].includes(i.status));
  const pct = required.length ? Math.round((done.length / required.length) * 100) : 0;
  const deadlineDays = relativeDays(c.targetDeadline);
  const isTerminal = ['APPROVED', 'REFUSED', 'WITHDRAWN', 'CLOSED'].includes(c.status);
  const workflow = CASE_STATUSES;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'checklist', label: 'Checklist', count: `${done.length}/${required.length}` },
    { key: 'timeline', label: 'Timeline', count: c.timeline?.length || 0 },
    { key: 'documents', label: 'Documents', count: c.documents?.length || 0 },
    { key: 'tasks', label: 'Tasks', count: c.tasks?.length || 0 },
    { key: 'appointments', label: 'Appointments', count: c.appointments?.length || 0 },
  ];

  return (
    <div className="page-enter">
      <button onClick={() => navigate('/app/cases')} className="mb-3 flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"><ArrowLeft size={13} /> Back to cases</button>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[19px] font-extrabold tracking-tight text-ink">{c.title}</h1>
            <CaseStatus status={c.status} /><Priority value={c.priority} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
            <span className="font-ui text-ink-faint">{c.reference}</span>
            {c.clientId && <Link to={`/app/clients/${c.clientId._id}`} className="flex items-center gap-1 font-medium text-ink hover:text-brand-700"><User size={12} />{c.clientId.firstName} {c.clientId.lastName}</Link>}
            <span className="flex items-center gap-1">{countryChip(c.destinationCountry)} {countryName(c.destinationCountry)}</span>
            <span>{labelFor(VISA_CATEGORIES, c.visaCategory)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('ai.use') && <Button size="sm" variant="secondary" icon={Sparkles} loading={aiBusy} onClick={summarize}>AI brief</Button>}
          {can('documents.upload') && <Button size="sm" variant="secondary" icon={Upload} onClick={() => { setUploadChecklist(null); setUploadOpen(true); }}>Upload</Button>}
          {can('cases.workflow') && !isTerminal && <Button size="sm" icon={ArrowRight} onClick={() => { setStatusForm({ ...statusForm, status: workflow.find((s) => s.key !== c.status)?.key || '' }); setStatusModal(true); }}>Change status</Button>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Documents verified</p>
          <div className="mt-1 flex items-baseline gap-1.5"><span className="font-ui text-lg font-bold text-ink">{done.length}</span><span className="text-2xs text-ink-faint">of {required.length} required</span></div>
          <Progress value={pct} tone={pct === 100 ? 'success' : 'brand'} className="mt-1.5" />
        </div>
        <div className="card p-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Target deadline</p>
          <p className="mt-1 font-ui text-lg font-bold text-ink">{c.targetDeadline ? date(c.targetDeadline) : '—'}</p>
          {c.targetDeadline && !isTerminal && <p className={`text-2xs ${deadlineDays < 0 ? 'text-red-600' : deadlineDays <= 14 ? 'text-amber-700' : 'text-ink-faint'}`}>{deadlineDays < 0 ? `${Math.abs(deadlineDays)} days overdue` : `${deadlineDays} days remaining`}</p>}
        </div>
        <div className="card p-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Consultant</p>
          <p className="mt-1 text-xs font-semibold text-ink">{c.consultantId?.name || 'Unassigned'}</p>
          <p className="text-2xs text-ink-faint">{c.caseManagerId ? `Manager: ${c.caseManagerId.name}` : 'No case manager'}</p>
        </div>
        <div className="card p-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Opened</p>
          <p className="mt-1 font-ui text-lg font-bold text-ink">{date(c.createdAt)}</p>
          <p className="text-2xs text-ink-faint">Updated {timeAgo(c.statusChangedAt || c.updatedAt)}</p>
        </div>
      </div>

      {aiSummary && (
        <div className="mt-4 rounded-card border border-brand-200 bg-brand-25 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2"><Sparkles size={15} className="text-brand-700" /><h3 className="text-xs font-bold text-brand-900">AI case brief</h3><Badge tone="warning" size="sm">Verify before use</Badge></div>
            <button onClick={() => setAiSummary(null)} className="text-2xs text-brand-700 hover:text-brand-900">Hide</button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink">{aiSummary.summary}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {[['Highlights', aiSummary.highlights], ['Pending actions', aiSummary.pendingActions], ['Missing documents', aiSummary.missingDocuments]].map(([label, items]) => (
              <div key={label}>
                <p className="text-2xs font-bold uppercase tracking-wide text-brand-800">{label}</p>
                <ul className="mt-1 space-y-0.5">{items?.length ? items.map((i, idx) => <li key={idx} className="text-2xs text-ink-soft">• {i}</li>) : <li className="text-2xs text-ink-faint">None</li>}</ul>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-brand-700">{aiSummary.disclaimer}</p>
        </div>
      )}

      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-3">
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="border-0" />
        </div>
        <div className="p-4">
          {tab === 'overview' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold text-ink">Case details</h3>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                  {[['Application date', c.applicationDate ? date(c.applicationDate) : '—'], ['Target deadline', c.targetDeadline ? date(c.targetDeadline) : '—'],
                    ['Priority', c.priority], ['Status', labelFor(CASE_STATUSES, c.status)],
                    ['Consultant', c.consultantId?.name || '—'], ['Case manager', c.caseManagerId?.name || '—'],
                    ['Agreed fee', c.fees?.agreedAmount ? `${c.fees.currency} ${c.fees.agreedAmount.toLocaleString()}` : '—'], ['Checklist template', c.checklistTemplateId ? 'Applied' : 'Auto-generated']].map(([k, v]) => (
                    <div key={k}><dt className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{k}</dt><dd className="mt-0.5 text-xs text-ink">{v}</dd></div>
                  ))}
                </dl>
                {c.clientVisibleNotes && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5"><p className="text-2xs font-semibold uppercase tracking-wide text-emerald-800">Client-visible notes</p><p className="mt-1 whitespace-pre-wrap text-xs text-emerald-900">{c.clientVisibleNotes}</p></div>}
              </div>
              <div>
                <div className="flex items-center justify-between"><h3 className="text-xs font-bold text-ink">Internal notes</h3><Badge tone="muted" size="sm">Staff only</Badge></div>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-canvas p-3 text-xs leading-relaxed text-ink-soft min-h-[80px]">{c.internalNotes || 'No internal notes. These are never shown in the client portal.'}</p>
                <div className="mt-3">
                  <h3 className="mb-1.5 text-xs font-bold text-ink">Workflow progress</h3>
                  <div className="space-y-1">
                    {CASE_STATUSES.filter((s) => s.key !== 'WITHDRAWN').map((s) => {
                      const idx = CASE_STATUSES.findIndex((x) => x.key === c.status);
                      const thisIdx = CASE_STATUSES.findIndex((x) => x.key === s.key);
                      const passed = thisIdx < idx;
                      const current = s.key === c.status;
                      return (
                        <div key={s.key} className="flex items-center gap-2">
                          <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] ${current ? 'bg-brand-600 text-white' : passed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {passed ? '✓' : current ? '●' : ''}
                          </span>
                          <span className={`text-2xs ${current ? 'font-bold text-ink' : passed ? 'text-ink-soft' : 'text-ink-faint'}`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'checklist' && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-ink-soft">{done.length} of {required.length} required documents verified · {pct}% complete</p>
              </div>
              {checklist.length === 0 ? <EmptyState icon={FileText} title="No checklist" description="This case has no document requirements yet." />
                : <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full">
                    <thead><tr className="border-b border-line bg-slate-50">
                      <th className="table-th">Document</th><th className="table-th">Category</th><th className="table-th">Required</th><th className="table-th">Status</th><th className="table-th text-right">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-line">
                      {checklist.map((item) => (
                        <tr key={item.key}>
                          <td className="table-td py-2.5"><p className="text-xs font-semibold text-ink">{item.label}</p>{item.comments && <p className="text-2xs text-ink-faint">{item.comments}</p>}</td>
                          <td className="table-td py-2.5"><span className="text-2xs text-ink-soft">{labelFor(DOC_CATEGORIES, item.category)}</span></td>
                          <td className="table-td py-2.5">{item.required ? <Badge tone="info" size="sm">Required</Badge> : <Badge tone="muted" size="sm">Optional</Badge>}</td>
                          <td className="table-td py-2.5"><DocStatus status={item.status} size="sm" /></td>
                          <td className="table-td py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {can('documents.upload') && <Button size="xs" variant="ghost" icon={Upload} onClick={() => { setUploadChecklist(item); setUploadOpen(true); }}>{item.status === 'REQUIRED' ? 'Upload' : 'Replace'}</Button>}
                              {can('documents.verify') && item.status === 'UPLOADED' && <Button size="xs" variant="ghost" icon={CheckCircle2} onClick={() => updateChecklist.mutate({ key: item.key, patch: { status: 'VERIFIED' } })}>Verify</Button>}
                              {can('documents.verify') && item.status === 'UPLOADED' && <Button size="xs" variant="ghost" icon={XCircle} className="text-red-600" onClick={() => updateChecklist.mutate({ key: item.key, patch: { status: 'REJECTED', comments: 'Rejected — please re-upload a clear copy.' } })}>Reject</Button>}
                              {can('cases.update') && item.required && item.status === 'REQUIRED' && <button title="Waive requirement" onClick={() => updateChecklist.mutate({ key: item.key, patch: { status: 'WAIVED' } })} className="rounded p-1 text-2xs text-ink-faint hover:bg-slate-100">Waive</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
            </>
          )}

          {tab === 'timeline' && (
            <>
              <div className="mb-3 flex justify-end">{can('cases.update') && <Button size="sm" icon={MessageSquarePlus} onClick={() => setNoteOpen(true)}>Add update</Button>}</div>
              {!c.timeline?.length ? <EmptyState icon={Clock} title="No activity yet" description="Status changes, documents and notes appear here." />
                : <div className="relative space-y-0 pl-5">
                  <span className="absolute bottom-2 left-[5px] top-2 w-px bg-line" />
                  {c.timeline.map((t) => (
                    <div key={t._id} className="relative pb-4 last:pb-0">
                      <span className={`absolute -left-5 top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-2 ring-white ${t.visibility === 'CLIENT' ? 'bg-emerald-500' : 'bg-brand-500'}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-ink">{t.title}</p>
                        <Badge tone={t.visibility === 'CLIENT' ? 'success' : 'muted'} size="sm">{t.visibility === 'CLIENT' ? 'Client visible' : 'Internal'}</Badge>
                      </div>
                      {t.description && <p className="mt-0.5 whitespace-pre-wrap text-2xs leading-relaxed text-ink-soft">{t.description}</p>}
                      <p className="mt-0.5 text-2xs text-ink-faint">{t.actorName} · {timeAgo(t.createdAt)} · {String(t.type).replace(/_/g, ' ').toLowerCase()}</p>
                    </div>
                  ))}
                </div>}
            </>
          )}

          {tab === 'documents' && (
            !c.documents?.length ? <EmptyState icon={FileText} title="No documents" description="Upload documents against checklist items."
              action={can('documents.upload') ? <Button size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>Upload document</Button> : null} />
              : <div className="divide-y divide-line">
                {c.documents.map((d) => {
                  const v = d.versions?.[d.versions.length - 1];
                  return (
                    <div key={d._id} className="flex items-center gap-3 py-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-ink-faint"><FileText size={15} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink">{d.name}</p>
                        <p className="text-2xs text-ink-faint">{v ? `${v.fileName} · ${fileSize(v.size)}` : 'No file'} · v{d.currentVersion} · {date(d.createdAt)}</p>
                      </div>
                      <DocStatus status={d.status} size="sm" />
                      {can('documents.view') && v && <button onClick={async () => { try { const r = await api.get(`/documents/${d._id}/download`); window.open(r.url, '_blank', 'noopener'); } catch (e) { toast.error('Download failed', e.message); } }} className="rounded p-1.5 text-ink-faint hover:bg-slate-100" title="Download"><Download size={13} /></button>}
                      {can('documents.verify') && d.status !== 'VERIFIED' && <Button size="xs" variant="ghost" icon={CheckCircle2} onClick={() => api.patch(`/documents/${d._id}/status`, { status: 'VERIFIED' }).then(() => { toast.success('Document verified'); invalidate(); })}>Verify</Button>}
                    </div>
                  );
                })}
              </div>
          )}

          {tab === 'tasks' && (
            !c.tasks?.length ? <EmptyState icon={CheckSquare} title="No tasks" description="Link tasks to this case from the Tasks page."
              action={<Link to={`/app/tasks?new=1&caseId=${c._id}`}><Button size="sm" variant="secondary">Create task</Button></Link>} />
              : <div className="divide-y divide-line">
                {c.tasks.map((t) => (
                  <div key={t._id} className="flex items-center gap-3 py-2.5">
                    <CheckSquare size={14} className={t.status === 'COMPLETED' ? 'text-emerald-600' : 'text-ink-faint'} />
                    <div className="min-w-0 flex-1"><p className="text-xs font-medium text-ink">{t.title}</p><p className="text-2xs text-ink-faint">{t.assignedToId?.name || 'Unassigned'} · due {t.dueAt ? date(t.dueAt) : '—'}</p></div>
                    <TaskStatus status={t.status} />
                  </div>
                ))}
              </div>
          )}

          {tab === 'appointments' && (
            !c.appointments?.length ? <EmptyState icon={CalendarDays} title="No appointments" description="Book a consultation linked to this case."
              action={<Link to={`/app/appointments?new=1&caseId=${c._id}`}><Button size="sm" variant="secondary">Book appointment</Button></Link>} />
              : <div className="divide-y divide-line">
                {c.appointments.map((a) => (
                  <div key={a._id} className="flex items-center gap-3 py-2.5">
                    <CalendarDays size={14} className="text-ink-faint" />
                    <div className="min-w-0 flex-1"><p className="text-xs font-medium text-ink">{a.title || a.type.replace(/_/g, ' ')}</p><p className="text-2xs text-ink-faint">{dateTime(a.startAt)} · {a.consultantId?.name || ''}</p></div>
                    <Badge tone={a.status === 'COMPLETED' ? 'success' : 'info'} size="sm">{a.status}</Badge>
                  </div>
                ))}
              </div>
          )}
        </div>
      </div>

      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Change case status" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setStatusModal(false)}>Cancel</Button><Button size="sm" loading={changeStatus.isPending} disabled={!statusForm.status} onClick={() => changeStatus.mutate(statusForm)}>Update status</Button></>}>
        <div className="space-y-3">
          <Select label="New status" value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
            {workflow.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
          <Textarea label="Note (added to timeline)" rows={2} value={statusForm.note} onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })} placeholder="Why is the status changing?" />
          {['APPROVED', 'REFUSED', 'CLOSED', 'WITHDRAWN'].includes(statusForm.status) && (
            <Input label="Completion reason" value={statusForm.completionReason} onChange={(e) => setStatusForm({ ...statusForm, completionReason: e.target.value })} hint="Recorded on the case for reporting." />
          )}
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={statusForm.clientVisible} onChange={(e) => setStatusForm({ ...statusForm, clientVisible: e.target.checked })} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
            Show this status change in the client portal timeline
          </label>
          <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-2xs text-amber-800">Statuses reflect your team's manual decisions only. ImmigrationFlow never sets Approved or Refused automatically.</p>
        </div>
      </Modal>

      <Modal open={noteOpen} onClose={() => setNoteOpen(false)} title="Add case update" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button><Button size="sm" loading={addNote.isPending} disabled={!noteForm.title.trim()} onClick={() => addNote.mutate()}>Post</Button></>}>
        <div className="space-y-3">
          <Input label="Title" required value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="e.g. Documents requested from client" />
          <Textarea label="Details" rows={3} value={noteForm.description} onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })} />
          <Select label="Visibility" value={noteForm.visibility} onChange={(e) => setNoteForm({ ...noteForm, visibility: e.target.value })}>
            <option value="INTERNAL">Internal only</option><option value="CLIENT">Visible to client in portal</option>
          </Select>
        </div>
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title={uploadChecklist ? `Upload: ${uploadChecklist.label}` : 'Upload document'} size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setUploadOpen(false)}>Cancel</Button><Button size="sm" loading={uploadBusy} onClick={doUpload}>Upload</Button></>}>
        <div className="space-y-3">
          <div onClick={() => fileRef.current?.click()} className="cursor-pointer rounded-lg border-2 border-dashed border-line p-6 text-center transition hover:border-brand-400 hover:bg-brand-25/30">
            <Upload size={18} className="mx-auto text-ink-faint" />
            <p className="mt-2 text-xs font-semibold text-ink">{uploadFile ? uploadFile.name : 'Click to choose a file'}</p>
            <p className="mt-0.5 text-2xs text-ink-faint">PDF, JPG, PNG, WEBP, TIFF, DOC, DOCX — max 20 MB</p>
          </div>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff,.doc,.docx"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
          {uploadFile && <p className="text-2xs text-ink-faint">{fileSize(uploadFile.size)} · {uploadFile.type || 'unknown type'}</p>}
          {!uploadChecklist && <p className="rounded-lg bg-canvas p-2.5 text-2xs text-ink-soft">Uploading without selecting a checklist item creates a standalone document on this case.</p>}
        </div>
      </Modal>
    </div>
  );
}
