# Known Limitations

Honest inventory of what is **not** finished, **not** production-hardened, or **deliberately** out of scope. Anything listed here should be treated as "unknown until proven" rather than complete.

---

## 1. Verified-working vs not-yet-wired

| Area | State | Detail |
|---|---|---|
| Core CRM → case → document → invoice flow | ✅ Verified in browser | Lead → convert → case → upload → verify → invoice → payment |
| Client portal (login, cases, docs, messages, invoices, profile) | ✅ Verified in browser | Including a real message sent from the portal |
| Super Admin (all 8 screens + suspend/reactivate) | ✅ Verified in browser | |
| Real-time updates | ⚠️ Implemented, not soak-tested | Socket.IO emits on mutations; a multi-instance deployment needs a Redis adapter |
| Stripe / Razorpay checkout | ⚪ **Not tested against live providers** | Code paths + signature verification exist; no sandbox/live account was ever connected, so end-to-end payment is **unverified** |
| SMTP delivery | ⚪ **Not tested against a real SMTP server** | Templates and `emailSent` handling verified; actual inbox delivery unverified |
| WhatsApp Cloud API | ⚪ **Not tested against Meta** | Send path + failure reporting verified only in the "not configured" branch |
| AI provider calls | ⚪ **Not tested against a live model** | Gating, status reporting and 402/503 behaviour verified; prompt quality unverified |
| S3 storage driver | ⚪ **Not tested against a real bucket** | Local signed-URL driver fully tested; S3 path shares the interface but was never pointed at a bucket |
| Scheduled reminders/digest email | ⚠️ Scheduler runs; email delivery depends on SMTP | Verified that the job loop starts |
| PDF invoice rendering | ✅ Smoke-tested (200 + bytes) | Visual layout not reviewed page-by-page |
| OCR of passport images | ❌ Not implemented | AI document summary accepts text-extractable PDFs only |
| Two-way email (IMAP) | ❌ Not implemented | Outbound email + inbound portal messages only |
| Invite-token redemption | ⚠️ Partial | Invites create an `INVITED` membership and email a link; the accept page expects the invitee to set a password with the emailed token. Manual relay is used when SMTP is off. |
| Client-portal invoice PDF | ❌ Not implemented | Portal shows balances; staff can download the PDF |

## 2. Functional gaps
1. **No bulk operations** (bulk lead reassign, bulk document request) — single-record actions only.
2. **No custom fields** — the schema is fixed; Business-plan "custom workflows" currently means editable case stages, not arbitrary fields.
3. **Kanban is read-mostly** — status can be changed from a card dropdown; drag-and-drop is not implemented.
4. **Calendar is month-only** — no week/day grid, no ICS export.
5. **No reminder scheduling UI** — reminder minutes are stored; the actual notification depends on the scheduler + SMTP.
6. **Notifications are in-app + email only** — no push, no SMS.
7. **Report date filters** cap at the aggregations provided; no ad-hoc pivot builder.
8. **Search is substring/regex**, not full-text. Fine to ~100 k records per tenant; Atlas Search would be the upgrade.
9. **One organization per login** — a user invited to two organizations uses the one selected at login; there is no org switcher in the UI.
10. **No data import** (CSV lead/client import). Export exists for leads and reports.

## 3. Platform & operations
1. **The demo database is `mongodb-memory-server`** in this sandbox (persisted to `./.cache/devdb`, which is git-ignored and disposable). It is for development only — production requires Atlas or a replica set.
2. **Rate limiting is in-process** — reset on restart, not shared across instances.
3. **File storage defaults to local disk** — not durable across redeploys; set the S3 driver in production.
4. **No CI pipeline** committed — `node tests/smoke.mjs` is the regression gate; wire it into CI.
5. **No Dockerfile / docker-compose** in the repo (deployment steps in `07-deployment.md` describe a manual path).
6. **No automated backups** — configure Atlas snapshots.
7. **No i18n** — English only, `en-IN` number/date formatting.
8. **No MFA/2FA**, no SSO/SAML.
9. **Email verification is off by default** in `.env.example` (`REQUIRE_EMAIL_VERIFICATION=false`); flip it for production.
10. **`DATA_ENCRYPTION_KEY`** falls back to a JWT-derived key if unset; rotating JWT secrets would then orphan encrypted passport data.

## 4. UX / polish items noticed during testing
1. Emoji country flags render as tofu on systems without an emoji font — replaced with ISO chips (`AU`, `CA`, …) in lists.
2. `TableSkeleton` had invalid DOM nesting when placed inside `<table>`; fixed with a `bare` mode.
3. Validation summary appears per field; there is no page-level error summary for very long forms.
4. Long dropdowns (100+ clients) rely on the searchable picker; plain `<select>` fallbacks are used in a few modals and would benefit from virtualisation.
5. The AI page shows raw usage counters; a cost estimate is not displayed.
6. Empty-state illustrations are icon-based (no custom art).

## 5. Deliberate non-features (by product rule)
- **AI never approves, refuses or submits** an application; it cannot change a case status.
- **No fabricated metrics** — every chart and number comes from a MongoDB aggregation, and empty states are shown instead of sample data.
- **No silent fallbacks** — a missing integration produces an explicit error, never a fake success.
- **No client-visible internal notes** — filtered at the query layer, not just hidden in the UI.

---

## Local data & workspace hygiene

The development database lives in `server/.cache/devdb` (git-ignored, ~300 MB of WiredTiger preallocated journal). It is **disposable** — it is not app data you should back up. To rebuild a clean demo state:

```bash
cd server
node dev-db.mjs                       # terminal 1
node scripts/create-superadmin.mjs --email admin@immigrationflow.app \
     --password 'PlatformAdmin123' --name 'Platform Ops'
node scripts/seed-demo.mjs            # add --force to wipe and recreate
```

Move it elsewhere with `DEV_DB_PATH=/your/path node dev-db.mjs`.
