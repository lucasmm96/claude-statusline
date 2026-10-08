// ---- Helpers ----
function fmtN(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
function fmtDt(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDur(a, b) {
  const m = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
  return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}
function dedupe(log) {
  const out = [];
  for (const e of log) {
    if (e.event) { out.push(e); continue; }
    const prev = [...out].reverse().find(x => !x.event);
    if (prev &&
        prev.input_tokens === e.input_tokens &&
        prev.cache_read_tokens === e.cache_read_tokens &&
        prev.cache_write_tokens === e.cache_write_tokens &&
        prev.output_tokens === e.output_tokens) continue;
    out.push(e);
  }
  return out;
}
function sessStats(sess) {
  const log = dedupe(sess.log || []);
  const exch = log.filter(e => !e.event);
  const compacts = log.filter(e => e.event === 'compact').length;
  const total = exch.reduce((s, e) => s + e.input_tokens + e.cache_read_tokens + e.cache_write_tokens + e.output_tokens, 0);
  const cr = exch.reduce((s, e) => s + e.cache_read_tokens, 0);
  const totalIn = exch.reduce((s, e) => s + e.input_tokens + e.cache_read_tokens + e.cache_write_tokens, 0);
  const cacheHit = totalIn > 0 ? cr / totalIn * 100 : 0;
  return { log, exch, compacts, total, cacheHit };
}
