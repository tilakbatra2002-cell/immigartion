import { useQuery } from '@tanstack/react-query';
import { Server, Database, HardDrive, Mail, MessageCircle, Sparkles, CreditCard, ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, ErrorState, PageSkeleton, Button } from '../../components/ui';

export default function AdminSettings() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin', 'system'], queryFn: () => api.get('/admin/system') });
  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const integrations = [
    { key: 'email', label: 'SMTP email', icon: Mail, ok: data.integrations.email, note: 'Invitations, verification, invoice emails and reminders. Without it, emails are logged as not sent.' },
    { key: 'whatsapp', label: 'WhatsApp Cloud API', icon: MessageCircle, ok: data.integrations.whatsapp, note: 'Outbound WhatsApp messages. Without it, WhatsApp sends are recorded as FAILED with an explicit reason.' },
    { key: 'ai', label: 'AI provider', icon: Sparkles, ok: data.integrations.ai, note: 'Drafting and summarisation tools. All manual workflows work without it.' },
    { key: 'stripe', label: 'Stripe', icon: CreditCard, ok: data.integrations.stripe, note: 'International subscription billing + signed webhooks.' },
    { key: 'razorpay', label: 'Razorpay', icon: CreditCard, ok: data.integrations.razorpay, note: 'India subscription billing + signed webhooks.' },
    { key: 's3', label: 'S3-compatible storage', icon: HardDrive, ok: data.integrations.s3, note: `Currently using ${data.storageDriver === 's3' ? 'S3-compatible private bucket' : 'local private disk'} with short-lived signed URLs.` },
  ];

  return (
    <div className="page-enter">
      <div className="mb-4"><h1 className="text-lg font-extrabold tracking-tight text-ink">Platform settings</h1><p className="mt-0.5 text-xs text-ink-soft">Read-only view of server configuration. Secrets are never sent to the browser — only whether each integration is configured.</p></div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink"><Server size={14} />Runtime</h2>
          <div className="mt-2 space-y-1.5 text-xs">
            <Row k="Environment" v={data.environment} />
            <Row k="Node version" v={data.nodeVersion} />
            <Row k="Database" v={data.database} ok={data.database === 'connected'} />
            <Row k="Storage driver" v={data.storageDriver} />
            <Row k="Process uptime" v={`${Math.floor(data.uptimeSeconds / 60)} min ${data.uptimeSeconds % 60}s`} />
            <Row k="Email verification required" v={data.emailVerificationRequired ? 'Yes' : 'No'} />
          </div>
          <Button size="xs" variant="secondary" className="mt-3" onClick={() => refetch()}>Refresh status</Button>
        </div>
        <div className="card p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink"><ShieldCheck size={14} />Security posture</h2>
          <ul className="mt-2 space-y-1.5 text-2xs text-ink-soft">
            <li>• JWT access tokens (15 min) + rotating refresh tokens in HttpOnly cookies</li>
            <li>• Tenant isolation enforced in every Mongoose query via organizationId scope</li>
            <li>• Passport/identity fields AES-256-GCM encrypted; never in list responses or logs</li>
            <li>• File downloads use short-lived signed URLs, not public buckets</li>
            <li>• Webhooks require provider signature verification (raw body HMAC)</li>
            <li>• Rate limiting on auth, API and export endpoints</li>
            <li>• Every admin action is written to the audit trail with actor and IP</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 card overflow-hidden">
        <div className="border-b border-line px-4 py-3"><h2 className="text-sm font-bold text-ink">Integrations</h2><p className="mt-0.5 text-2xs text-ink-soft">Configured via server environment variables. See the deployment guide for exact keys.</p></div>
        <div className="divide-y divide-line">
          {integrations.map((i) => (
            <div key={i.key} className="flex items-start gap-3 px-4 py-2.5">
              <i.icon size={14} className="mt-0.5 text-ink-faint" />
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-xs font-semibold text-ink">{i.label}</p><Badge tone={i.ok ? 'success' : 'muted'} size="sm">{i.ok ? 'Configured' : 'Not configured'}</Badge></div>
                <p className="mt-0.5 text-2xs text-ink-soft">{i.note}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 p-3">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-2xs leading-relaxed text-amber-900">Integrations are toggled by changing server environment variables and restarting the API. There is deliberately no UI to enter API keys, so keys cannot leak through the browser or logs. In production, set the <code className="rounded bg-amber-100 px-1">REQUIRE_EMAIL_VERIFICATION=true</code> and <code className="rounded bg-amber-100 px-1">NODE_ENV=production</code> flags.</p>
      </div>
    </div>
  );
}

function Row({ k, v, ok }) {
  return <div className="flex items-center justify-between border-b border-line pb-1"><span className="text-2xs text-ink-soft">{k}</span><span className={`text-2xs font-semibold ${ok === false ? 'text-red-600' : ok ? 'text-emerald-600' : 'text-ink'}`}>{v}</span></div>;
}
