import { Link } from 'react-router-dom';
import Logo from '../layout/Logo';

export default function PublicFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo size="sm" />
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-ink-soft">
            Immigration consultancy management software for agencies, lawyers and overseas education consultants in India, Australia, New Zealand, the UK, Canada and the US.
          </p>
          <p className="mt-4 text-2xs text-ink-faint">A product by <span className="font-semibold text-ink-soft">Webamazee</span></p>
        </div>
        {[
          ['Product', [['/features', 'Features'], ['/pricing', 'Pricing'], ['/register', 'Start free trial'], ['/portal/login', 'Client portal']]],
          ['Destinations', [['/features', 'Canada'], ['/features', 'Australia'], ['/features', 'United Kingdom'], ['/features', 'New Zealand'], ['/features', 'United States']]],
          ['Company', [['/contact', 'Contact us'], ['/contact', 'Support'], ['/login', 'Sign in']]],
        ].map(([title, links]) => (
          <div key={title}>
            <p className="text-2xs font-bold uppercase tracking-wider text-ink-faint">{title}</p>
            <ul className="mt-3 space-y-2">
              {links.map(([to, label], i) => (
                <li key={`${to}-${i}`}><Link to={to} className="text-xs text-ink-soft transition hover:text-ink">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-2xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Webamazee. All rights reserved.</p>
          <p>ImmigrationFlow provides workflow software only and does not provide immigration advice or legal representation.</p>
        </div>
      </div>
    </footer>
  );
}
