#!/usr/bin/env bash
input=$(cat)
PPID_FALLBACK="$PPID"

# --- Optional backup config ---
# Create ~/.claude/statusline-backup.conf to enable background git push.
BACKUP_REPO=""               # absolute path to local git clone
BACKUP_BRANCH="main"
BACKUP_FILE="sessions.json"
BACKUP_PUSH_INTERVAL=600     # min seconds between pushes (default: 10 min)

CONF="$HOME/.claude/statusline-backup.conf"
# shellcheck source=/dev/null
[ -f "$CONF" ] && source "$CONF"

if [ -n "$BACKUP_REPO" ] && [ -d "$BACKUP_REPO/.git" ]; then
  LOG_FILE="$BACKUP_REPO/$BACKUP_FILE"
else
  LOG_FILE="$HOME/.claude/statusline-sessions.json"
fi

result=$(node - "$input" "$LOG_FILE" "$PPID_FALLBACK" 2>/dev/null << 'JSEOF'
const fs = require('fs');
const [,, rawInput, logFile, ppidFallback] = process.argv;

let d = {};
try { d = JSON.parse(rawInput); } catch(e) {}

const sessionId      = d.session_id                             ?? ppidFallback;
const sessionName    = d.session_name                           ?? null;
const transcriptPath = d.transcript_path                        ?? null;
const model          = d.model?.display_name                    ?? 'Unknown';
const used_pct       = d.context_window?.used_percentage        ?? 0;
const total_in       = d.context_window?.total_input_tokens     ?? 0;
const total_out      = d.context_window?.total_output_tokens    ?? 0;
const usage          = d.context_window?.current_usage          ?? {};
const nowIso         = new Date().toISOString();

const input_tokens       = usage.input_tokens                ?? 0;
const cache_read_tokens  = usage.cache_read_input_tokens     ?? 0;
const cache_write_tokens = usage.cache_creation_input_tokens ?? 0;
const output_tokens      = usage.output_tokens               ?? 0;
const exchange_total     = input_tokens + cache_read_tokens + cache_write_tokens + output_tokens;

let data = { sessions: {} };
try { data = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch(e) {}
if (!data.sessions) data.sessions = {};

let sess = data.sessions[sessionId] ?? {
  session_id: sessionId,
  session_name: sessionName,
  model,
  started_at: nowIso,
  last_activity_at: nowIso,
  _state: { total_in: 0, total_out: 0, last_ctx: 0, custom_title: null, title_scan_offset: 0 },
  log: []
};

const st       = sess._state ?? {};
const prev_in  = st.total_in  ?? 0;
const prev_out = st.total_out ?? 0;
const last_ctx = st.last_ctx  ?? 0;

// --- Read custom-title from JSONL transcript (incremental, only new bytes) ---
let custom_title       = st.custom_title       ?? null;
let title_scan_offset  = st.title_scan_offset  ?? 0;

if (transcriptPath) {
  try {
    const stat = fs.statSync(transcriptPath);
    const fileSize = stat.size;
    if (fileSize > title_scan_offset) {
      const readFrom = Math.max(0, title_scan_offset - 100); // slight overlap to avoid partial-line issues
      const buf = Buffer.alloc(fileSize - readFrom);
      const fd = fs.openSync(transcriptPath, 'r');
      fs.readSync(fd, buf, 0, buf.length, readFrom);
      fs.closeSync(fd);
      const text = buf.toString('utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length - 1; i++) { // skip last (may be incomplete)
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'custom-title' && entry.customTitle) {
            custom_title = entry.customTitle;
          }
        } catch(e) {}
      }
      const lastNl = text.lastIndexOf('\n');
      title_scan_offset = readFrom + (lastNl >= 0 ? lastNl + 1 : text.length);
    }
  } catch(e) {}
}

const effectiveName = custom_title ?? sessionName;

const is_compact = (total_in + total_out) < (prev_in + prev_out) && (prev_in + prev_out) > 0;

if (is_compact) {
  sess.log.push({ at: nowIso, event: 'compact', context_pct: used_pct });
} else if (exchange_total > 0) {
  const last = [...sess.log].reverse().find(e => !e.event);
  const is_dup = last &&
    last.input_tokens       === input_tokens &&
    last.cache_read_tokens  === cache_read_tokens &&
    last.cache_write_tokens === cache_write_tokens &&
    last.output_tokens      === output_tokens;
  if (!is_dup) {
    sess.log.push({ at: nowIso, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, context_pct: used_pct });
  }
}

sess._state           = { total_in, total_out, last_ctx: used_pct > 0 ? used_pct : last_ctx, custom_title, title_scan_offset };
sess.model            = model;
sess.last_activity_at = nowIso;
if (effectiveName) sess.session_name = effectiveName;
data.sessions[sessionId] = sess;

try { fs.writeFileSync(logFile, JSON.stringify(data, null, 2)); } catch(e) {}

const session_total = sess.log
  .filter(e => !e.event)
  .reduce((s, e) => s + (e.input_tokens ?? 0) + (e.cache_read_tokens ?? 0) + (e.cache_write_tokens ?? 0) + (e.output_tokens ?? 0), 0);

const display_ctx   = used_pct === 0 && last_ctx > 0 ? last_ctx : used_pct;
const ctx_was_stale = used_pct === 0 && last_ctx > 0;
const tok_k         = session_total >= 1e9 ? (session_total / 1e9).toFixed(1) + 'B'
                    : session_total >= 1e6 ? (session_total / 1e6).toFixed(1) + 'M'
                    : session_total >= 1e3 ? (session_total / 1e3).toFixed(1) + 'k'
                    : String(session_total);
const ctx_int       = Math.round(display_ctx);
const ctx_color     = display_ctx >= 80 ? '31' : display_ctx >= 60 ? '33' : '32';
const ctx_suffix    = ctx_was_stale ? '~' : '%';

process.stdout.write([model, ctx_int, ctx_color, ctx_suffix, tok_k].join('\t'));
JSEOF
)

IFS=$'\t' read -r model ctx_int ctx_color ctx_suffix tok_k <<< "$result"
[ -z "$model" ] && { model="Unknown"; ctx_int=0; ctx_color=32; ctx_suffix="%"; tok_k="0"; }

# --- Background backup (if configured) ---
if [ -n "$BACKUP_REPO" ] && [ -d "$BACKUP_REPO/.git" ]; then
  (
    cd "$BACKUP_REPO" || exit
    git add "$BACKUP_FILE"
    if ! git diff --cached --quiet; then
      git commit -m "auto: $(date -u +%Y-%m-%dT%H:%M:%SZ)" --quiet
      NOW=$(date +%s)
      LAST=$(cat .last_push 2>/dev/null || echo 0)
      if [ $(( NOW - LAST )) -gt "$BACKUP_PUSH_INTERVAL" ]; then
        git push origin "$BACKUP_BRANCH" --quiet 2>/dev/null && echo "$NOW" > .last_push
      fi
    fi
  ) &>/dev/null &
fi

CYAN='\033[36m'
RESET='\033[0m'
MAGENTA='\033[35m'

printf "Model: ${CYAN}%s${RESET} | Context: \033[%sm%s%s\033[0m | Tokens: ${MAGENTA}%s${RESET}\n" \
    "$model" "$ctx_color" "$ctx_int" "$ctx_suffix" "$tok_k"
