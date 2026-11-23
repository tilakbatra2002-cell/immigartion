# ImmigrationFlow

**AI-assisted immigration consultancy management — multi-tenant SaaS by Webamazee.**

React 18 + Vite + Tailwind SPA · Node/Express + MongoDB API · JWT auth · optional AI, SMTP, WhatsApp, Stripe/Razorpay, S3.

---

## Quick start (development)

```bash
# 1. Database (dev only — mongodb-memory-server, persists to ./.cache/devdb, git-ignored)
cd server && npm install && node dev-db.mjs

# 2. API  → http://localhost:4000  (health: /api/health)
cd server && node src/index.js

# 3. App  → http://localhost:5173  (proxies /api and /socket.io)
cd client && npm install && npm run dev
```

Optional one-time setup:

```bash
cd server
node scripts/create-superadmin.mjs --email you@company.com --password 'StrongPass123'
node scripts/seed-demo.mjs     # demo workspace; credentials printed to the console
```

## Verification

```bash
cd server && node tests/smoke.mjs      # 71 assertions — requires the API to be running
cd client && npm run build             # production bundle → client/dist
```

## Documentation

| Doc | Contents |
|---|---|
| [`docs/01-features.md`](docs/01-features.md) | Complete feature list, module by module |
| [`docs/02-data-model-and-api.md`](docs/02-data-model-and-api.md) | 18 models, 155 endpoints, response conventions |
| [`docs/03-environment-variables.md`](docs/03-environment-variables.md) | Every env var, required vs optional |
| [`docs/04-integrations.md`](docs/04-integrations.md) | Operational vs credentials-required, and what is *not* implemented |
| [`docs/05-security.md`](docs/05-security.md) | Controls, verification evidence, residual risks |
| [`docs/06-limitations.md`](docs/06-limitations.md) | Honest inventory of gaps |
| [`docs/07-deployment.md`](docs/07-deployment.md) | Production deployment (Nginx + systemd), first-run checklist |
| [`docs/08-final-report.md`](docs/08-final-report.md) | Delivery report, bug log, quality-bar evidence |

## Layout

```
server/   Express API — config, models, routes (19 modules), services, middleware, scripts, tests
client/   React SPA — public pages, staff app, client portal, super admin, UI kit
docs/     Documentation pack + screenshots
```

## Product rules baked into the code

- No business data in `localStorage`, JSON files or mock APIs — everything is MongoDB.
- No fabricated metrics: empty states instead of sample data.
- Missing integrations fail loudly (`FAILED` / `402` / `503` with a reason), never silently.
- AI drafts and extracts; it never approves, refuses or submits an application.
- Client-portal users never see internal notes, fees or other clients' data.
- Passport/identity fields are AES-256-GCM encrypted and masked in lists.

---

## Demo accounts (after running the seed scripts)

| Who | Email | Password | Lands on |
|---|---|---|---|
| Workspace owner | `demo@immigrationflow.app` | `DemoPass123!` | `/app/dashboard` |
| Team members | `rohit@` · `ananya@` · `kabir@northstar.example.com` | `DemoPass123!` | `/app/dashboard` |
| Client portal | `aman.sethi@example.com` | issued by *Enable portal* — printed in the UI, never stored | `/portal` |
| Platform admin | `admin@immigrationflow.app` | `PlatformAdmin123` | `/admin` |

```bash
cd server
node scripts/seed-demo.mjs --force        # rebuilds the demo org
node scripts/create-superadmin.mjs --email admin@immigrationflow.app \
     --password "PlatformAdmin123" --name "Platform Ops"
```

Portal credentials are one-time: re-enabling a client's portal issues a fresh temporary password.
