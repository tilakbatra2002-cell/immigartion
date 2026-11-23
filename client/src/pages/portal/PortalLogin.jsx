import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../../components/layout/Logo';
import { Button, Input } from '../../components/ui';

export default function PortalLogin() {
  const { loginClient } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await loginClient(form);
      toast.success('Welcome back');
      navigate(location.state?.from || '/portal', { replace: true });
    } catch (err) { setError(err.message || 'Could not sign in'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo />
            <h1 className="mt-5 text-lg font-extrabold tracking-tight text-ink">Client portal sign in</h1>
            <p className="mt-1 text-xs text-ink-soft">Track your case, upload documents and message your consultant.</p>
          </div>
          <form onSubmit={submit} className="card space-y-3.5 p-5">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            <Input label="Email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" />
            <div className="relative">
              <Input label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-[30px] text-ink-faint hover:text-ink" aria-label="Toggle password">{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
            <Button type="submit" className="w-full" loading={busy} disabled={!form.email || !form.password}>Sign in</Button>
            <p className="text-center text-2xs text-ink-faint">Forgot your password? Contact your consultant to reset portal access.</p>
          </form>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-2xs text-ink-faint"><ShieldCheck size={11} />Secure session · your data is private to your case team</div>
          <div className="mt-5 text-center"><Link to="/" className="inline-flex items-center gap-1 text-2xs font-medium text-ink-soft hover:text-ink"><ArrowLeft size={11} />Back to website</Link></div>
          <div className="mt-3 text-center text-2xs text-ink-faint">Are you a staff member? <Link to="/login" className="font-semibold text-brand-700">Staff sign in</Link></div>
        </div>
      </div>
    </div>
  );
}
