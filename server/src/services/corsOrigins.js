/**
 * Central place that decides which browser origins may talk to the API.
 *
 * Two deployment shapes are supported:
 *  A. Split: React app on its own host (e.g. Vercel), API elsewhere → list every
 *     frontend origin in CORS_ORIGINS.
 *  B. Same-origin / proxied: the SPA is reached at a host that also proxies /api
 *     (Vite dev proxy, Nginx, Arena preview...). The browser sends that host as
 *     Origin, so it must be trusted too or every mutating request fails CORS.
 *     Docker/Nginx deployments are covered by TRUST_PROXY_HOSTS below.
 *
 * Extra hosts can always be appended through CORS_ORIGINS.
 */
import env from '../config/env.js';

const EXTRA_HOSTS = [
  // self-hosted docker-compose / nginx front door
  'https://app.immigrationflow.com',
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

/** Hosts that only ever exist inside the sandbox/preview infrastructure. */
const PREVIEW_HOST_SUFFIXES = ['.e2b.app', '.arena.ai', '.vercel.app', '.netlify.app'];

export function isAllowedOrigin(origin) {
  if (!origin || origin === 'null') return true; // non-browser client
  const configured = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (configured.includes(origin) || EXTRA_HOSTS.includes(origin)) return true;
  if (configured.some((a) => origin.startsWith(`${a}/`))) return true;

  let url;
  try { url = new URL(origin); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol)) return false;

  // Same-origin as the app itself (API + SPA behind one host)
  try {
    const appUrl = new URL(env.APP_URL);
    if (url.host === appUrl.host) return true;
  } catch { /* APP_URL may be malformed; ignore */ }

  // Preview/sandbox domains: random subdomains, impossible to enumerate upfront.
  if (PREVIEW_HOST_SUFFIXES.some((s) => url.hostname.endsWith(s))) return true;

  // Local development on any loopback port
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true;

  return false;
}

export function corsOrigin(origin, callback) {
  if (isAllowedOrigin(origin)) return callback(null, true);
  const e = new Error('Not allowed by CORS');
  e.status = 403;
  e.code = 'BAD_ORIGIN';
  return callback(e);
}
