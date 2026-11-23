import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Shield, Mail, MoreHorizontal, UserX, UserCheck, Users, KeyRound, Copy } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import { Button, Avatar, Badge, Modal, Input, Select, EmptyState, ErrorState, TableSkeleton, Tabs } from '../../components/ui';
import { date, timeAgo } from '../../lib/format';

const ROLE_DESC = {
  ADMIN: 'Full access except billing changes', CONSULTANT: 'Leads, clients, cases, documents, appointments',
  CASE_MANAGER: 'Cases, documents, tasks, appointments', ACCOUNTANT: 'Invoices, payments, reports', VIEWER: 'Read-only access to records',
};

export default function Team() {
  const { can, user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('active');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'CONSULTANT', title: '' });
  const [inviteResult, setInviteResult] = useState(null);
  const [editMember, setEditMember] = useState(null);
  const [editForm, setEditForm] = useState({ role: '', title: '' });

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['team', tab], queryFn: () => api.get(`/organization/team?limit=100${tab === 'active' ? '&status=ACTIVE' : tab === 'invited' ? '&status=INVITED' : ''}`) });

  const sendInvite = useMutation({
    mutationFn: () => api.post('/organization/team/invite', invite),
    onSuccess: (res) => {
      setInviteResult(res); qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('Invitation sent', res.emailSent ? 'They will receive an email.' : 'Email not configured — share the credentials manually.');
      setInviteOpen(false); setInvite({ name: '', email: '', role: 'CONSULTANT', title: '' });
    },
    onError: (e) => toast.error('Could not invite', e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/organization/team/${id}`, payload),
    onSuccess: () => { toast.success('Team member updated'); qc.invalidateQueries({ queryKey: ['team'] }); setEditMember(null); },
    onError: (e) => toast.error('Update failed', e.message),
  });

  const members = data?.data || [];

  return (
    <div className="page-enter">
      <PageHeader title="Team" description="Invite colleagues, assign roles and control what each person can access."
        actions={can('team.manage') && <Button size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>Invite member</Button>} />

      <div className="card overflow-hidden">
        <Tabs tabs={[{ key: 'active', label: 'Active' }, { key: 'invited', label: 'Invited' }, { key: 'all', label: 'All' }]} value={tab} onChange={setTab} className="px-3 pt-1" />
        {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : isLoading ? <TableSkeleton rows={4} cols={4} /> : members.length === 0 ? (
          <EmptyState icon={Users} title="No team members" description="Invite a colleague to collaborate on leads and cases." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line bg-slate-50/70">
                <th className="table-th">Member</th><th className="table-th">Role</th><th className="table-th">Status</th><th className="table-th">Last active</th><th className="table-th">Joined</th><th className="table-th"></th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50/60">
                    <td className="table-td">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.user.name} size="sm" />
                        <div><p className="text-xs font-semibold text-ink">{m.user.name}{m.user.id === user?.id && <span className="ml-1.5 text-2xs text-ink-faint">(you)</span>}</p>
                          <p className="text-2xs text-ink-faint">{m.user.email}</p></div>
                      </div>
                    </td>
                    <td className="table-td"><div><p className="text-xs font-medium text-ink">{m.roleLabel}</p>{m.title && <p className="text-2xs text-ink-faint">{m.title}</p>}</div></td>
                    <td className="table-td"><Badge tone={m.status === 'ACTIVE' ? 'success' : m.status === 'INVITED' ? 'warning' : 'muted'} dot size="sm">{m.status.toLowerCase()}</Badge></td>
                    <td className="table-td"><span className="text-2xs text-ink-soft">{m.user.lastLoginAt ? timeAgo(m.user.lastLoginAt) : 'Never'}</span></td>
                    <td className="table-td"><span className="text-2xs text-ink-soft">{date(m.createdAt)}</span></td>
                    <td className="table-td">
                      {can('team.manage') && m.role !== 'OWNER' && m.user.id !== user?.id && (
                        <div className="flex justify-end gap-1">
                          <Button size="xs" variant="ghost" onClick={() => { setEditMember(m); setEditForm({ role: m.role, title: m.title || '' }); }}>Manage</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(ROLE_DESC).map(([role, desc]) => (
          <div key={role} className="rounded-lg border border-line bg-white p-3">
            <div className="flex items-center gap-1.5"><Shield size={13} className="text-brand-700" /><p className="text-xs font-bold text-ink">{role.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</p></div>
            <p className="mt-1 text-2xs leading-relaxed text-ink-soft">{desc}</p>
          </div>
        ))}
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite team member" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setInviteOpen(false)}>Cancel</Button><Button size="sm" loading={sendInvite.isPending} disabled={!invite.email.includes('@') || invite.name.length < 2} onClick={() => sendInvite.mutate()}>Send invitation</Button></>}>
        <div className="space-y-3">
          <Input label="Full name" required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
          <Input label="Work email" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          <Select label="Role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
            {Object.keys(ROLE_DESC).map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} — {ROLE_DESC[r]}</option>)}
          </Select>
          <Input label="Job title (optional)" value={invite.title} onChange={(e) => setInvite({ ...invite, title: e.target.value })} placeholder="Senior Consultant" />
        </div>
      </Modal>

      <Modal open={Boolean(inviteResult)} onClose={() => setInviteResult(null)} title="Invitation created" size="sm"
        footer={<Button size="sm" onClick={() => setInviteResult(null)}>Done</Button>}>
        <div className="space-y-2">
          <div className={`rounded-lg p-3 text-xs ${inviteResult?.emailSent ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
            {inviteResult?.emailSent ? 'Invitation email sent. They can accept it from their inbox.' : 'Email is not configured on this server. Share the invite link and temporary password with your colleague securely.'}
          </div>
          {inviteResult?.temporaryPassword && (
            <div className="space-y-1.5 rounded-lg border border-line bg-canvas p-3 font-mono text-2xs">
              <p><span className="text-ink-faint">Password:</span> {inviteResult.temporaryPassword}</p>
              {inviteResult.inviteUrl && <p className="break-all"><span className="text-ink-faint">Link:</span> {inviteResult.inviteUrl}</p>}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={Boolean(editMember)} onClose={() => setEditMember(null)} title="Manage team member" size="sm"
        description={editMember?.user?.name}
        footer={<><Button variant="secondary" size="sm" onClick={() => setEditMember(null)}>Cancel</Button>
          <Button size="sm" loading={update.isPending} onClick={() => update.mutate({ id: editMember._id, payload: editForm })}>Save changes</Button></>}>
        <div className="space-y-3">
          <Select label="Role" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
            {Object.keys(ROLE_DESC).map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</option>)}
          </Select>
          <Input label="Job title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
          <div className="rounded-lg border border-line p-2.5">
            <p className="text-2xs font-semibold text-ink">Account access</p>
            <p className="mt-0.5 text-2xs text-ink-soft">Deactivating blocks sign-in immediately. Historical records remain attributed to this member.</p>
            <div className="mt-2 flex gap-1.5">
              {editMember?.status === 'ACTIVE'
                ? <Button size="xs" variant="danger-outline" icon={UserX} onClick={() => update.mutate({ id: editMember._id, payload: { status: 'DISABLED' } })}>Deactivate</Button>
                : <Button size="xs" variant="secondary" icon={UserCheck} onClick={() => update.mutate({ id: editMember._id, payload: { status: 'ACTIVE' } })}>Reactivate</Button>}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
