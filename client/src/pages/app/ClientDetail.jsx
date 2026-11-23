import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, Phone, MapPin, Users, Briefcase, FileText, Receipt, CalendarDays,
  UserPlus, KeyRound, ShieldCheck, ShieldOff, Edit3, Eye, EyeOff, Trash2, ArrowRight, Clock,
} from 'lucide-react';
import { api, downloadFile } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, EmptyState, ErrorState, PageSkeleton, Tabs, Modal, Input, Select, Avatar } from '../../components/ui';
import ConfirmDialog from '../../components/domain/ConfirmDialog';
import { CaseStatus, DocStatus, InvoiceStatus } from '../../components/domain/StatusBadge';
import { countryName, VISA_CATEGORIES, labelFor, COUNTRIES } from '../../lib/constants';
import { date, money, timeAgo } from '../../lib/format';
import ClientForm from './ClientForm';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [showPassport, setShowPassport] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [family, setFamily] = useState({ name: '', relationship: 'SPOUSE', dateOfBirth: '', gender: '', nationality: '', dependent: true });
  const [portalModal, setPortalModal] = useState(null);
  const [revokePortal, setRevokePortal] = useState(false);

  const { data: c, isLoading, isError, error, refetch } = useQuery({ queryKey: ['client', id], queryFn: () => api.get(`/clients/${id}`) });
  const teamQuery = useQuery({ queryKey: ['team', 'lite'], queryFn: () => api.get('/organization/team?limit=100'), select: (d) => d.data });

  const save = useMutation({
    mutationFn: (payload) => api.patch(`/clients/${id}`, payload),
    onSuccess: () => { toast.success('Client updated'); qc.invalidateQueries({ queryKey: ['client', id] }); setEditOpen(false); },
    onError: (e) => toast.error('Update failed', e.message),
  });
  const addFamily = useMutation({
    mutationFn: () => api.post(`/clients/${id}/family`, family),
    onSuccess: () => { toast.success('Family member added'); qc.invalidateQueries({ queryKey: ['client', id] }); setFamilyOpen(false); setFamily({ name: '', relationship: 'SPOUSE', dateOfBirth: '', gender: '', nationality: '', dependent: true }); },
    onError: (e) => toast.error('Could not add family member', e.message),
  });
  const removeFamily = useMutation({
    mutationFn: (memberId) => api.del(`/clients/${id}/family/${memberId}`),
    onSuccess: () => { toast.success('Family member removed'); qc.invalidateQueries({ queryKey: ['client', id] }); },
  });
  const enablePortal = useMutation({
    mutationFn: () => api.post(`/clients/${id}/portal-access`, {}),
    onSuccess: (res) => { setPortalModal(res); qc.invalidateQueries({ queryKey: ['client', id] }); },
    onError: (e) => toast.error('Could not enable portal', e.message),
  });
  const disablePortal = useMutation({
    mutationFn: () => api.del(`/clients/${id}/portal-access`),
    onSuccess: () => { toast.success('Portal access revoked'); qc.invalidateQueries({ queryKey: ['client', id] }); setRevokePortal(false); },
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'cases', label: 'Cases', count: c.cases?.length || 0 },
    { key: 'documents', label: 'Documents', count: c.documents?.length || 0 },
    { key: 'invoices', label: 'Invoices', count: c.invoices?.length || 0 },
    { key: 'family', label: 'Family', count: c.family?.length || 0 },
    { key: 'appointments', label: 'Appointments', count: c.appointments?.length || 0 },
  ];

  return (
    <div className="page-enter">
      <button onClick={() => navigate('/app/clients')} className="mb-3 flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"><ArrowLeft size={13} /> Back to clients</button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Avatar name={`${c.firstName} ${c.lastName || ''}`} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[19px] font-extrabold tracking-tight text-ink">{c.firstName} {c.lastName}</h1>
              <Badge tone="neutral">{c.reference}</Badge>
              <Badge tone={c.status === 'ACTIVE' ? 'success' : 'muted'} dot>{c.status}</Badge>
              {c.type === 'FAMILY' && <Badge tone="violet">Family</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-ink"><Mail size={12} />{c.email}</a>}
              {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-ink"><Phone size={12} />{c.phone}</a>}
              {c.currentCountry && <span className="flex items-center gap-1"><MapPin size={12} />{countryName(c.currentCountry)}</span>}
            </div>
            {c.assignedConsultantId && <p className="mt-1 text-2xs text-ink-faint">Consultant: {c.assignedConsultantId.name}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('cases.create') && <Link to={`/app/cases?new=1&clientId=${c._id}`}><Button size="sm" variant="secondary" icon={Briefcase}>New case</Button></Link>}
          {can('clients.update') && <Button size="sm" variant="secondary" icon={Edit3} onClick={() => setEditOpen(true)}>Edit</Button>}
          {can('clients.update') && (c.portalAccess?.enabled
            ? <Button size="sm" variant="secondary" icon={ShieldOff} onClick={() => setRevokePortal(true)}>Revoke portal</Button>
            : <Button size="sm" icon={KeyRound} loading={enablePortal.isPending} onClick={() => enablePortal.mutate()}>Enable portal</Button>)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Active cases', c.cases?.filter((x) => !['APPROVED', 'REFUSED', 'WITHDRAWN', 'CLOSED'].includes(x.status)).length || 0],
          ['Documents', c.documents?.length || 0],
          ['Outstanding', money(c.invoices?.reduce((s, i) => s + (i.balance || 0), 0) || 0, c.invoices?.[0]?.currency || 'INR', true)],
          ['Portal', c.portalAccess?.enabled ? 'Enabled' : 'Disabled']].map(([k, v]) => (
          <div key={k} className="card p-3"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{k}</p><p className="mt-0.5 font-ui text-lg font-bold text-ink">{v}</p></div>
        ))}
      </div>

      <div className="mt-4 card overflow-hidden">
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="px-3 pt-1" />
        <div className="p-4">
          {tab === 'overview' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold text-ink">Personal details</h3>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                  {[['Date of birth', c.dateOfBirth ? date(c.dateOfBirth) : '—'], ['Gender', c.gender ? c.gender.toLowerCase() : '—'],
                    ['Nationality', c.nationality || '—'], ['City', c.city || '—'],
                    ['Preferred destination', countryName(c.preferredDestination)], ['Added', date(c.createdAt)]].map(([k, v]) => (
                    <div key={k}><dt className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{k}</dt><dd className="mt-0.5 text-xs text-ink">{v}</dd></div>
                  ))}
                </dl>
                {c.notes && <div className="mt-3 rounded-lg bg-canvas p-2.5"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Notes</p><p className="mt-1 whitespace-pre-wrap text-xs text-ink">{c.notes}</p></div>}
              </div>
              <div>
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  Identity document
                  <span className="rounded bg-amber-50 px-1 py-px text-[9px] font-semibold text-amber-700 ring-1 ring-amber-200">Encrypted at rest</span>
                </h3>
                {can('clients.sensitive') ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between rounded-lg border border-line p-2.5">
                      <div>
                        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Passport number</p>
                        <p className="mt-0.5 font-mono text-xs text-ink">{c.passportNumber ? (showPassport ? c.passportNumber : '••••••' + c.passportNumber.slice(-3)) : 'Not recorded'}</p>
                      </div>
                      {c.passportNumber && (
                        <button onClick={() => setShowPassport(!showPassport)} className="rounded p-1.5 text-ink-faint hover:bg-slate-100" aria-label={showPassport ? 'Hide' : 'Reveal'}>
                          {showPassport ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-line p-2.5"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Expiry</p><p className="mt-0.5 text-xs text-ink">{c.passportExpiry ? date(c.passportExpiry) : '—'}</p></div>
                      <div className="rounded-lg border border-line p-2.5"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Issued by</p><p className="mt-0.5 text-xs text-ink">{countryName(c.passportIssuingCountry)}</p></div>
                    </div>
                    <p className="flex items-center gap-1 text-2xs text-ink-faint"><ShieldCheck size={11} /> Viewing this record is audit-logged.</p>
                  </div>
                ) : <p className="mt-2 rounded-lg bg-canvas p-3 text-2xs text-ink-soft">Your role does not include access to passport data. Ask an owner or admin for the clients.sensitive permission.</p>}
              </div>
            </div>
          )}

          {tab === 'cases' && (
            !c.cases?.length ? <EmptyState icon={Briefcase} title="No cases yet" description="Create an immigration case for this client."
              action={can('cases.create') ? <Link to={`/app/cases?new=1&clientId=${c._id}`}><Button size="sm">New case</Button></Link> : null} />
              : <div className="divide-y divide-line">
                {c.cases.map((cs) => (
                  <Link key={cs._id} to={`/app/cases/${cs._id}`} className="flex items-center gap-3 py-2.5 transition hover:bg-slate-50">
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-ink">{cs.title}</p><p className="font-ui text-2xs text-ink-faint">{cs.reference} · {labelFor(VISA_CATEGORIES, cs.visaCategory)}</p></div>
                    <CaseStatus status={cs.status} size="sm" />
                    <ArrowRight size={13} className="text-ink-faint" />
                  </Link>
                ))}
              </div>
          )}

          {tab === 'documents' && (
            !c.documents?.length ? <EmptyState icon={FileText} title="No documents" description="Upload documents directly from a case." />
              : <div className="divide-y divide-line">
                {c.documents.map((d) => (
                  <div key={d._id} className="flex items-center gap-3 py-2.5">
                    <FileText size={15} className="text-ink-faint" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink">{d.name}</p><p className="text-2xs text-ink-faint">{String(d.category).replace(/_/g, ' ').toLowerCase()} · v{d.versions?.[d.versions.length - 1]?.version || 0} · {date(d.createdAt)}</p></div>
                    <DocStatus status={d.status} size="sm" />
                  </div>
                ))}
              </div>
          )}

          {tab === 'invoices' && (
            !c.invoices?.length ? <EmptyState icon={Receipt} title="No invoices" description="Create an invoice to bill this client." />
              : <div className="divide-y divide-line">
                {c.invoices.map((i) => (
                  <div key={i._id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1"><p className="font-ui text-xs font-semibold text-ink">{i.invoiceNumber}</p><p className="text-2xs text-ink-faint">{i.type} · due {i.dueDate ? date(i.dueDate) : '—'}</p></div>
                    <span className="text-xs font-semibold text-ink">{money(i.total, i.currency)}</span>
                    <InvoiceStatus status={i.status} />
                    <button onClick={() => downloadFile(`/invoices/${i._id}/pdf`, `${i.invoiceNumber}.pdf`)} className="rounded p-1.5 text-ink-faint hover:bg-slate-100" title="Download PDF"><FileText size={13} /></button>
                  </div>
                ))}
              </div>
          )}

          {tab === 'family' && (
            <>
              <div className="mb-3 flex justify-end">{can('clients.update') && <Button size="sm" icon={UserPlus} onClick={() => setFamilyOpen(true)}>Add family member</Button>}</div>
              {!c.family?.length ? <EmptyState icon={Users} title="No family members" description="Link spouses, children and dependants to this client record." />
                : <div className="divide-y divide-line">
                  {c.family.map((f) => (
                    <div key={f._id} className="flex items-center gap-3 py-2.5">
                      <Avatar name={f.name} size="sm" />
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-ink">{f.name}</p><p className="text-2xs text-ink-faint">{f.relationship.charAt(0) + f.relationship.slice(1).toLowerCase()}{f.dateOfBirth ? ` · ${date(f.dateOfBirth)}` : ''}{f.dependent ? ' · dependant' : ''}</p></div>
                      {can('clients.update') && <button onClick={() => removeFamily.mutate(f._id)} className="rounded p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600" aria-label="Remove"><Trash2 size={13} /></button>}
                    </div>
                  ))}
                </div>}
            </>
          )}

          {tab === 'appointments' && (
            !c.appointments?.length ? <EmptyState icon={CalendarDays} title="No appointments" description="Book a consultation for this client." />
              : <div className="divide-y divide-line">
                {c.appointments.map((a) => (
                  <div key={a._id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <span className="text-[8px] font-bold uppercase leading-none">{new Date(a.startAt).toLocaleString('en', { month: 'short' })}</span>
                      <span className="font-ui text-[11px] font-bold leading-tight">{new Date(a.startAt).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-ink">{a.title || a.type.replace(/_/g, ' ')}</p><p className="text-2xs text-ink-faint">{date(a.startAt, { time: true })} · {a.consultantId?.name || ''}</p></div>
                    <Badge tone={a.status === 'COMPLETED' ? 'success' : a.status === 'CANCELLED' ? 'danger' : 'info'} size="sm">{a.status}</Badge>
                  </div>
                ))}
              </div>
          )}
        </div>
      </div>

      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} client={c} team={teamQuery.data || []} saving={save.isPending} onSubmit={(p) => save.mutate(p)} canSensitive={can('clients.sensitive')} />

      <Modal open={familyOpen} onClose={() => setFamilyOpen(false)} title="Add family member" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setFamilyOpen(false)}>Cancel</Button><Button size="sm" loading={addFamily.isPending} disabled={!family.name.trim()} onClick={() => addFamily.mutate()}>Add member</Button></>}>
        <div className="space-y-3">
          <Input label="Full name" required value={family.name} onChange={(e) => setFamily({ ...family, name: e.target.value })} />
          <Select label="Relationship" value={family.relationship} onChange={(e) => setFamily({ ...family, relationship: e.target.value })}>
            {['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'].map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date of birth" type="date" value={family.dateOfBirth} onChange={(e) => setFamily({ ...family, dateOfBirth: e.target.value })} />
            <Select label="Gender" value={family.gender} onChange={(e) => setFamily({ ...family, gender: e.target.value })} placeholder="Select">
              <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
            </Select>
          </div>
          <Input label="Nationality" value={family.nationality} onChange={(e) => setFamily({ ...family, nationality: e.target.value })} />
        </div>
      </Modal>

      <Modal open={Boolean(portalModal)} onClose={() => setPortalModal(null)} title="Client portal access"
        description={portalModal?.emailSent ? 'Credentials have been emailed to your client.' : 'Email is not configured — share these credentials securely.'}
        footer={<Button size="sm" onClick={() => setPortalModal(null)}>Done</Button>}>
        {portalModal && (
          <div className="space-y-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{portalModal.message}</div>
            {portalModal.temporaryPassword && (
              <div className="rounded-lg border border-line bg-canvas p-3 font-mono text-xs">
                <p><span className="text-ink-faint">Email:</span> {c.email}</p>
                <p className="mt-1"><span className="text-ink-faint">Password:</span> {portalModal.temporaryPassword}</p>
                <p className="mt-1"><span className="text-ink-faint">Portal:</span> /portal/login</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={revokePortal} onClose={() => setRevokePortal(false)} onConfirm={() => disablePortal.mutate()} busy={disablePortal.isPending}
        title="Revoke portal access?" description="The client will no longer be able to sign in to the portal. Their data is retained." confirmLabel="Revoke access" />
    </div>
  );
}
