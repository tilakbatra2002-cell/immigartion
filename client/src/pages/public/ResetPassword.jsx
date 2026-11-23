import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Logo from '../../components/layout/Logo';
import { Button, Input } from '../../components/ui';
import { api } from '../../lib/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8 || !/[0-9]/.test(password)) { setError('Password must be at least 8 characters and include a number.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card p-6">
          {!token ? (
            <>
              <h1 className="text-base font-bold text-ink">Invalid reset link</h1>
              <p className="mt-1.5 text-xs text-ink-soft">This link is missing a token. Request a new password reset email.</p>
              <Link to="/forgot-password"><Button className="mt-4 w-full" variant="secondary">Request new link</Button></Link>
            </>
          ) : done ? (
            <div className="text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
              <h1 className="mt-3 text-base font-bold text-ink">Password updated</h1>
              <p className="mt-1.5 text-xs text-ink-soft">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <h1 className="text-base font-bold text-ink">Choose a new password</h1>
              <form onSubmit={submit} className="mt-4 space-y-3">
                <div className="relative">
                  <Input label="New password" type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-[30px] rounded p-1 text-ink-faint hover:bg-slate-100">
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <Input label="Confirm password" type={show ? 'text' : 'password'} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" />
                {error && <p className="text-xs font-medium text-red-600">{error}</p>}
                <Button type="submit" className="w-full" loading={loading}>Update password</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
