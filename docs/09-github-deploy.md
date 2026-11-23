# Deploying from GitHub

This project is a **monorepo with two apps**:

| Folder | What it is | Runs as |
|---|---|---|
| `client/` | React 18 + Vite SPA | Static files (CDN) |
| `server/` | Express + MongoDB API | Long-running Node process |

> **GitHub Pages cannot host this.** Pages only serves static files — it cannot run the Express API, hold secrets, or connect to MongoDB. Use a platform that runs Node (below).

---

## 1. Push the repository to GitHub

The repo is already committed locally (`git log` shows the initial commit). Create an **empty** repo on GitHub (no README, no .gitignore), then:

```bash
cd /home/user

# point at your repo — replace YOUR_USER and YOUR_REPO
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git

git push -u origin main
```

If you use SSH instead:

```bash
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
git push -u origin main
```

**Authentication:** GitHub no longer accepts account passwords over HTTPS. Use a
[Personal Access Token](https://github.com/settings/tokens) (scope: `repo`) as the password,
or push over SSH with a key that's added to your GitHub account.

---

## 2. What is already handled

- ✅ `.gitignore` excludes `.env`, `node_modules/`, `dist/`, local DB, and caches
- ✅ `server/.env` is **not** committed — only `.env.example` (safe placeholders)
- ✅ `package.json` exists at root, in `client/`, and in `server/`
- ✅ Lockfiles are committed, so `npm ci` works
- ✅ `.github/workflows/ci.yml` builds the client and runs the 71-assertion smoke suite on every push

---

## 3. Recommended: single-platform deploy (easiest)

Host the API **and** the built SPA on one origin. No CORS headaches, and the refresh cookie works normally.

### Option A — Render

1. New → **Web Service** → connect your repo
2. **Build command**
   ```bash
   npm --prefix client install && npm --prefix client run build && npm --prefix server install
   ```
3. **Start command**
   ```bash
   node server/src/index.js
   ```
4. **Environment variables** (Render → Environment):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` (Render provides this automatically) |
   | `APP_URL` | `https://your-app.onrender.com` |
   | `MONGODB_URI` | your MongoDB Atlas connection string |
   | `MONGODB_DB_NAME` | `immigrationflow` |
   | `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
   | `JWT_REFRESH_SECRET` | a *different* `openssl rand -hex 32` |
   | `DATA_ENCRYPTION_KEY` | a *third* `openssl rand -hex 32` |
   | `CORS_ORIGINS` | `https://your-app.onrender.com` |
   | `TRUST_PROXY` | `1` |
   | `STORAGE_DRIVER` | `s3` (local disk is wiped on redeploy) |

5. Serve the SPA from Express. Add this to `server/src/index.js` **before** the 404 handler:

   ```js
   // Serve the built SPA in production
   if (env.NODE_ENV === 'production') {
     const dist = path.resolve(__dirname, '../../client/dist');
     app.use(express.static(dist));
     app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
   }
   ```

   > `path` and `__dirname` need `import path from 'node:path'` and
   > `import { fileURLToPath } from 'node:url'` — see the note at the bottom.

6. **MongoDB:** create a free **MongoDB Atlas** cluster, allow Render's IPs (`0.0.0.0/0` is fine to start), and copy the connection string.

### Option B — Railway / Fly.io

Same idea: build the client, run `node server/src/index.js`, set the same env vars. On Fly, run two processes (web + a static host) or use the same static-serving approach.

---

## 4. Split deploy (Vercel + Render)

Use this only if you want the SPA on a CDN.

**Frontend → Vercel**
- Root directory: `client`
- Build: `npm run build` · Output: `dist`
- Add a rewrite so `/api/*` proxies to your API (avoids CORS entirely):

  `client/vercel.json`
  ```json
  {
    "rewrites": [
      { "source": "/api/:path*", "destination": "https://YOUR-API.onrender.com/api/:path*" }
    ]
  }
  ```

**Backend → Render**
- Start: `node server/src/index.js`
- `APP_URL=https://your-frontend.vercel.app`
- `CORS_ORIGINS=https://your-frontend.vercel.app`

> ⚠️ With a split deploy the refresh cookie is **cross-site**. `SameSite=Strict` (the current
> setting) will be dropped by the browser, and users will be logged out on reload. Either use the
> rewrite above (recommended — same-origin), or set a `COOKIE_DOMAIN` on a shared parent domain
> and relax `sameSite` in `server/src/routes/auth.js`.

---

## 5. After the first deploy

```bash
# create the platform admin (run once, in the platform's shell)
node server/scripts/create-superadmin.mjs \
  --email you@yourcompany.com \
  --password 'A-Strong-Password' \
  --name 'Platform Ops'
```

Do **not** run `seed-demo.mjs` in production — it creates a fake organization with a known password.

Check the deployment:

```bash
curl https://your-api/api/health
# {"status":"ok","service":"immigrationflow-api","db":"connected"}
```

Then sign in at `https://your-app/login`, and confirm you land on `/admin`.

---

## 6. Production checklist

- [ ] `NODE_ENV=production` (this enables the `secure` flag on the refresh cookie)
- [ ] All three secrets generated with `openssl rand -hex 32` and **different** from each other
- [ ] `MONGODB_URI` points at Atlas, not the embedded dev database
- [ ] `DATA_ENCRYPTION_KEY` set **before** any client passport data is saved — adding it later makes existing ciphertext unreadable
- [ ] `STORAGE_DRIVER=s3` with a bucket (local disk is ephemeral)
- [ ] `CORS_ORIGINS` lists your real frontend origin only
- [ ] `REQUIRE_EMAIL_VERIFICATION=true` once SMTP is configured
- [ ] Demo seed never run
- [ ] `/api/health` returns `db: "connected"`

---

## Note on serving the SPA from Express

The snippet above needs these imports at the top of `server/src/index.js` (ESM has no
`__dirname`):

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

Tell me which platform you pick and I'll wire the static-serving code and the exact
config files directly into the repo.
