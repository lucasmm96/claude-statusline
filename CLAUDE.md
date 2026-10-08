# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A Claude Code statusline hook that persists token usage and context window data across sessions. Users install `scripts/statusline-command.sh` into `~/.claude/` and register it in `~/.claude/settings.json`. There is no build step, no package.json, and no test suite.

## Files

- **`scripts/statusline-command.sh`** — the primary deliverable. A bash script with an embedded `node -` one-liner (no npm deps). Claude Code calls it after every response, piping a JSON payload to stdin.
- **`report/index.html`** — a zero-dependency standalone SPA (uses CDN Chart.js). Opens directly in any browser. All data loading and rendering is self-contained in this single file.
- **`examples/sessions.example.json`** — anonymized sample data. Update this when the log schema changes.
- **`docs/`** — user-facing documentation. `log-format.md` is the authoritative schema reference.

## Architecture

### Hook pipeline (`statusline-command.sh`)

1. Bash reads the full stdin payload into `$input`
2. Passes it to an inline `node -` script via heredoc (`JSEOF`)
3. Node.js parses the JSON, reads `statusline-sessions.json`, finds/creates the session by `session_id`, then:
   - Detects compact events: `(total_in + total_out)` decreasing vs previous
   - Deduplicates streaming artifacts: identical token values on consecutive calls
   - Scans new bytes of the JSONL transcript (from `title_scan_offset`) for `custom-title` events
   - Writes the updated JSON back to disk
   - Outputs a tab-separated string: `model\tctx_int\tctx_color\tctx_suffix\ttok_k`
4. Bash reads those five fields and formats the final colored statusline string
5. If `BACKUP_REPO` is configured, a background subshell runs `git add/commit/push`

### Session state (`_state` object)

`_state` is the script's internal memory across calls. Key fields:
- `total_in` / `total_out` — last cumulative totals, used for compact detection
- `last_ctx` — last non-zero context %, shown with `~` suffix when current reading is 0
- `custom_title` / `title_scan_offset` — incremental JSONL scan position for session renames

### Report page (`report/index.html`)

Three data-loading paths, all converge to the same `render(data)` function:
- **Local file**: FileReader API
- **Public URL**: `fetch()` with CORS
- **Private GitHub repo**: `fetch()` to `api.github.com` with `Authorization: token <PAT>`, credentials stored in `localStorage`

## Testing changes to the script

Test the script manually by piping a sample payload:

```bash
echo '{"session_id":"test-123","model":{"display_name":"Sonnet 4.6"},"context_window":{"used_percentage":42,"total_input_tokens":100000,"total_output_tokens":5000,"current_usage":{"input_tokens":10,"cache_read_input_tokens":80000,"cache_creation_input_tokens":1000,"output_tokens":500}}}' | bash scripts/statusline-command.sh
```

To test with an empty/malformed payload (should degrade gracefully):

```bash
echo '{}' | bash scripts/statusline-command.sh
```

The Node.js portion can be extracted and run with `node -e` for isolated debugging.

## Key invariants

- **No npm dependencies** — the Node.js one-liner uses only built-in `fs` and `process`. Keep it that way.
- **Idempotent writes** — duplicate hook calls (streaming artifacts) must not produce duplicate log entries. The dedup check compares all four token fields.
- **`session_id` is the stable key** — not `$PPID`. The `session_id` from the hook payload survives `--resume`.
- **Stale context display** — when `used_percentage` is 0 and `last_ctx > 0`, show `last_ctx` with `~` suffix, not `0%`.
- **Compact detection** — compare cumulative totals to previous, not per-exchange totals. A compact resets cumulative totals to lower values.
