import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Users, Briefcase, TrendingUp, Ban, CheckCircle2, Save, Globe2, Mail, Phone, Calendar } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Input, Select, Modal, Textarea, ErrorState, Spinner, Tabs } from '../../components/ui';
import { date, money, timeAgo } from '../../lib/format';

export default function AdminOrganizationDetail() {
  const { id } = useParams();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [subForm, setSubForm] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'org', id], queryFn: () => api.get(`/admin/organizations/${id}`) });

  const setStatus = useMutation({
    mutationFn: (payload) => api.patch(`/admin/organizations/${id}`, payload),
    onSuccess: () => { toast.success('Organization updated'); qc.invalidateQueries({ queryKey: ['admin'] }); setSuspendOpen(false); },
    onError: (e) => toast.error('Update failed', e.message),
  });
  const setSub = useMutation({
    mutationFn: (payload) => api.patch(`/admin/subscriptions/${id}`, payload),
    onSuccess: () => { toast.success('Subscription updated'); qc.invalidateQueries({ queryKey: ['admin'] }); setSubForm(null); },
    onError: (e) => toast.error('Update failed', e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { organization: org, subscription: sub, members, usage } = data;

  return (
    <div className="page-enter">
      <Link to="/admin/organizations" className="mb-3 inline-flex items-center gap-1 text-2xs font-medium text-ink-soft hover:text-ink"><ArrowLeft size={11} />All organizations</Link>
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white">{org.name?.[0]?.toUpperCase()}</span>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-ink">{org.name}</h1>
              <p className="text-2xs text-ink-faint">{org.slug} · created {date(org.createdAt)}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Badge tone={org.status === 'ACTIVE' ? 'success' : org.status === 'SUSPENDED' ? 'danger' : org.status === 'TRIAL' ? 'info' : 'warning'} size="sm" dot>{org.status.toLowerCase()}</Badge>
                <Badge tone="muted" size="sm">{org.businessType}</Badge>
                <Badge tone="muted" size="sm">{sub?.plan?.toLowerCase() || 'no plan'} · {sub?.status?.toLowerCase()}</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {['ACTIVE', 'TRIAL'].includes(org.status)
              ? <Button size="sm" variant="danger-outline" icon={Ban} onClick={() => setSuspendOpen(true)}>Suspend tenant</Button>
              : <Button size="sm" variant="secondary" icon={CheckCircle2} loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'ACTIVE' })}>Reactivate</Button>}
          </div>
        </div>
        {org.status === 'SUSPENDED' && org.suspendedReason && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-2xs text-red-800"><strong>Suspended:</strong> {org.suspendedReason}</div>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Mini icon={Users} label="Team members" value={members.length} />
        <Mini icon={Briefcase} label="Cases" value={usage.cases} />
        <Mini icon={TrendingUp} label="Leads" value={usage.leads} />
        <Mini icon={TrendingUp} label="Collected revenue" value={money(usage.revenue, org.settings?.currency || 'INR')} />
      </div>

      <div className="mt-4 card overflow-hidden">
        <Tabs tabs={[{ key: 'overview', label: 'Overview' }, { key: 'members', label: 'Members', count: members.length }, { key: 'subscription', label: 'Subscription' }]} value={tab} onChange={setTab} className="px-3 pt-1" />
        <div className="p-4">
          {tab === 'overview' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-ink">Contact</h3>
                <Detail icon={Mail} label="Email" value={org.email} />
                <Detail icon={Phone} label="Phone" value={org.phone || '—'} />
                <Detail icon={Globe2} label="Website" value={org.website || '—'} />
                <Detail icon={Calendar} label="Timezone" value={org.settings?.timezone || '—'} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-ink">Business</h3>
                <Detail icon={Building2} label="Type" value={org.businessType} />
                <Detail icon={Globe2} label="Location" value={[org.settings?.city, org.settings?.state, org.settings?.country].filter(Boolean).join(', ') || '—'} />
                <Detail icon={TrendingUp} label="Currency" value={org.settings?.currency || 'INR'} />
                <Detail icon={Calendar} label="Trial ends" value={sub?.trialEndsAt ? date(sub.trialEndsAt) : '—'} />
              </div>
            </div>
          )}
          {tab === 'members' && (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full"><thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Name</th><th className="table-th">Email</th><th className="table-th">Role</th><th className="table-th">Status</th></tr></thead>
                <tbody className="divide-y divide-line">{members.map((m) => (
                  <tr key={m.id}><td className="table-td text-xs font-medium">{m.name}</td><td className="table-td text-2xs text-ink-soft">{m.email}</td>
                    <td className="table-td"><Badge tone={m.role === 'OWNER' ? 'info' : 'muted'} size="sm">{m.roleLabel}</Badge></td>
                    <td className="table-td"><Badge tone={m.status === 'ACTIVE' ? 'success' : 'muted'} size="sm">{m.status.toLowerCase()}</Badge></td></tr>
                ))}</tbody></table>
            </div>
          )}
          {tab === 'subscription' && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Dialog label="Plan" value={sub?.plan} /><Dialog label="Status" value={sub?.status} /><Dialog label="Cycle" value={sub?.billingCycle} />
                <Dialog label="Period end" value={sub?.currentPeriodEnd ? date(sub.currentPeriodEnd) : '—'} />
                <Dialog label="Trial ends" value={sub?.trialEndsAt ? date(sub.trialEndsAt) : '—'} />
                <Dialog label="Provider" value={sub?.provider} />
              </div>
              <Button size="sm" variant="secondary" onClick={() => setSubForm({ plan: sub?.plan, status: sub?.status })}>Adjust subscription</Button>
              <p className="text-2xs text-ink-faint">Manual adjustments are for support cases only and are written to the platform audit trail. Normal plan changes should come through provider webhooks.</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={suspendOpen} onClose={() => setSuspendOpen(false)} title="Suspend organization" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setSuspendOpen(false)}>Cancel</Button><Button variant="danger" size="sm" loading={setStatus.isPending} disabled={reason.trim().length < 5} onClick={() => setStatus.mutate({ status: 'SUSPENDED', suspendedReason: reason })}>Suspend tenant</Button></>}>
        <p className="text-xs text-ink-soft">Suspending blocks all staff sign-ins and API access for this tenant. Data is retained. The organization owner will see a suspended notice.</p>
        <Textarea label="Reason (stored on the org record)" className="mt-3" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Unpaid invoices, policy violation…" />
      </Modal>

      <Modal open={Boolean(subForm)} onClose={() => setSubForm(null)} title="Adjust subscription" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setSubForm(null)}>Cancel</Button><Button size="sm" loading={setSub.isPending} onClick={() => setSub.mutate(subForm)}>Save</Button></>}>
        <div className="space-y-3">
          <Select label="Plan" value={subForm?.plan} onChange={(e) => setSubForm({ ...subForm, plan: e.target.value })}>
            {['STARTER', 'PROFESSIONAL', 'BUSINESS'].map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
          </Select>
          <Select label="Status" value={subForm?.status} onChange={(e) => setSubForm({ ...subForm, status: e.target.value })}>
            {['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'PAUSED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  );
}

function Mini({ icon: Icon, label, value }) {
  return <div className="card flex items-center gap-2.5 p-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-ink-soft"><Icon size={14} /></span><div><p className="text-2xs text-ink-faint">{label}</p><p className="font-ui text-sm font-bold text-ink">{value}</p></div></div>;
}
function Detail({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5"><Icon size={12} className="text-ink-faint" /><span className="text-2xs text-ink-faint">{label}</span><span className="ml-auto truncate text-2xs font-medium text-ink">{value}</span></div>;
}
function Dialog({ label, value }) {
  return <div className="rounded-lg bg-canvas p-2.5"><p className="text-2xs text-ink-faint">{label}</p><p className="text-xs font-semibold text-ink">{value || '—'}</p></div>;
}
