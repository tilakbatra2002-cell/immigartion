# Integrations — Operational vs Credentials-Required

The system is designed so the **core product is fully operational without any third-party credentials**. Integrations add delivery and convenience; nothing is simulated when a provider is missing.

Legend: **🟢 Operational** = works with no external account · **🔑 Credentials required** = needs a provider account/key · **⚪ Not implemented** = out of scope.

---

## 1. Operational out of the box (no credentials)

| Capability | How it works | Verified |
|---|---|---|
| Authentication, sessions, password reset | Own JWT + bcrypt implementation | ✅ smoke + browser |
| Multi-tenant isolation | `organizationId` scoping in every query | ✅ smoke (cross-tenant 404s) |
| Organizations, memberships, roles & overrides | MongoDB | ✅ browser |
| Leads, clients, cases, documents, appointments, tasks | MongoDB + local/S3 storage abstraction | ✅ browser |
| Document upload / preview / verify | Local private disk with signed URLs (`STORAGE_DRIVER=local`) | ✅ browser (upload + verify) |
| Invoicing, payments recording, PDF | Server-side totals + PDF generation | ✅ smoke |
| Reports, dashboards, CSV export | MongoDB aggregations, streamed CSV | ✅ smoke (export 200) |
| Audit trail | Append-only `AuditLog` collection | ✅ smoke |
| In-app notifications | `Notification` collection + polling + Socket.IO | ✅ browser |
| Client portal (messaging, uploads) | Portal channel inside the app | ✅ browser (login, upload, message) |
| Plan limits & trial enforcement | Server-side `services/plans.js` | ✅ smoke (402 on limit) |
| AI/billing gating with honest messaging | `GET /ai/status`, `GET /billing` report unconfigured state | ✅ browser |

**Storage note:** `local` is fine for development and single-server trials. Production should use the S3 driver so files survive redeploys and scale horizontally.

---

## 2. Credentials required

### 2.1 Email — SMTP 🔑
- **Env:** `SMTP_HOST`, `SMTP_PORT`, ``SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- **Enables:** team invitations, email verification, password reset, portal-access emails, invoice emails, appointment/invoice reminders.
- **Without it:** mutations still succeed. Responses carry `emailSent: false` and the UI says email is not configured; temporary passwords are shown in-app so the consultant can relay them securely. **No email is ever reported as sent when it wasn't.**
- **Provider options:** Postmark, SES, SendGrid, Mailgun, Resend, Zoho, Gmail SMTP (app password, dev only).

### 2.2 WhatsApp Cloud API (Meta) 🔑
- **Env:** `WHATSAPP_PROVIDER=meta`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`
- **Enables:** outbound WhatsApp messages from Conversations; delivery state per message.
- **Without it:** the channel is rejected at send time with a **FAILED** message carrying the reason; the UI banner states "WhatsApp not connected — only portal messages deliver".
- **Notes:** template messages require pre-approved Meta templates; 24-hour customer-service windows apply.

### 2.3 AI provider (OpenAI-compatible) 🔑
- **Env:** `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_PROVIDER`, `AI_ENABLED`
- **Enables:** assistant Q&A, case summaries, email drafts, document field extraction, client reply drafting/translation.
- **Requires:** Professional plan or above (`plan.limits.ai`).
- **Without it:** `GET /ai/status` reports `configured:false`; AI calls return **402/503** with a reason; the AI page explains how to enable and notes manual alternatives still work.
- **Guarantees:** prompts never include other tenants' data; outputs are advisory; the model is never asked to decide an outcome and cannot change records.

### 2.4 Object storage — S3-compatible 🔑
- **Env:** `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`
- **Enables:** durable, horizontally scalable document storage.
- **Compatible with:** AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, DigitalOcean Spaces.
- **Note on Cloudinary:** not a drop-in fit for private immigration documents (public delivery URLs, image-centric). The S3 driver covers the same need with stronger privacy guarantees; swapping in a Cloudinary driver would violate the "no public document URLs" rule.

### 2.5 Payments — Stripe and/or Razorpay 🔑
- **Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` · `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_*`
- **Enables:** self-serve subscription checkout and webhook-driven plan state.
- **Mechanics:** `POST /billing/checkout` creates a provider session; `POST /api/webhooks/{stripe|razorpay}` verifies the raw-body signature, then updates `Subscription` and `Organization.status`.
- **Without it:** `POST /billing/change-plan` returns **503** with "No payment provider is configured"; plan changes require a platform administrator via `/admin/subscriptions/:organizationId`. **No payment is ever simulated.**
- **Webhook URLs to register:**
  - `https://api.yourdomain.com/api/webhooks/stripe` → events `checkout.session.completed`, `customer.subscription.updated|deleted`, `invoice.paid|payment_failed`
  - `https://api.yourdomain.com/api/webhooks/razorpay` → `subscription.activated|charged|halted|cancelled`, `payment.failed`

### 2.6 MongoDB Atlas 🔑 (infrastructure)
Required in production: managed Atlas cluster or a self-hosted replica set. The sandbox uses `mongodb-memory-server` (dev only, see `server/dev-db.mjs`).

### 2.7 Socket.IO 🔑 (optional)
Real-time invalidation of notifications and conversations. When the client cannot connect it silently falls back to polling (60 s notifications, 20 s conversation refresh) — **no feature depends on the socket being up**.

---

## 3. Not implemented (documented, not faked)
| Item | Status |
|---|---|
| OCR of scanned passport images | ⚪ AI document summary accepts text-extractable PDFs only; images are rejected with a clear error |
| Online card payment *inside* the client portal | ⚪ Portal shows balances only; payments are recorded by staff |
| Two-way email threading (IMAP) | ⚪ Outbound email + inbound portal messages only |
| e-Signature / document signing | ⚪ Not in scope |
| Government/visa-portal API integrations | ⚪ Not in scope (and would be unsafe to automate) |

---

## 4. Integration status surfaces
Operators can always see the truth in three places:
1. **Settings → Integrations** (per-org view) — `GET /organization/integrations`
2. **Super Admin → Platform settings** — `GET /admin/system` (flags only, never secrets)
3. **Communications banner** — `GET /communications/integrations/status`

Secrets are **never** returned to the browser; only booleans and non-sensitive identifiers (e.g. provider + model name).
