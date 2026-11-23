import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Logo from '../../components/layout/Logo';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setMessage('This verification link is missing a token.'); return; }
    api.post('/auth/verify-email', { token })
      .then((r) => { setState('success'); setMessage(r.message); })
      .catch((e) => { setState('error'); setMessage(e.message); });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card p-6 text-center">
          {state === 'loading' && <><Loader2 className="mx-auto animate-spin text-brand-600" size={32} /><p className="mt-3 text-xs text-ink-soft">Verifying your email…</p></>}
          {state === 'success' && <>
            <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
            <h1 className="mt-3 text-base font-bold text-ink">Email verified</h1>
            <p className="mt-1.5 text-xs text-ink-soft">{message}</p>
            <Link to="/app/dashboard"><Button className="mt-4 w-full">Go to dashboard</Button></Link>
          </>}
          {state === 'error' && <>
            <XCircle size={32} className="mx-auto text-red-600" />
            <h1 className="mt-3 text-base font-bold text-ink">Verification failed</h1>
            <p className="mt-1.5 text-xs text-ink-soft">{message}</p>
            <Link to="/login"><Button className="mt-4 w-full" variant="secondary">Back to sign in</Button></Link>
          </>}
        </div>
      </div>
    </div>
  );
}
