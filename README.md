# claude-statusline

A Claude Code statusline hook that persists token usage and context window data across sessions — including `/compact` resets and `--resume` reopens.

```
Model: Sonnet 4.6 | Context: 42% | Tokens: 1.2M
```

- Context % survives `/compact` (shows stale value with `~` until the next real reading)
- Token counter accumulates across the entire session, including after compacts
- Session identity is tied to Claude Code's `session_id` UUID — survives `--resume`
- Logs per-exchange token breakdown to a JSON file for later analysis
- Optional: auto-push the log to a private git repo in the background

## Requirements

- [Claude Code](https://claude.ai/code) CLI
- Bash (on Windows: Git Bash or WSL)
- Node.js (any recent version)
- Git (optional, for backup feature)

## Installation

**1. Copy the script:**

```bash
mkdir -p ~/.claude
curl -o ~/.claude/statusline-command.sh \
  https://raw.githubusercontent.com/YOUR_USERNAME/claude-statusline/main/scripts/statusline-command.sh
chmod +x ~/.claude/statusline-command.sh
```

Or clone this repo and copy manually:

```bash
cp scripts/statusline-command.sh ~/.claude/statusline-command.sh
```

**2. Add to Claude Code settings** (`~/.claude/settings.json`):

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.claude/statusline-command.sh"
  }
}
```

**3. Start a Claude Code session** — the statusline appears after each response.

The log file is created at `~/.claude/statusline-sessions.json`.

## Report page

Open `report/index.html` in your browser, then click **Load file** and select your `statusline-sessions.json`.

Alternatively, if the JSON is at a public URL (e.g. a raw GitHub URL):

```
report/index.html?data=https://raw.githubusercontent.com/user/repo/main/sessions.json
```

The report shows per-session token breakdowns, cache hit rates, context usage timelines, and compact events.

## Optional: private repo backup

The script can automatically commit and push your log to a private git repository after each Claude Code response. See **[docs/backup.md](docs/backup.md)** for setup instructions.

This is completely optional — if you don't create the config file, the script works exactly as without it.

## Log format

See **[docs/log-format.md](docs/log-format.md)** for the full JSON schema.

An anonymized example is at **[examples/sessions.example.json](examples/sessions.example.json)**.

## How it works

The script is invoked by Claude Code's `statusLine` hook after each response. It receives a JSON payload on stdin with session metadata and token counts. A Node.js one-liner reads, updates, and writes the log atomically, then outputs the formatted statusline string.

See **[docs/setup.md](docs/setup.md)** for a deeper explanation and troubleshooting.

## License

MIT
