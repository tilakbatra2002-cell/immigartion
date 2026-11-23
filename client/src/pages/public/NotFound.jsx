import { Link } from 'react-router-dom';
import Logo from '../../components/layout/Logo';
import { Button } from '../../components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <Logo />
      <p className="mt-8 font-ui text-5xl font-extrabold text-slate-300">404</p>
      <h1 className="mt-2 text-lg font-bold text-ink">Page not found</h1>
      <p className="mt-1 max-w-sm text-xs text-ink-soft">The page you're looking for doesn't exist or you don't have access to it.</p>
      <div className="mt-5 flex gap-2">
        <Link to="/app/dashboard"><Button size="sm">Go to dashboard</Button></Link>
        <Link to="/"><Button size="sm" variant="secondary">Back home</Button></Link>
      </div>
    </div>
  );
}
