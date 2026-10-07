# Log Format

The log is stored as `~/.claude/statusline-sessions.json` (or inside your backup repo if configured).

## Top-level structure

```json
{
  "sessions": {
    "<session_id>": { ... }
  }
}
```

## Session object

```json
{
  "session_id": "a1b2c3d4-...",
  "session_name": "Feature implementation",
  "model": "Sonnet 4.6",
  "started_at": "2026-10-05T10:00:00.000Z",
  "last_activity_at": "2026-10-05T11:52:00.000Z",
  "_state": {
    "total_in": 151200,
    "total_out": 9100,
    "last_ctx": 41
  },
  "log": [ ... ]
}
```

| Field | Description |
|---|---|
| `session_id` | UUID from Claude Code's hook payload; stable across `--resume` |
| `session_name` | User-provided session name, if any |
| `model` | Model display name at last activity |
| `started_at` | ISO timestamp of the first recorded exchange |
| `last_activity_at` | ISO timestamp of the most recent exchange |
| `_state` | Internal tracking state (do not rely on these values) |
| `_state.total_in` | Last seen cumulative input token count (for compact detection) |
| `_state.total_out` | Last seen cumulative output token count (for compact detection) |
| `_state.last_ctx` | Last non-zero context percentage (used for stale display) |

## Log entry: exchange

```json
{
  "at": "2026-10-05T10:18:00.000Z",
  "input_tokens": 1,
  "cache_read_tokens": 101200,
  "cache_write_tokens": 3100,
  "output_tokens": 1250,
  "context_pct": 53
}
```

| Field | Description |
|---|---|
| `at` | ISO timestamp |
| `input_tokens` | Raw (non-cached) input tokens for this exchange |
| `cache_read_tokens` | Tokens served from prompt cache (cheap) |
| `cache_write_tokens` | Tokens written to prompt cache (more expensive) |
| `output_tokens` | Output tokens generated |
| `context_pct` | Context window fill % at the time of this exchange |

**Note:** `cache_write_tokens` spikes after a cold start or `--resume` because the full prompt must be re-cached. Subsequent exchanges in the same session have high `cache_read_tokens` and low `cache_write_tokens`.

## Log entry: compact event

```json
{
  "at": "2026-10-05T11:14:00.000Z",
  "event": "compact",
  "context_pct": 0
}
```

A compact event is recorded when the cumulative token totals decrease (indicating Claude Code condensed the context). `context_pct` is typically 0 at this moment.

## Cache hit rate

```
cache_hit_rate = cache_read_tokens / (input_tokens + cache_read_tokens + cache_write_tokens)
```

A high cache hit rate (>90%) means most input was served from cache, significantly reducing cost.
