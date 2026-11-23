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

## Deployment

One Vercel project serves both the SPA and the API (`vercel.json` at the repo root).

1. Import the repo at [vercel.com/new](https://vercel.com/new), framework preset **Other**
2. Add environment variables — `MONGODB_URI` (MongoDB Atlas), `MONGODB_DB_NAME`,
   `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY` (three different
   `openssl rand -hex 32` values), `APP_URL`/`API_URL`/`CORS_ORIGINS` set to your
   `https://*.vercel.app` domain, `NODE_ENV=production`, `TRUST_PROXY=1`, `COOKIE_SAME_SITE=lax`
3. Deploy, then create the platform admin against Atlas:
   ```bash
   cd server
   MONGODB_URI="mongodb+srv://..." MONGODB_DB_NAME=immigrationflow \
     JWT_ACCESS_SECRET="<same>" JWT_REFRESH_SECRET="<same>" \
     node scripts/create-superadmin.mjs --email you@company.com --password 'StrongPass!' --name 'Ops'
   ```
4. Verify: `curl https://your-project.vercel.app/api/health` → `"db": "connected"`

**Serverless limitations:** Socket.IO live updates and the background reminder scheduler do not
run on Vercel. Notifications still persist; the SPA falls back to polling. Set
`STORAGE_DRIVER=s3` for durable document uploads — local disk is wiped on redeploy.

## Layout

```
api/      Vercel serverless entry (wraps the Express app)
server/   Express API — config, models, routes (19 modules), services, middleware, scripts, tests
client/   React SPA — public pages, staff app, client portal, super admin, UI kit
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
