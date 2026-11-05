# Deploying to Vercel (API + Report)

Both the API and the report SPA are deployed together on Vercel. The report is served as a static
site from `report/`, and the API serverless functions live in `api/`.

## One-time setup

### 1. Get your Neon connection string

In the [Neon console](https://console.neon.tech/), open your project → Connection Details →
copy the connection string. It looks like:
```
postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 2. Generate an API key

```bash
openssl rand -hex 32
# e.g. a3f8c2d1e9b04...
```

Keep this value — you'll use it in three places: Vercel env vars, the hook config, and the report.

### 3. Deploy to Vercel

```bash
npm install -g vercel   # if not installed
vercel --prod           # run from the repository root
```

When prompted to set up the project, point it to `lucas-martins-menezes-projects/claude-usage-stats`
(your existing project). Vercel will ask for environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | connection string from step 1 |
| `API_KEY` | key from step 2 |

After deploy, Vercel gives you a URL like `https://claude-usage-stats.vercel.app`.

### 4. Configure the hook

Add to `~/.claude/claude-usage-stats/backup.conf`:
```bash
API_URL="https://claude-usage-stats.vercel.app"
API_KEY="a3f8c2d1e9b04..."
```

The hook uploads to `$API_URL/api/ingest` in a background subshell after every Claude response.
If `API_URL` is unset, the block is skipped silently.

### 5. Open the report

Go to `https://claude-usage-stats.vercel.app` in your browser. Click **Database**, enter only the
**API Key** (leave the URL field blank — same domain), and click **Connect**.

The report auto-saves the key in `localStorage` and reconnects on every page load.

---

## How it works

```
claude-usage-stats.sh
  ├── writes ~/.claude/claude-usage-stats/claude-usage-stats.json  (always, primary)
  ├── git commit+push to backup repo             (if BACKUP_REPO configured)
  └── curl POST /api/ingest                      (if API_URL configured, background)

https://claude-usage-stats.vercel.app/
  ├── /            → report/index.html           (static SPA)
  ├── /api/ingest  → api/ingest.js               (serverless function)
  └── /api/sessions → api/sessions.js            (serverless function)
```

---

## Testing

```bash
API_URL="https://claude-usage-stats.vercel.app"
API_KEY="your-key"

# Ingest example data
curl -X POST "$API_URL/api/ingest" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @examples/sessions.example.json
# → { "ok": true, "sessions_upserted": 3, "log_entries_inserted": 16 }

# Read back
curl "$API_URL/api/sessions" \
  -H "Authorization: Bearer $API_KEY"
# → { "sessions": { ... }, "_meta": { ... } }

# Idempotency check (re-send same file)
curl -X POST "$API_URL/api/ingest" ...
# → { "ok": true, "sessions_upserted": 3, "log_entries_inserted": 0 }

# Migrate historical data
curl -X POST "$API_URL/api/ingest" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @~/.claude/claude-usage-stats/claude-usage-stats.json
```

---

## Vercel environment variables

Managed in the Vercel dashboard → project `claude-usage-stats` → Settings → Environment Variables.

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Neon connection string; rotate via Neon console |
| `API_KEY` | Shared secret; rotate here + update `backup.conf` |

---

## Retiring GitHub Pages

Once the Vercel deployment is confirmed working:
1. Go to the GitHub repo settings → Pages → set Source to **None**
2. Update any bookmarks or links pointing to the old Pages URL

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` | Wrong API key | Check key in Vercel env vars vs `.conf` |
| `500 Internal Server Error` | `DATABASE_URL` missing or wrong | Verify var in Vercel dashboard |
| Report shows no data | Haven't connected to Database source | Click Database button, enter API Key |
| Hook doesn't upload | `API_URL` not in `.conf` | Add `API_URL=...` to `~/.claude/claude-usage-stats/backup.conf` |
| Cold start delay (~500ms) | First request after idle | Expected behavior for serverless |
