/**
 * API client. Access tokens are kept in memory only (never localStorage).
 * The refresh token lives in an HttpOnly, SameSite=Strict cookie set by the server.
 */
/**
 * API base URL.
 *
 * Defaults to a relative /api path, which is correct when the SPA and the API
 * share an origin (Vite dev proxy, Nginx, or Vercel serving both).
 * For a split deployment set VITE_API_BASE_URL (e.g. https://api.example.com/api)
 * at build time.
 */
export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

let accessToken = null;
let refreshTokenInMemory = null;
let onUnauthorized = null;

export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

/**
 * Keep the refresh token in memory as a fallback.
 *
 * The primary mechanism is the HttpOnly `if_refresh` cookie, which is both
 * safer and survives reloads. But cookies are dropped by some embedding
 * contexts (a sandboxed iframe has an opaque origin and no cookie store, and
 * cross-site iframes may block SameSite=Strict entirely). When that happens
 * every request 401s and the user is bounced back to /login after a
 * successful sign-in.
 *
 * Holding it in memory costs nothing when cookies work, and keeps the session
 * alive inside those contexts — until the tab is reloaded, which is the
 * unavoidable limit of not having any storage.
 */
export const setRefreshToken = (t) => { refreshTokenInMemory = t || null; };
export const getRefreshToken = () => refreshTokenInMemory;

class ApiError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

let refreshing = null;

async function refreshToken() {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      // Send the in-memory token too: the cookie is preferred, but this keeps
      // the session alive where cookies are blocked (see setRefreshToken).
      body: JSON.stringify(refreshTokenInMemory ? { refreshToken: refreshTokenInMemory } : {}),
    })
      .then(async (res) => {
        if (!res.ok) throw new ApiError(res.status, 'Session expired');
        const data = await res.json();
        accessToken = data.accessToken;
        if (data.refreshToken) refreshTokenInMemory = data.refreshToken;
        return data;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

/** True when this embedding context can actually persist a refresh cookie. */
export function cookiesUsable() {
  try { return typeof navigator === 'undefined' ? true : navigator.cookieEnabled !== false; } catch { return true; }
}

export { refreshToken };

async function request(method, path, body, { retry = true, isForm = false, responseType = 'json' } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let payload;
  if (body !== undefined) {
    if (isForm) payload = body;
    else { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'Network error — check your connection and try again.');
  }
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      await refreshToken();
      return request(method, path, body, { retry: false, isForm, responseType });
    } catch {
      if (onUnauthorized) onUnauthorized();
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
  }
  if (res.status === 204) return null;
  if (responseType === 'blob') {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(res.status, err.error || 'Request failed', err.details, err.code);
    }
    return res.blob();
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized && !path.startsWith('/auth/')) onUnauthorized();
    throw new ApiError(res.status, data?.error || data?.message || 'Request failed', data?.details, data?.code);
  }
  return data;
}

export const api = {
  get: (p, o) => request('GET', p, undefined, o),
  post: (p, b, o) => request('POST', p, b, o),
  patch: (p, b, o) => request('PATCH', p, b, o),
  put: (p, b, o) => request('PUT', p, b, o),
  del: (p, o) => request('DELETE', p, undefined, o),
  upload: (p, formData) => request('POST', p, formData, { isForm: true }),
  blob: (p) => request('GET', p, undefined, { responseType: 'blob' }),
};

export { ApiError };

/** Build query strings, dropping empty values. */
export function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'ALL') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Trigger a browser download from an authenticated endpoint. */
export async function downloadFile(path, filename) {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
