# Deploying to Vercel

The repo is wired for a **single Vercel project** that serves both the SPA and the API.

```
Vercel project
├── client/dist          → static SPA (CDN)
└── /api/*  →  api/index.js  →  server/src/app.js  (Express on Lambda)
                              └── MongoDB Atlas
```

Config lives in `vercel.json` at the repo root. Nothing else is required.

---

## 1. Prerequisites

**A MongoDB Atlas cluster.** The embedded dev database (`server/dev-db.mjs`) cannot run on Vercel — serverless functions have no persistent process or disk. A free M0 cluster is enough to start.

1. Create a cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. **Database Access** → add a user with a strong password
3. **Network Access** → allow `0.0.0.0/0` (Vercel functions have no fixed IPs)
4. Copy the connection string: `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/`

---

## 2. Import the project

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → `tilakbatra2002-cell/immigartion`
2. **Framework Preset:** `Other` — `vercel.json` already sets everything
3. Leave **Build Command**, **Output Directory**, and **Install Command** untouched — they come from `vercel.json`
4. Add the environment variables below **before** the first deploy

---

## 3. Environment variables

Generate the three secrets locally:

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET   (must differ)
openssl rand -hex 32   # DATA_ENCRYPTION_KEY   (must differ again)
```

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://your-project.vercel.app` |
| `API_URL` | `https://your-project.vercel.app` |
| `MONGODB_URI` | your Atlas connection string |
| `MONGODB_DB_NAME` | `immigrationflow` |
| `JWT_ACCESS_SECRET` | first generated value |
| `JWT_REFRESH_SECRET` | second generated value |
| `DATA_ENCRYPTION_KEY` | third generated value |
| `CORS_ORIGINS` | `https://your-project.vercel.app` |
| `TRUST_PROXY` | `1` |
| `COOKIE_SAME_SITE` | `lax` |
| `STORAGE_DRIVER` | `local` to start · `s3` for durable uploads |

> ⚠️ **`DATA_ENCRYPTION_KEY` must be set before the first passport/ID number is saved.**
> Adding it later makes existing ciphertext unreadable — the app decrypts to `''`.

Then **Deploy**.

---

## 4. Bootstrap the platform admin

Vercel gives you no shell, so run this once from your machine against the Atlas database:

```bash
cd server
MONGODB_URI="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/" \
MONGODB_DB_NAME=immigrationflow \
JWT_ACCESS_SECRET="<same as Vercel>" \
JWT_REFRESH_SECRET="<same as Vercel>" \
node scripts/create-superadmin.mjs \
  --email you@yourcompany.com \
  --password 'A-Strong-Password' \
  --name 'Platform Ops'
```

Never run `seed-demo.mjs` against production — it creates an organization with a public password.

---

## 5. Verify

```bash
curl https://your-project.vercel.app/api/health
```

Expect:

```json
{ "status": "ok", "db": "connected" }
```

If you see `"db": "unknown"`, the Atlas connection failed — check Network Access and the connection string.

Then open `https://your-project.vercel.app/login`, sign in with the admin account, and confirm you land on `/admin`.

---

## 6. What is different on Vercel

| Feature | Status | Why |
|---|---|---|
| SPA + API | ✅ Works | `vercel.json` rewrites |
| Auth (JWT + refresh cookie) | ✅ Works | `SameSite=Lax` |
| All 155 REST endpoints | ✅ Works | `api/index.js` wraps Express |
| Invoice PDF, CSV export | ✅ Works | Generated in memory |
| Uploaded documents | ⚠️ Ephemeral with `STORAGE_DRIVER=local` | Wiped on redeploy — use S3 |
| Socket.IO live updates | ❌ Off | Serverless has no long-lived connections |
| Background scheduler (reminders) | ❌ Off | No cron in a function |
| In-app notifications | ✅ Persist | Only the live push is skipped |

When the socket is unavailable the SPA still works — it falls back to polling and the notification list.

To restore live updates and reminders, host `server/src/index.js` on a long-running Node service
(Render / Railway / Fly) and keep Vercel for the SPA with `VITE_API_BASE_URL` pointing at it.

---

## 7. Optional: split deploy

If you'd rather run the API on Render and the SPA on Vercel:

**Vercel** — set the build variable:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://your-api.onrender.com/api` |

**Render** — set `CORS_ORIGINS=https://your-project.vercel.app` and `APP_URL=https://your-project.vercel.app`.

Because the two are different sites, the refresh cookie needs `COOKIE_SAME_SITE=lax` (already the
default) and a browser that accepts third-party cookies. A same-origin deploy avoids this entirely.

---

## 8. Production checklist

- [ ] `NODE_ENV=production`
- [ ] Three distinct 32-byte secrets
- [ ] `DATA_ENCRYPTION_KEY` set **before** any PII is stored
- [ ] Atlas Network Access allows Vercel
- [ ] `CORS_ORIGINS` lists only your real domain
- [ ] `STORAGE_DRIVER=s3` for durable documents
- [ ] Super admin created, demo seed never run
- [ ] `/api/health` returns `db: "connected"`
