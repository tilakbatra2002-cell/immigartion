# Environment Variables

Two files: `server/.env` (secrets — never commit) and `client/.env` (public build config).

---

## Server — `server/.env`
Copy `server/.env.example` and fill it in. Anything marked **required** must be set or the API refuses to boot.

### Core (required)
| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `production` | `development` \| `production` \| `test`. Enables HSTS + strict error payloads in production. |
| `PORT` | `4000` | API listen port. |
| `APP_URL` | `https://app.yourdomain.com` | Used in emails and reset links. Also trusted as a same-origin API host. |
| `API_URL` | `https://api.yourdomain.com` | Public API base (used in outbound links). |
| `MONGODB_URI` | `mongodb+srv://…/immigrationflow` | **Required.** MongoDB Atlas or a self-hosted replica set. |
| `MONGODB_DB_NAME` | `immigrationflow` | Optional override. |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` | **Required**, ≥ 32 chars. Rotating it invalidates all access tokens. |
| `JWT_REFRESH_SECRET` | *different* 64-hex | **Required**, must differ from the access secret. |
| `ACCESS_TOKEN_TTL` | `900` | Seconds. Default 15 min. |
| `REFRESH_TOKEN_DAYS` | `7` | Refresh lifetime in days. |
| `CORS_ORIGINS` | `https://app.yourdomain.com` | Comma-separated. Loopback, `APP_URL` and preview domains are additionally trusted by `services/corsOrigins.js`. |
| `TRUST_PROXY` | `1` | Set to `1` behind Nginx/ALB so rate limits and `req.ip` are correct. |
| `DATA_ENCRYPTION_KEY` | `openssl rand -hex 32` | **Strongly recommended.** AES-256-GCM key for passport/identity fields. If unset, a key is derived from `JWT_ACCESS_SECRET` — set it in production so rotating JWT secrets never orphans stored PII. **Never change it after data exists.** |

### Storage
| Variable | Example | Notes |
|---|---|---|
| `STORAGE_DRIVER` | `s3` | `local` (dev only) or `s3`. **Use `s3` in production** — local disk is not durable across deploys. |
| `LOCAL_STORAGE_DIR` | `./storage` | Used when driver is `local`. |
| `S3_ENDPOINT` | `https://s3.ap-south-1.amazonaws.com` | Any S3-compatible endpoint (AWS, Cloudflare R2, MinIO, Backblaze, Wasabi). |
| `S3_REGION` | `ap-south-1` | |
| `S3_BUCKET` | `immigrationflow-docs` | Keep private; the app only issues signed URLs. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | | Credentials of a least-privilege user (put/get/delete only). |
| `S3_FORCE_PATH_STYLE` | `true` | Required by MinIO and some providers. |

### Email (optional)
`SMTP_HOST`, `SMTP_PORT` (587), `SMTP_SECURE` (`false`), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (`ImmigrationFlow <no-reply@yourdomain.com>`).
When unset: invitation, verification, portal and invoice emails are **not sent** — the API returns `emailSent: false` and the UI tells the operator to relay credentials manually. Nothing is faked.

### WhatsApp Cloud API (optional)
`WHATSAPP_PROVIDER` (`none` \| `meta`), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION` (`v21.0`).
When unset: WhatsApp sends are recorded as `FAILED` with an explicit reason and the UI shows "not connected".

### AI (optional, OpenAI-compatible)
`AI_ENABLED` (`auto` \| `true` \| `false`), `AI_PROVIDER` (`openai`), `AI_BASE_URL` (`https://api.openai.com/v1`), `AI_API_KEY`, `AI_MODEL` (`gpt-4o-mini`).
Works with any OpenAI-compatible gateway (Azure OpenAI, OpenRouter, Groq, self-hosted vLLM). Requires the **Professional** plan or above.

### Payments (optional)
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER|PROFESSIONAL|BUSINESS`
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_STARTER|PROFESSIONAL|BUSINESS`
`BILLING_CURRENCY` (default `INR`).
When unset: checkout returns `503`, plan changes require a platform administrator, and no payment is ever simulated.

### Limits & policy
`RATE_LIMIT_WINDOW_MIN` (15) · `RATE_LIMIT_MAX` (600) · `LOGIN_RATE_LIMIT_MAX` (12) · `REQUIRE_EMAIL_VERIFICATION` (`false`; set **`true`** in production).

---

## Client — `client/.env`
| Variable | Default | Notes |
|---|---|---|
| `VITE_API_BASE` | `/api` | Leave blank/relative so the dev proxy and production reverse proxy handle routing. Set to an absolute URL only for split-origin deployments. |
| `VITE_SOCKET_URL` | same origin | Optional override for Socket.IO. |

Only `VITE_*` variables are exposed to the browser — **never** put secrets here.

---

## Generating secrets
```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET (different value)
openssl rand -hex 32   # DATA_ENCRYPTION_KEY (passport AES-256-GCM)
```

## Startup validation
`server/src/config/env.js` validates required variables at boot and exits with a readable message if anything is missing — the process will not silently run with an insecure default.
