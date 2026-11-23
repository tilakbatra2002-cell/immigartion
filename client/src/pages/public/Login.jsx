import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../../components/layout/Logo';
import { Button, Input } from '../../components/ui';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.includes('@') || !form.password) { setError('Enter your email and password.'); return; }
    setLoading(true);
    try {
      const user = await login(form);
      toast.success('Welcome back', `Signed in as ${user.name}`);
      navigate(user.isSuperAdmin ? '/admin' : (location.state?.from || '/app/dashboard'), { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col px-5 py-6 sm:px-10 lg:w-[46%] lg:px-16">
        <Link to="/" aria-label="Home"><Logo size="sm" /></Link>
        <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">Sign in to your workspace</h1>
          <p className="mt-1.5 text-xs text-ink-soft">Manage leads, cases, documents and billing in one place.</p>
          <form onSubmit={submit} className="mt-6 space-y-3.5" noValidate>
            <Input label="Work email" type="email" autoComplete="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@agency.com" />
            <div className="relative">
              <Input label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-[30px] rounded p-1 text-ink-faint hover:bg-slate-100">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <Link to="/forgot-password" className="text-xs font-semibold text-brand-700 hover:text-brand-800">Forgot password?</Link>
              <Link to="/portal/login" className="flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"><Users size={12} /> Client portal</Link>
            </div>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</div>}
            <Button type="submit" className="w-full" size="lg" loading={loading} icon={LogIn}>Sign in</Button>
          </form>
          <p className="mt-5 text-center text-xs text-ink-soft">
            New to ImmigrationFlow? <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800">Create an account</Link>
          </p>
        </div>
        <p className="text-center text-2xs text-ink-faint">© {new Date().getFullYear()} Webamazee · <Link to="/pricing" className="hover:text-ink-soft">Pricing</Link></p>
      </div>
      <div className="relative hidden flex-1 overflow-hidden bg-navy lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_70%_20%,#1E3A8A55_0%,transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <p className="text-2xs font-bold uppercase tracking-widest text-brand-300">Immigration consultancy software</p>
          <h2 className="mt-3 max-w-md text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-white">
            Every case, document and client — in one auditable system.
          </h2>
          <div className="mt-8 space-y-3">
            {['Passport data encrypted at rest', 'Client portal without internal notes', 'Real revenue and conversion reporting', 'Strict per-organization data isolation'].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-xs text-slate-300">
                <span className="h-1 w-1 rounded-full bg-brand-400" />{t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
