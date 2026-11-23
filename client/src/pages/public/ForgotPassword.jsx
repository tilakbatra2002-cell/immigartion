import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, ArrowLeft } from 'lucide-react';
import Logo from '../../components/layout/Logo';
import { Button, Input } from '../../components/ui';
import { api } from '../../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setResult(res);
      setSent(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card p-6">
          {sent ? (
            <div className="text-center">
              <MailCheck size={32} className="mx-auto text-brand-600" />
              <h1 className="mt-3 text-base font-bold text-ink">Check your inbox</h1>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">If an account exists for <span className="font-semibold text-ink">{email}</span>, a reset link is on its way. The link expires in 1 hour.</p>
              {result?.emailSent === false && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  Email delivery is not configured on this deployment. Ask your administrator to enable SMTP or reset the password from the server.
                </p>
              )}
              <Link to="/login" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><ArrowLeft size={12} /> Back to sign in</Link>
            </div>
          ) : (
            <>
              <h1 className="text-base font-bold text-ink">Reset your password</h1>
              <p className="mt-1 text-xs text-ink-soft">Enter your account email and we'll send a secure reset link.</p>
              <form onSubmit={submit} className="mt-4 space-y-3">
                <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" autoFocus />
                <Button type="submit" className="w-full" loading={loading} disabled={!email.includes('@')}>Send reset link</Button>
              </form>
              <Link to="/login" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"><ArrowLeft size={12} /> Back to sign in</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
