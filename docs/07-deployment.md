# Deployment Guide

Two supported shapes. Nginx + two Node processes is the reference setup.

```
                ┌──────────────────────────┐
  Browser ──TLS──▶ Nginx :443               │
                │  /      → static dist/  │
                │  /api   → :4000         │
                │  /socket.io → :4000 ws  │
                └──────────────────────────┘
                          │
                    Express × N ── MongoDB Atlas
```

---

## 0. Prerequisites
- Node **20 LTS** (tested on 20.20.2), npm 10+
- MongoDB Atlas (or a self-hosted replica set) — **replica set required** for transactions/retryable writes
- A domain + TLS certificate (Let's Encrypt is fine)
- An SMTP account and an S3-compatible bucket for real deployments

## 1. Local development
```bash
# terminal 1 — disposable/dev database with persistence
cd server && npm install
node dev-db.mjs            # mongodb-memory-server on 127.0.0.1:27017 → ./.cache/devdb

# terminal 2 — API
cd server && node src/index.js      # http://localhost:4000  (health: /api/health)

# terminal 3 — Vite dev server (proxies /api and /socket.io to :4000)
cd client && npm install && npm run dev   # http://localhost:5173
```
Optional dev data:
```bash
cd server
node scripts/create-superadmin.mjs --email you@company.com --password 'StrongPass123'
node scripts/seed-demo.mjs          # demo org (login printed); --force to reset
```

## 2. Production build
```bash
cd client
npm ci
npm run build                     # → client/dist  (static assets only)
```
The build is a **single-page app**; the web server must fall back to `index.html` for unknown paths.

```bash
cd server
npm ci --omit=dev
NODE_ENV=production node src/index.js
```

## 3. Environment
Copy `server/.env.example` → `server/.env` and set every required value. Minimum for production:

```dotenv
NODE_ENV=production
PORT=4000
APP_URL=https://app.yourdomain.com
API_URL=https://api.yourdomain.com

MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/immigrationflow

JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<different 64-hex>
DATA_ENCRYPTION_KEY=<different 64-hex>     # never change once data exists
ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_DAYS=7

CORS_ORIGINS=https://app.yourdomain.com
TRUST_PROXY=1

STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3.ap-south-1.amazonaws.com
S3_REGION=ap-south-1
S3_BUCKET=immigrationflow-docs
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…

REQUIRE_EMAIL_VERIFICATION=true
RATE_LIMIT_WINDOW_MIN=15
RATE_LIMIT_MAX=600
LOGIN_RATE_LIMIT_MAX=12
```

## 4. Nginx reference config
```nginx
server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    # Strict CSP for the SPA (the API sends its own headers)
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' wss: https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'" always;

    root /var/www/immigrationflow/dist;
    index index.html;

    # long-cache fingerprinted assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # never cache the shell
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 16m;          # matches the 15 MB document limit
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## 5. Process management (systemd)
```ini
# /etc/systemd/system/immigrationflow-api.service
[Unit]
Description=ImmigrationFlow API
After=network.target

[Service]
Type=simple
User=immigrationflow
WorkingDirectory=/srv/immigrationflow/server
EnvironmentFile=/srv/immigrationflow/server/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now immigrationflow-api
sudo journalctl -u immigrationflow-api -f
```
The API handles `SIGTERM`/`SIGINT` by closing the HTTP server, the Socket.IO server and the Mongo connection before exiting — safe for rolling restarts.

## 6. First-run checklist
1. `node scripts/create-superadmin.mjs --email ops@yourdomain.com --password '…'` → the **only** way to mint a platform admin (no hard-coded credentials).
2. Sign in at `/login` → you are routed to `/admin`.
3. Create/invite the first Owner: a customer can also self-register at `/register`, which creates their org on a 14-day trial.
4. In *Settings → Organization*, set business name, address, tax details, invoice prefix, timezone and currency — these feed invoices and the portal.
5. In *Settings → Integrations*, confirm which providers report as configured.
6. Upload a test document and download it to prove storage works.
7. Send a test invitation to prove SMTP works (or confirm the graceful "email not configured" path).

## 7. Database operations
| Task | Command |
|---|---|
| Index build | Automatic on first boot (`autoIndex` in dev). For production run `Model.syncIndexes()` once during a maintenance window, or create indexes via Atlas. |
| Backup | Enable Atlas continuous backups; verify a restore quarterly |
| Reference counters | `Counter` collection — do not edit manually |
| Reset a password | Owner/Super Admin: use the app's reset flow, or `node scripts/create-superadmin.mjs --email … --password …` to reset a platform admin |

## 8. Scaling notes
- API is stateless apart from rate-limit counters → scale horizontally behind Nginx.
- Run **one** scheduler instance (`services/scheduler.js`) or add a distributed lock before scaling reminder jobs.
- Add the Socket.IO Redis adapter when running more than one API instance.
- Point `STORAGE_DRIVER=s3` and put a CDN in front of the SPA assets only — **never** in front of documents (signed URLs only).

## 9. Health & monitoring
- `GET /api/health` → `{ status: "ok", db: "connected", ... }` — use for uptime checks and load-balancer health.
- `GET /api/admin/system` (super admin) → environment, DB state, storage driver, uptime, integration flags.
- Ship `journalctl`/stdout to your log platform; the app logs one line per request (no bodies, no tokens).

## 10. Rollback
1. Keep the previous `dist/` (e.g. `dist-<sha>`) and switch the Nginx `root` symlink.
2. `systemctl restart immigrationflow-api` after pointing at the previous release directory.
3. Database migrations are additive by design; no destructive migration is performed automatically.
