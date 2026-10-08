# claude-statusline

A Claude Code statusline hook that persists token usage and context window data across sessions — including `/compact` resets and `--resume` reopens.

```
Model: Sonnet 4.6 | Context: 42% | Tokens: 1.2M
```

- Context % survives `/compact` (shows stale value with `~` until the next real reading)
- Token counter accumulates across the entire session, including after compacts
- Session identity tied to Claude Code's `session_id` UUID — survives `--resume`
- Session renames (UI or `--title`) are picked up automatically from the transcript
- Logs per-exchange token breakdown to a JSON file for later analysis
- Optional: auto-push the log to a private git repo in the background

---

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI installed and working
- Bash (on Windows: Git Bash or WSL)
- Node.js (any recent version — check with `node --version`)
- Git (optional, only for the backup feature)

---

## Installation

### Step 1 — Download the script

```bash
mkdir -p ~/.claude
curl -fsSL https://raw.githubusercontent.com/lucasmm96/claude-statusline/master/scripts/statusline-command.sh \
  -o ~/.claude/statusline-command.sh
chmod +x ~/.claude/statusline-command.sh
```

Or clone the repo and copy manually:

```bash
git clone https://github.com/lucasmm96/claude-statusline.git
cp claude-statusline/scripts/statusline-command.sh ~/.claude/statusline-command.sh
chmod +x ~/.claude/statusline-command.sh
```

### Step 2 — Register the hook in Claude Code settings

Open (or create) `~/.claude/settings.json` and add the `statusLine` key:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.claude/statusline-command.sh"
  }
}
```

If the file already has other settings, just add the `"statusLine"` block alongside them.

**On Windows:** make sure you're using the Git Bash path style. The command above works as-is in Git Bash. If you're on WSL, use the Linux home path instead.

### Step 3 — Verify

Start a Claude Code session and send any message. After the first response, you should see at the bottom:

```
Model: Sonnet 4.6 | Context: 42% | Tokens: 109.0k
```

The log file is created automatically at `~/.claude/statusline-sessions.json`.

---

## Report page

The report page visualizes your session history: per-exchange token breakdown (input, cache read, cache write, output), context usage timeline, compact events, and aggregate stats.

**How to open it:** download or clone this repo and open `report/index.html` in any browser. No server needed — it runs entirely in your browser.

### Option A — Load a local file

Click **Load file** and select your `~/.claude/statusline-sessions.json` (or the `sessions.json` inside your backup repo clone).

### Option B — Load from a URL

Paste any raw JSON URL into the URL field and click **Load URL**. Works with public GitHub raw URLs:

```
https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/sessions.json
```

You can also append `?data=<url>` to the page URL to auto-load on open:

```
report/index.html?data=https://raw.githubusercontent.com/...
```

### Option C — Connect to a private GitHub repo

Click **🔒 Private repo** in the header. A modal will ask for:

| Field | Description |
|---|---|
| Personal Access Token | A GitHub PAT with `Contents: Read-only` on your repo |
| Repository | `owner/repo` (e.g. `lucasmm96/my-statusline-log`) |
| File path | Path to the JSON file inside the repo (default: `sessions.json`) |

Click **Connect** — the page fetches the file from the GitHub API and loads it. The credentials are saved to your browser's `localStorage` and used to auto-load on the next page open.

**The PAT never leaves your browser** — it is sent only to `api.github.com`. To generate a suitable PAT: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → select your repo → Contents: Read-only.

To remove saved credentials, open the modal and click **Clear credentials**.

---

## Optional: private repo backup

The script can automatically commit and push your log to a private git repository after each Claude Code response. This runs entirely in the background and does not affect the statusline display.

### Step 1 — Create a private repo

Create a private repository on GitHub (or any git host). Keep it empty for now.

### Step 2 — Clone it locally

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_PRIVATE_REPO.git ~/your-local-clone
```

### Step 3 — Create the config file

Create `~/.claude/statusline-backup.conf`:

```bash
BACKUP_REPO="$HOME/your-local-clone"   # absolute path to the local clone
BACKUP_BRANCH="main"
BACKUP_FILE="sessions.json"
BACKUP_PUSH_INTERVAL=600               # min seconds between remote pushes (600 = 10 min)
```

That's it. On the next Claude Code response the script will write `sessions.json` into the clone, commit it, and push in the background.

### How it works

1. The log is written directly into the repo clone folder
2. A background process runs `git add + commit` after each write
3. A push happens at most once every `BACKUP_PUSH_INTERVAL` seconds
4. Auth uses your existing git credentials (SSH key or OS credential manager) — no credentials go in the config file
5. Failures are silent and automatically retried at the next interval

---

## Session renaming

When you rename a session in the Claude Code UI (or use `--title`), the new name is picked up automatically from the session transcript on the next hook call. No manual action needed.

---

## Troubleshooting

**Nothing appears after a response:**
- Verify Node.js is on your PATH: `node --version`
- Run the script manually to see any errors: `echo '{}' | bash ~/.claude/statusline-command.sh`
- Check that `settings.json` is valid JSON

**Context shows `0%` permanently:**
- One `0%` on the very first exchange after startup is normal
- `42~%` after `/compact` is expected — the `~` disappears after the next exchange

**Token count resets on `--resume`:**
- You may have an older version of the script that used `$PPID` instead of `session_id`. Re-copy the script from this repo.

**Backup not pushing:**
- Check that `BACKUP_REPO` points to a directory that contains a `.git` folder
- Try pushing manually: `cd ~/your-local-clone && git push`
- Verify your git auth: `git -C ~/your-local-clone fetch`

---

## Log format

See **[docs/log-format.md](docs/log-format.md)** for the full JSON schema.

An anonymized example is at **[examples/sessions.example.json](examples/sessions.example.json)**.

---

## How it works (internals)

Claude Code calls the `statusLine.command` after every response, piping a JSON payload to stdin. The payload includes session ID, model name, context percentage, cumulative token totals, and per-exchange token breakdown.

The script runs an inline Node.js one-liner that:
1. Reads the existing log file
2. Finds or creates the session entry by `session_id`
3. Scans new bytes in the JSONL transcript to detect custom-title renames
4. Detects compact events (cumulative totals decrease)
5. Deduplicates duplicate hook calls (streaming artifacts)
6. Appends the exchange entry and writes the file
7. Outputs a tab-separated string that the bash layer formats for display

See **[docs/setup.md](docs/setup.md)** for a deeper technical explanation.

---

## License

MIT
