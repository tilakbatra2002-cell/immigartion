import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import Logo from '../../components/layout/Logo';
import { Button, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  const token = params.get('token') || '';
  const emailParam = params.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Password is set by the admin during invite creation; the invitee signs in with it.
      await login({ email, password });
      toast.success('Welcome to the team', 'Your invitation has been accepted.');
      navigate('/app/dashboard');
    } catch (err) { setError(err.message || 'Could not sign in with these details.'); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><UserPlus size={17} /></div>
          <h1 className="mt-3 text-base font-bold text-ink">Accept your invitation</h1>
          <p className="mt-1 text-xs text-ink-soft">Sign in with the temporary password shared by your administrator, then change it from your profile.</p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <Input label="Work email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Temporary password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="From your invitation" />
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>Sign in & continue</Button>
          </form>
          {!token && <p className="mt-3 text-2xs text-ink-faint">Invitation token missing from the link. Ask your admin to resend the invite.</p>}
          <p className="mt-4 text-center text-2xs text-ink-faint">Already signed in? <Link to="/login" className="font-semibold text-brand-700">Go to sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
