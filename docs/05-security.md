# Security Review & Verification

This document lists what was **built**, what was **tested**, and what remains a **residual risk**. Nothing here is aspirational — each ✅ was exercised by `server/tests/smoke.mjs` (71 assertions) or a Playwright browser run.

---

## 1. Authentication

| Control | Implementation | Verified |
|---|---|---|
| Password hashing | bcrypt cost 12 | ✅ |
| Password policy | ≥ 8 chars, letter + number, ≤ 200 | ✅ |
| Access tokens | JWT, 15-minute TTL, **memory only** (never `localStorage`) | ✅ |
| Refresh tokens | Rotating, `HttpOnly; SameSite=Strict; Secure` (prod), SHA-256 hashed at rest | ✅ |
| Refresh reuse detection | Old token marked `revokedAt` + `replacedByHash`; reuse revokes the family | ✅ |
| Logout | Revokes the refresh token server-side and clears the cookie | ✅ |
| Account lockout | 10 failed attempts → 15-minute lock | ✅ (logic) |
| User enumeration | Generic "Invalid email or password"; forgot-password always 200 | ✅ |
| Email verification | 48-hour single-use token; `REQUIRE_EMAIL_VERIFICATION=true` enforces it in prod | ✅ |
| Password reset | 1-hour single-use token, hashed at rest | ✅ |
| Portal separation | Separate login endpoint; `requireClient` re-checks the portal profile on **every** request | ✅ |
| Session revocation on disable | Disabled users fail `requireAuth` immediately | ✅ |

## 2. Authorization & tenant isolation

| Control | Implementation | Verified |
|---|---|---|
| Tenant scoping | `req.organizationId` is taken from the authenticated **membership**, never from the request | ✅ |
| Cross-tenant read | Returns **404**, not 403 (no existence oracle) | ✅ smoke: `Cross-tenant lead read → 404`, `Cross-tenant case read → 404` |
| Cross-tenant write | All mutations filter by `{ _id, organizationId }` first | ✅ |
| Role permissions | 34 permission strings; `requirePermission()` on every mutating route | ✅ |
| Per-org overrides | `Organization.settings.roleOverrides` grants/revokes, editable by Owner | ✅ |
| Super admin | `isSuperAdmin` checked by `requireSuperAdmin` on `/api/admin/*` only; org owners get 403 | ✅ smoke: `Org owner cannot access super admin` |
| Portal data leaks | Client queries exclude internal notes, fees, `internalNotes`, and non-`CLIENT` timeline entries | ✅ browser: portal pages contain none of the seeded internal text |
| Sensitive fields | Passport number requires `clients.sensitive` **and** is removed from list responses | ✅ smoke: `Passport NOT in list response` |
| Reveal auditing | Revealing a passport number writes an audit entry | ✅ |
| Self-service guards | Cannot remove your own super admin; cannot disable yourself | ✅ |

## 3. Data protection

| Control | Implementation |
|---|---|
| Encryption at rest (PII) | AES-256-GCM (`services/crypto.js`), key from `DATA_ENCRYPTION_KEY` (fallback: derived from JWT secret). Format `v1:<iv>:<tag>:<ciphertext>`. ✅ round-trip tested |
| Encryption in transit | HSTS enabled when `NODE_ENV=production`; deploy behind TLS |
| File privacy | No public bucket. Downloads go through a **5-minute signed JWT** (`/api/files/download?key&token`); S3 uses presigned GETs ✅ smoke: signed URL serves the file |
| Upload validation | MIME allow-list **and** magic-byte sniffing; 15 MB cap; tenant-prefixed storage keys ✅ smoke |
| Path traversal | Storage keys are generated server-side (`buildStorageKey`); user input never becomes a path |
| Soft deletes | `deletedAt` + audit entry; signed URLs expire |
| Log hygiene | Passwords, tokens, passport numbers and full request bodies are never logged; morgan logs method/path/status only |
| Secrets in responses | `passwordHash` is `select:false`; env values never serialised to clients — only booleans from `/admin/system` ✅ |

## 4. Input & transport hardening

| Control | Implementation |
|---|---|
| Schema validation | Zod on every body/query (`utils/validate.js`); errors returned per-field |
| NoSQL injection | `express-mongo-sanitize` + explicit `$`/`__proto__` rejection; validated query objects only |
| Prototype pollution | Keys `__proto__`, `constructor`, `prototype` stripped recursively |
| XSS | React escaping by default; no `dangerouslySetInnerHTML` on user content; HTML emails escape interpolated names |
| CSRF | Access-token APIs are Bearer-only (not cookie-auth), so they are not CSRF-able. Refresh/logout use `SameSite=Strict` **plus** an Origin allow-list check (`verifyOrigin`) ✅ |
| CORS | Allow-list (`CORS_ORIGINS` + `APP_URL` host + loopback + preview domains); credentials enabled; unknown origins rejected ✅ (this was a real bug found in testing and fixed) |
| Clickjacking | Helmet defaults + `X-Frame-Options: SAMEORIGIN` + CSP disabled only because the API returns JSON |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Rate limiting | Global API limiter (600/15 min), stricter login limiter (12/15 min), export throttling |
| Payload limits | JSON 2 MB; multipart 15 MB/file, 1 file |
| Error leakage | Stack traces returned only when `NODE_ENV!=='production'`; production returns `{ error, code }` |
| Mongo `$where`/regex DoS | User search terms go through `escapeRegex()` |

## 5. SaaS-specific controls

| Control | Implementation | Verified |
|---|---|---|
| Plan limits | `enforceSeatLimit`, `enforceLeadLimit`, `enforceCaseLimit` run **server-side before insert** | ✅ smoke: `Seat limit enforced on 3rd user → 402` |
| Feature gating | `assertFeature('clientPortal' \| 'ai' \| 'advancedReports' \| 'customWorkflows')` | ✅ |
| Trial expiry | `getAccess()` recomputes status on every request; expired → reads allowed, mutations return **402** | ✅ |
| Suspension | `Organization.status=SUSPENDED` blocks the tenant immediately, with a stored reason | ✅ browser: suspend → login blocked → reactivate |
| Webhook authenticity | Stripe/Razorpay HMAC over the **raw body**, mounted before `express.json()`; invalid signatures rejected | ✅ code path |
| Payment integrity | Totals computed server-side; overpayment rejected | ✅ smoke: `Overpayment rejected` |
| AI safety | Cannot change status, cannot approve/refuse, outputs labelled unverified, plan-gated | ✅ |

## 6. Audit trail
Append-only `AuditLog` covering auth events, lead/client/case/document/invoice/payment changes, team and role edits, workflow edits, portal access, admin actions, AI calls and exports. Each entry stores actor, role, org, IP, user agent and a human-readable description. Exposed per-org (Settings → Audit logs, permission-gated) and platform-wide (Super Admin → Audit trail). ✅ smoke: `AUDIT LOG written`.

## 7. What testing actually covered
- **API (71 assertions, 0 failures):** registration, login-token round-trip across 16 authenticated GETs, auth guards, cross-tenant reads, lead→client conversion, case creation + checklist, signed document download, invoice totals + overpayment, task filters, appointments, seat limits, AI unavailability, dashboard metrics, audit logging, portal isolation, billing gating, RBAC, super-admin protection.
- **Browser (Playwright, Chromium):** register → onboarding → dashboard; lead create → convert → case create → case detail; document upload + verify; communication send with honest delivery state; invoice creation; every app page; every admin page incl. tenant suspend/reactivate; portal login → dashboard → cases → documents → messages (send) → invoices → profile; mobile (390 px) and tablet (834 px) with zero horizontal overflow and zero console errors.

## 8. Residual risks / recommended follow-ups
1. **No 2FA/MFA** — recommended for Owner and Super Admin accounts.
2. **No per-IP geolocation or impossible-travel detection.**
3. **Rate limits are in-process** — for multi-instance deployments move to Redis (`rate-limit-redis`).
4. **Socket.IO scaling** — needs a Redis adapter for multiple API instances.
5. **No automated data-retention/purge job** for closed cases (GDPR/DPDP right-to-erasure needs a documented procedure).
6. **Dependency scanning** — run `npm audit` and enable Dependabot/Renovate in CI.
7. **CSP** — the API disables CSP because it serves JSON only; put a strict CSP header on the static frontend host (e.g. `default-src 'self'; object-src 'none'; frame-ancestors 'none'`).
8. **Backups** — Atlas snapshots must be enabled; test a restore before go-live.
9. **Field-encryption key rotation** requires a re-encryption migration script (not provided).
10. **Email verification** defaults to off in development; set `REQUIRE_EMAIL_VERIFICATION=true` in production.
