import { useState, useEffect } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Users, Shield, Workflow, FileText, Mail, MessageCircle, Sparkles, CreditCard,
  Globe2, Bell, Lock, ChevronRight, Save, Plus, Trash2, CheckCircle2, AlertTriangle, ScrollText, User,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import { Button, Input, Select, Textarea, Badge, EmptyState, ErrorState, Spinner, Modal, Checkbox, Avatar, Tabs } from '../../components/ui';
import { ORG_BUSINESS_TYPES, ORG_TIMEZONES, CASE_STATUSES, DOC_CATEGORIES, labelFor } from '../../lib/constants';
import { date, timeAgo } from '../../lib/format';

const SECTIONS = [
  { key: 'organization', label: 'Organization', icon: Building2, perm: 'settings.view' },
  { key: 'profile', label: 'My profile', icon: User, perm: null },
  { key: 'workflow', label: 'Case workflow', icon: Workflow, perm: 'settings.view' },
  { key: 'checklists', label: 'Document templates', icon: FileText, perm: 'documents.view' },
  { key: 'templates', label: 'Email templates', icon: Mail, perm: 'communications.view' },
  { key: 'integrations', label: 'Integrations', icon: MessageCircle, perm: 'settings.view' },
  { key: 'roles', label: 'Roles & permissions', icon: Shield, perm: 'roles.manage' },
  { key: 'notifications', label: 'Notifications', icon: Bell, perm: 'settings.view' },
  { key: 'security', label: 'Security', icon: Lock, perm: null },
  { key: 'audit', label: 'Audit logs', icon: ScrollText, perm: 'audit.view' },
];

export default function Settings() {
  const { section } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const active = section || 'organization';
  const visible = SECTIONS.filter((s) => !s.perm || can(s.perm) || s.perm === null);

  useEffect(() => { if (!section) navigate('/app/settings/organization', { replace: true }); }, [section, navigate]);

  return (
    <div className="page-enter">
      <PageHeader title="Settings" description="Organization profile, workflows, integrations and security." />
      <div className="grid gap-4 lg:grid-cols-[210px_1fr]">
        <nav className="card h-fit p-1.5" aria-label="Settings sections">
          {visible.map((s) => (
            <NavLink key={s.key} to={`/app/settings/${s.key}`}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition ${isActive ? 'bg-navy text-white' : 'text-ink-soft hover:bg-slate-50 hover:text-ink'}`}>
              <s.icon size={14} />{s.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          {active === 'organization' && <OrgSection />}
          {active === 'profile' && <ProfileSection />}
          {active === 'workflow' && <WorkflowSection />}
          {active === 'checklists' && <ChecklistsSection />}
          {active === 'templates' && <TemplatesSection />}
          {active === 'integrations' && <IntegrationsSection />}
          {active === 'roles' && <RolesSection />}
          {active === 'notifications' && <NotificationsSection />}
          {active === 'security' && <SecuritySection />}
          {active === 'audit' && <AuditSection />}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, description, children, footer }) {
  return (
    <div className="card">
      <div className="border-b border-line px-4 py-3"><h2 className="text-sm font-bold text-ink">{title}</h2>{description && <p className="mt-0.5 text-2xs text-ink-soft">{description}</p>}</div>
      <div className="p-4">{children}</div>
      {footer && <div className="flex justify-end border-t border-line bg-slate-50/60 px-4 py-2.5">{footer}</div>}
    </div>
  );
}

function OrgSection() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: org, isLoading, isError, error, refetch } = useQuery({ queryKey: ['organization'], queryFn: () => api.get('/organization') });
  const [form, setForm] = useState(null);

  useEffect(() => { if (org) setForm({ name: org.name, businessType: org.businessType, email: org.email, phone: org.phone || '', website: org.website || '', registrationNumber: org.registrationNumber || '', ...org.settings }); }, [org]);

  const save = useMutation({
    mutationFn: () => api.patch('/organization', {
      name: form.name, businessType: form.businessType, email: form.email, phone: form.phone, website: form.website, registrationNumber: form.registrationNumber,
      settings: { timezone: form.timezone, currency: form.currency, addressLine1: form.addressLine1, addressLine2: form.addressLine2, city: form.city, state: form.state, postalCode: form.postalCode, country: form.country, taxName: form.taxName, taxRate: Number(form.taxRate), taxNumber: form.taxNumber, invoicePrefix: form.invoicePrefix, invoiceTerms: form.invoiceTerms },
    }),
    onSuccess: () => { toast.success('Organization updated'); qc.invalidateQueries({ queryKey: ['organization'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); },
    onError: (e) => toast.error('Could not save', e.message),
  });

  if (isLoading || !form) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;
  const set = (k, v) => setForm({ ...form, [k]: v });
  const disabled = !can('settings.manage');

  return (
    <div className="space-y-4">
      <SectionCard title="Business details" description="Shown on invoices and the client portal." footer={!disabled && <Button size="sm" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>}>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Input label="Organization name" value={form.name} onChange={(e) => set('name', e.target.value)} disabled={disabled} />
          <Select label="Business type" value={form.businessType} onChange={(e) => set('businessType', e.target.value)} disabled={disabled}>
            {ORG_BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Input label="Business email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={disabled} />
          <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} disabled={disabled} />
          <Input label="Website" value={form.website} onChange={(e) => set('website', e.target.value)} disabled={disabled} />
          <Input label="Registration number" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} disabled={disabled} />
        </div>
      </SectionCard>

      <SectionCard title="Location & currency" description="Used across scheduling, invoicing and reporting." footer={!disabled && <Button size="sm" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>}>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Select label="Timezone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} disabled={disabled}>
            {ORG_TIMEZONES.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Select label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} disabled={disabled}>
            {['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'].map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Input label="Address line 1" value={form.addressLine1 || ''} onChange={(e) => set('addressLine1', e.target.value)} disabled={disabled} className="sm:col-span-2" />
          <Input label="Address line 2" value={form.addressLine2 || ''} onChange={(e) => set('addressLine2', e.target.value)} disabled={disabled} className="sm:col-span-2" />
          <Input label="City" value={form.city || ''} onChange={(e) => set('city', e.target.value)} disabled={disabled} />
          <Input label="State" value={form.state || ''} onChange={(e) => set('state', e.target.value)} disabled={disabled} />
          <Input label="Postal code" value={form.postalCode || ''} onChange={(e) => set('postalCode', e.target.value)} disabled={disabled} />
          <Select label="Country" value={form.country || 'IN'} onChange={(e) => set('country', e.target.value)} disabled={disabled}>
            {[['IN', 'India'], ['AU', 'Australia'], ['NZ', 'New Zealand'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['US', 'United States'], ['AE', 'UAE'], ['SG', 'Singapore'], ['OTHER', 'Other']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </div>
      </SectionCard>

      <SectionCard title="Invoicing defaults" description="Applied to new invoices; each invoice can override." footer={!disabled && <Button size="sm" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>}>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Input label="Tax label" value={form.taxName} onChange={(e) => set('taxName', e.target.value)} disabled={disabled} />
          <Input label="Default tax rate (%)" type="number" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} disabled={disabled} />
          <Input label="Tax number" value={form.taxNumber || ''} onChange={(e) => set('taxNumber', e.target.value)} disabled={disabled} />
          <Input label="Invoice prefix" value={form.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value)} disabled={disabled} />
          <Textarea label="Invoice terms" value={form.invoiceTerms} onChange={(e) => set('invoiceTerms', e.target.value)} rows={2} className="sm:col-span-2" disabled={disabled} />
        </div>
      </SectionCard>
    </div>
  );
}

function ProfileSection() {
  const { user, refreshMe } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user?.name || '', phone: '', timezone: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try { await api.patch('/auth/profile', form); await refreshMe(); toast.success('Profile updated'); }
    catch (e) { toast.error('Could not save', e.message); } finally { setSaving(false); }
  };
  const changePassword = async () => {
    if (pw.newPassword !== pw.confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try { await api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }); setPw({ currentPassword: '', newPassword: '', confirm: '' }); toast.success('Password changed'); }
    catch (e) { toast.error('Could not change password', e.message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Your profile" footer={<Button size="sm" icon={Save} loading={saving} onClick={saveProfile}>Save</Button>}>
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={user?.name} size="lg" />
          <div><p className="text-sm font-bold text-ink">{user?.name}</p><p className="text-xs text-ink-soft">{user?.email}</p>
            <div className="mt-1 flex gap-1"><Badge tone="info" size="sm">{user?.membership?.roleLabel}</Badge>{user?.emailVerified && <Badge tone="success" size="sm">Email verified</Badge>}</div></div>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" />
        </div>
        <p className="mt-3 text-2xs text-ink-faint">Email addresses cannot be changed directly — contact your organization owner or support.</p>
      </SectionCard>
      <SectionCard title="Change password" footer={<Button size="sm" icon={Lock} loading={saving} disabled={!pw.currentPassword || pw.newPassword.length < 8} onClick={changePassword}>Update password</Button>}>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Input label="Current password" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <Input label="New password" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="Min 8 chars with a number." />
          <Input label="Confirm password" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        </div>
      </SectionCard>
      <SectionCard title="Email verification">
        <div className="flex items-center justify-between">
          <div><p className="text-xs text-ink-soft">{user?.emailVerified ? 'Your email is verified.' : 'Verify your email to secure account recovery.'}</p></div>
          {!user?.emailVerified && <Button size="sm" variant="secondary" onClick={async () => { try { const r = await api.post('/auth/resend-verification', {}); toast.success(r.message, r.emailSent === false ? 'Ask admin to configure SMTP.' : undefined); } catch (e) { toast.error('Failed', e.message); } }}>Resend verification</Button>}
        </div>
      </SectionCard>
    </div>
  );
}

function WorkflowSection() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: workflow, isLoading } = useQuery({ queryKey: ['workflow'], queryFn: () => api.get('/organization/workflow') });
  const [statuses, setStatuses] = useState(null);

  useEffect(() => { if (workflow) setStatuses(workflow.map((s, i) => ({ key: s.key || s.status, label: s.label, order: i + 1, active: s.active !== false, terminal: Boolean(s.terminal) }))); }, [workflow]);

  const save = useMutation({
    mutationFn: () => api.put('/organization/workflow', { statuses: statuses.map((s, i) => ({ ...s, order: i + 1 })) }),
    onSuccess: () => { toast.success('Workflow saved'); qc.invalidateQueries({ queryKey: ['workflow'] }); qc.invalidateQueries({ queryKey: ['cases'] }); },
    onError: (e) => toast.error('Could not save workflow', e.message),
  });

  if (isLoading || !statuses) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <SectionCard title="Case workflow" description="Reorder stages and toggle which are active. The terminal statuses Approved, Refused and Closed are always retained for reporting."
      footer={can('settings.manage') && <Button size="sm" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save workflow</Button>}>
      <div className="space-y-1.5">
        {statuses.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 rounded-lg border border-line p-2">
            <span className="w-5 text-center font-ui text-2xs font-bold text-ink-faint">{i + 1}</span>
            <input value={s.label} onChange={(e) => { const n = [...statuses]; n[i] = { ...s, label: e.target.value }; setStatuses(n); }} className="input-base h-8 flex-1 text-xs" disabled={!can('settings.manage')} />
            <Badge tone={s.terminal ? 'success' : 'muted'} size="sm">{s.terminal ? 'Terminal' : 'In progress'}</Badge>
            <Checkbox label="Active" checked={s.active} disabled={!can('settings.manage') || s.terminal} onChange={(e) => { const n = [...statuses]; n[i] = { ...s, active: e.target.checked }; setStatuses(n); }} />
            <div className="flex gap-0.5">
              <button disabled={i === 0} onClick={() => { const n = [...statuses]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setStatuses(n); }} className="rounded p-1 text-ink-faint hover:bg-slate-100 disabled:opacity-30">↑</button>
              <button disabled={i === statuses.length - 1} onClick={() => { const n = [...statuses]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setStatuses(n); }} className="rounded p-1 text-ink-faint hover:bg-slate-100 disabled:opacity-30">↓</button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function ChecklistsSection() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['checklists'], queryFn: () => api.get('/documents/checklists/list') });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', visaCategory: 'ALL', isDefault: false, items: [{ key: 'passport', label: 'Passport bio page', category: 'PASSPORT', required: true }] });

  const save = useMutation({
    mutationFn: () => api.post('/documents/checklists', { ...form, items: form.items.map((i) => ({ ...i, key: i.key || i.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60) })) }),
    onSuccess: () => { toast.success('Checklist created'); qc.invalidateQueries({ queryKey: ['checklists'] }); setOpen(false); setForm({ name: '', visaCategory: 'ALL', isDefault: false, items: [{ key: 'passport', label: 'Passport bio page', category: 'PASSPORT', required: true }] }); },
    onError: (e) => toast.error('Could not create', e.message),
  });
  const remove = useMutation({ mutationFn: (id) => api.del(`/documents/checklists/${id}`), onSuccess: () => { toast.success('Checklist removed'); qc.invalidateQueries({ queryKey: ['checklists'] }); } });

  return (
    <>
      <SectionCard title="Document checklist templates" description="Applied automatically when creating a case of the matching visa category."
        footer={can('documents.templates') && <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>New checklist</Button>}>
        {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : !data?.data?.length ? (
          <EmptyState icon={FileText} title="No custom checklists" description="Cases fall back to a default 5-item checklist. Create templates per visa category for precision."
            action={can('documents.templates') ? <Button size="sm" onClick={() => setOpen(true)}>Create checklist</Button> : null} />
        ) : (
          <div className="space-y-2">
            {data.data.map((c) => (
              <div key={c._id} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5"><p className="text-xs font-bold text-ink">{c.name}</p>{c.isDefault && <Badge tone="success" size="sm">Default</Badge>}</div>
                    <p className="mt-0.5 text-2xs text-ink-faint">{c.visaCategory === 'ALL' ? 'All categories' : c.visaCategory.replace(/_/g, ' ').toLowerCase()} · {c.items.length} items</p>
                  </div>
                  {can('documents.templates') && <button onClick={() => remove.mutate(c._id)} className="rounded p-1 text-ink-faint hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">{c.items.slice(0, 6).map((i, k) => <Badge key={k} tone="muted" size="sm">{i.label}</Badge>)}{c.items.length > 6 && <Badge tone="muted" size="sm">+{c.items.length - 6}</Badge>}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      <Modal open={open} onClose={() => setOpen(false)} title="New checklist template" size="md"
        footer={<><Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" loading={save.isPending} disabled={!form.name.trim() || form.items.length === 0} onClick={() => save.mutate()}>Create checklist</Button></>}>
        <div className="space-y-3">
          <Input label="Template name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Canada PR — Express Entry" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Visa category" value={form.visaCategory} onChange={(e) => setForm({ ...form, visaCategory: e.target.value })}>
              <option value="ALL">All categories</option>
              {['STUDENT_VISA', 'WORK_VISA', 'VISITOR_VISA', 'PERMANENT_RESIDENCY', 'SKILLED_MIGRATION', 'FAMILY_SPONSORSHIP', 'BUSINESS_IMMIGRATION', 'CITIZENSHIP', 'OTHER'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ').toLowerCase()}</option>)}
            </Select>
            <div className="flex items-end pb-2"><Checkbox label="Set as default for category" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /></div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><p className="text-xs font-semibold text-ink">Items</p>
              <Button size="xs" variant="ghost" icon={Plus} onClick={() => setForm({ ...form, items: [...form.items, { key: '', label: '', category: 'OTHER', required: true }] })}>Add item</Button></div>
            <div className="space-y-1.5">
              {form.items.map((it, i) => (
                <div key={i} className="flex gap-1.5">
                  <input value={it.label} onChange={(e) => { const n = [...form.items]; n[i] = { ...it, label: e.target.value }; setForm({ ...form, items: n }); }} placeholder="Document label" className="input-base flex-1 text-xs" />
                  <select value={it.category} onChange={(e) => { const n = [...form.items]; n[i] = { ...it, category: e.target.value }; setForm({ ...form, items: n }); }} className="input-base w-36 text-xs">
                    {DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-2xs text-ink-soft"><input type="checkbox" checked={it.required} onChange={(e) => { const n = [...form.items]; n[i] = { ...it, required: e.target.checked }; setForm({ ...form, items: n }); }} className="h-3.5 w-3.5 rounded" />Req</label>
                  <button onClick={() => setForm({ ...form, items: form.items.filter((_, x) => x !== i) })} className="rounded p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function TemplatesSection() {
  return <div className="card p-0"><div className="p-3 text-xs text-ink-soft">Email and WhatsApp templates live in <a href="/app/communications" className="font-semibold text-brand-700">Communications → Templates</a> where you can also preview them with variable substitution.</div></div>;
}

function IntegrationsSection() {
  const { data, isLoading } = useQuery({ queryKey: ['integrations'], queryFn: () => api.get('/organization/integrations') });
  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  const items = [
    { name: 'Email (SMTP)', ok: data?.email?.configured, detail: data?.email?.configured ? `Sending from ${data.email.from}` : 'Not configured — emails are saved but not delivered.', icon: Mail },
    { name: 'WhatsApp Cloud API', ok: data?.whatsapp?.configured, detail: data?.whatsapp?.configured ? `Connected (${data.whatsapp.phoneNumberId})` : 'Not connected — WhatsApp messages are saved as FAILED with the reason.', icon: MessageCircle },
    { name: 'AI provider', ok: data?.ai?.configured, detail: data?.ai?.configured ? `${data.ai.provider} · ${data.ai.model}` : 'No API key on server. All non-AI workflows remain available.', icon: Sparkles },
    { name: 'Stripe', ok: data?.payments?.stripe, detail: data?.payments?.stripe ? 'Configured' : 'Not configured — subscription checkout disabled.', icon: CreditCard },
    { name: 'Razorpay', ok: data?.payments?.razorpay, detail: data?.payments?.razorpay ? 'Configured' : 'Not configured — subscription checkout disabled.', icon: CreditCard },
    { name: 'Document storage', ok: true, detail: `${data?.storage?.driver === 's3' ? 'S3-compatible private bucket' : 'Private local disk'} · signed short-lived URLs`, icon: Lock },
  ];
  return (
    <SectionCard title="Integrations" description="All credentials live in server environment variables and are never exposed to the browser.">
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.name} className="flex items-start gap-3 rounded-lg border border-line p-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${i.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-ink-faint'}`}><i.icon size={15} /></span>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-xs font-bold text-ink">{i.name}</p><Badge tone={i.ok ? 'success' : 'muted'} size="sm">{i.ok ? 'Connected' : 'Not configured'}</Badge></div>
              <p className="mt-0.5 text-2xs text-ink-soft">{i.detail}</p></div>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-canvas p-2.5 text-2xs text-ink-soft">{data?.note}</p>
    </SectionCard>
  );
}

function RolesSection() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/organization/roles') });
  const [edits, setEdits] = useState({});
  const [activeRole, setActiveRole] = useState('CONSULTANT');
  const role = data?.roles?.find((r) => r.role === activeRole);

  const save = useMutation({
    mutationFn: () => api.put(`/organization/roles/${activeRole}`, edits[activeRole] || { grants: [], revokes: [] }),
    onSuccess: () => { toast.success('Permissions updated'); qc.invalidateQueries({ queryKey: ['roles'] }); },
    onError: (e) => toast.error('Could not save', e.message),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  const ALL_PERMS = ['leads.view', 'leads.create', 'leads.update', 'leads.delete', 'clients.view', 'clients.create', 'clients.update', 'clients.sensitive', 'cases.view', 'cases.create', 'cases.update', 'cases.workflow', 'documents.view', 'documents.upload', 'documents.verify', 'documents.delete', 'appointments.view', 'appointments.manage', 'tasks.view', 'tasks.create', 'tasks.update', 'invoices.view', 'invoices.create', 'payments.record', 'communications.view', 'communications.send', 'reports.view', 'reports.export', 'ai.use', 'team.manage', 'audit.view', 'settings.manage', 'billing.view'];
  const current = edits[activeRole] || { grants: role?.overrides?.grants || [], revokes: role?.overrides?.revokes || [] };
  const effective = new Set(role?.effective || []);

  const toggle = (perm, on) => {
    const base = role?.base || [];
    const next = { grants: [...current.grants], revokes: [...current.revokes] };
    if (on) { next.revokes = next.revokes.filter((p) => p !== perm); if (!base.includes(perm)) next.grants.push(perm); }
    else { next.grants = next.grants.filter((p) => p !== perm); if (base.includes(perm)) next.revokes.push(perm); }
    setEdits({ ...edits, [activeRole]: next });
  };

  return (
    <div className="space-y-4">
      <div className="card p-1.5">
        <div className="flex flex-wrap gap-1">
          {(data?.roles || []).map((r) => (
            <button key={r.role} onClick={() => setActiveRole(r.role)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${activeRole === r.role ? 'bg-navy text-white' : 'text-ink-soft hover:bg-slate-50'}`}>{r.label}</button>
          ))}
        </div>
      </div>
      <SectionCard title={`${role?.label} permissions`} description="Grant or revoke individual permissions. Owner permissions are fixed. Billing management remains owner-only."
        footer={<Button size="sm" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save permissions</Button>}>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ALL_PERMS.map((p) => {
            const checked = effective.has(p);
            return (
              <label key={p} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-2xs">
                <span className="font-medium text-ink-soft">{p}</span>
                <input type="checkbox" checked={checked} onChange={(e) => toggle(p, e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
              </label>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function NotificationsSection() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: org } = useQuery({ queryKey: ['organization'], queryFn: () => api.get('/organization') });
  const [prefs, setPrefs] = useState(null);
  useEffect(() => { if (org) setPrefs(org.settings?.notifications || {}); }, [org]);
  const save = useMutation({
    mutationFn: () => api.patch('/organization', { settings: { notifications: prefs } }),
    onSuccess: () => { toast.success('Notification preferences saved'); qc.invalidateQueries({ queryKey: ['organization'] }); },
    onError: (e) => toast.error('Could not save', e.message),
  });
  if (!prefs) return <div className="flex justify-center py-16"><Spinner /></div>;
  const options = [['emailOnNewLead', 'Email me when a new lead is created'], ['emailOnNewClient', 'Email me when a client is created'], ['dailyDigest', 'Send a daily summary of overdue tasks and deadlines'], ['appointmentReminders', 'Appointment reminders for consultants'], ['invoiceReminders', 'Invoice payment reminders']];
  return (
    <SectionCard title="Notification preferences" description="In-app notifications are always delivered. Email requires SMTP to be configured." footer={can('settings.manage') && <Button size="sm" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save preferences</Button>}>
      <div className="space-y-2">
        {options.map(([k, label]) => (
          <div key={k} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
            <span className="text-xs text-ink">{label}</span>
            <input type="checkbox" checked={Boolean(prefs[k])} disabled={!can('settings.manage')} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SecuritySection() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <SectionCard title="Session security">
        <div className="space-y-2 text-xs text-ink-soft">
          <p className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-600" /> Access tokens expire after 15 minutes and refresh via HttpOnly, SameSite=Strict cookies.</p>
          <p className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-600" /> Passwords hashed with bcrypt (cost 12). Repeated failures lock the account for 15 minutes.</p>
          <p className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-600" /> All API requests are rate limited and validated with schema checks.</p>
          <p className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-600" /> Sensitive passport fields are encrypted with AES-256-GCM and hidden from list responses.</p>
          <p className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-600" /> Cross-organization access returns 404 — isolation is enforced server-side on every query.</p>
        </div>
      </SectionCard>
      <SectionCard title="Your session">
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg bg-canvas p-2.5"><p className="text-2xs text-ink-faint">Role</p><p className="font-semibold text-ink">{user?.membership?.roleLabel}</p></div>
          <div className="rounded-lg bg-canvas p-2.5"><p className="text-2xs text-ink-faint">Email verified</p><p className="font-semibold text-ink">{user?.emailVerified ? 'Yes' : 'No'}</p></div>
          <div className="rounded-lg bg-canvas p-2.5"><p className="text-2xs text-ink-faint">Organization</p><p className="font-semibold text-ink">{user?.organization?.name}</p></div>
        </div>
      </SectionCard>
    </div>
  );
}

function AuditSection() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['audit', page, action], queryFn: () => api.get(`/organization/audit-logs?page=${page}&limit=25${action ? `&action=${action}` : ''}`) });
  const ACTIONS = ['auth', 'lead', 'client', 'case', 'document', 'invoice', 'payment', 'task', 'appointment', 'team', 'roles', 'workflow', 'organization', 'ai', 'portal', 'report', 'subscription', 'billing'];
  return (
    <SectionCard title="Audit logs" description="Immutable record of security-relevant events in your organization.">
      <Tabs tabs={[{ key: '', label: 'All' }, ...ACTIONS.slice(0, 8).map((a) => ({ key: a, label: a }))]} value={action} onChange={setAction} className="mb-3" />
      {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : !data?.data?.length ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="Actions will be recorded here as your team works." />
      ) : (
        <>
          <div className="overflow-x-auto overflow-hidden rounded-lg border border-line">
            <table className="w-full">
              <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Action</th><th className="table-th">Actor</th><th className="table-th">Description</th><th className="table-th">When</th><th className="table-th">IP</th></tr></thead>
              <tbody className="divide-y divide-line">
                {data.data.map((l) => (
                  <tr key={l._id}><td className="table-td py-1.5"><code className="rounded bg-slate-100 px-1 py-0.5 font-ui text-[10px] text-ink-soft">{l.action}</code></td>
                    <td className="table-td py-1.5 text-2xs">{l.actorName || '—'}<p className="text-ink-faint">{l.actorRole}</p></td>
                    <td className="table-td py-1.5 text-2xs text-ink-soft">{l.description}</td>
                    <td className="table-td py-1.5 whitespace-nowrap text-2xs text-ink-soft">{date(l.createdAt, { time: true })}</td>
                    <td className="table-td py-1.5 font-ui text-2xs text-ink-faint">{l.ip || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex justify-between text-2xs text-ink-soft">
            <span>Page {data.meta.page} of {data.meta.pages} · {data.meta.total} entries</span>
            <div className="flex gap-1"><Button size="xs" variant="secondary" disabled={!data.meta.hasPrev} onClick={() => setPage(page - 1)}>Prev</Button><Button size="xs" variant="secondary" disabled={!data.meta.hasNext} onClick={() => setPage(page + 1)}>Next</Button></div>
          </div>
        </>
      )}
    </SectionCard>
  );
}
