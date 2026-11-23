import { useQuery } from '@tanstack/react-query';
import { UserRound, Users, Mail, Phone, Globe2, ShieldCheck, KeyRound } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, PageSkeleton, ErrorState, Modal, Input } from '../../components/ui';
import { useState } from 'react';
import { date } from '../../lib/format';

export default function PortalProfile() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const me = useQuery({ queryKey: ['portal', 'me'], queryFn: () => api.get('/portal/me') });
  const family = useQuery({ queryKey: ['portal', 'family'], queryFn: () => api.get('/portal/family') });
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  if (me.isLoading) return <PageSkeleton />;
  if (me.isError) return <ErrorState message={me.error?.message} onRetry={me.refetch} />;
  const { client, organization } = me.data;

  const changePw = async () => {
    if (pw.newPassword !== pw.confirm) { toast.error('Passwords do not match'); return; }
    setBusy(true);
    try { await api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }); setPwOpen(false); setPw({ currentPassword: '', newPassword: '', confirm: '' }); toast.success('Password updated'); }
    catch (e) { toast.error('Could not update password', e.message); } finally { setBusy(false); }
  };

  return (
    <div className="page-enter space-y-4">
      <div><h1 className="text-lg font-extrabold tracking-tight text-ink">Profile</h1><p className="mt-0.5 text-xs text-ink-soft">Your details are managed by your consultancy. Ask your consultant to correct anything inaccurate.</p></div>

      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 font-ui text-sm font-bold text-brand-700">{(client.firstName || '?')[0]}{(client.lastName || '')[0]}</span>
            <div>
              <p className="text-sm font-bold text-ink">{client.firstName} {client.lastName}</p>
              <p className="text-2xs text-ink-faint">Client reference {client.reference}</p>
            </div>
          </div>
          <Badge tone="success" size="sm">Portal active</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line p-2.5"><p className="flex items-center gap-1 text-2xs text-ink-faint"><Mail size={10} />Email</p><p className="text-xs font-medium text-ink">{client.email || '—'}</p></div>
          <div className="rounded-lg border border-line p-2.5"><p className="flex items-center gap-1 text-2xs text-ink-faint"><Phone size={10} />Phone</p><p className="text-xs font-medium text-ink">{client.phone || '—'}</p></div>
          <div className="rounded-lg border border-line p-2.5"><p className="flex items-center gap-1 text-2xs text-ink-faint"><Globe2 size={10} />Consultancy</p><p className="text-xs font-medium text-ink">{organization?.name}</p>{organization?.website && <p className="text-2xs text-brand-700">{organization.website}</p>}</div>
          <div className="rounded-lg border border-line p-2.5"><p className="flex items-center gap-1 text-2xs text-ink-faint"><KeyRound size={10} />Portal account</p><p className="text-xs font-medium text-ink">{user?.email}</p><p className="text-2xs text-ink-faint">Password can be changed below.</p></div>
        </div>
        <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" icon={KeyRound} onClick={() => setPwOpen(true)}>Change password</Button></div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3"><h2 className="flex items-center gap-1.5 text-sm font-bold text-ink"><Users size={14} />Family members</h2><p className="mt-0.5 text-2xs text-ink-soft">Dependents linked to your application. Managed by your consultant.</p></div>
        {family.isLoading ? <div className="flex justify-center py-6"><PageSkeleton /></div> : !family.data?.data?.length ? <p className="px-4 py-4 text-2xs text-ink-soft">No family members on record.</p> : (
          <div className="divide-y divide-line">
            {family.data.data.map((f) => (
              <div key={f._id} className="flex items-center gap-2 px-4 py-2.5"><UserRound size={13} className="text-ink-faint" /><div className="min-w-0 flex-1"><p className="text-xs font-medium text-ink">{f.name}</p><p className="text-2xs text-ink-faint">{f.relationship}{f.dateOfBirth ? ` · born ${date(f.dateOfBirth)}` : ''}{f.nationality ? ` · ${f.nationality}` : ''}</p></div></div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-card border border-line bg-white p-3.5">
        <p className="flex items-center gap-1.5 text-2xs text-ink-soft"><ShieldCheck size={11} />Only you and your case team can see these details. Passport numbers are never displayed in the portal.</p>
        <button onClick={async () => { await logout(); window.location.href = '/portal/login'; }} className="mt-2 text-2xs font-semibold text-red-600">Sign out of the portal</button>
      </div>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change password" size="sm" footer={<><Button variant="secondary" size="sm" onClick={() => setPwOpen(false)}>Cancel</Button><Button size="sm" loading={busy} disabled={!pw.currentPassword || pw.newPassword.length < 8} onClick={changePw}>Update password</Button></>}>
        <div className="space-y-3">
          <Input label="Current password" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <Input label="New password" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="At least 8 characters, including a number." />
          <Input label="Confirm new password" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
