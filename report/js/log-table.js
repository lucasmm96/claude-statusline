function buildLogTable(log) {
  let rows = '', i = 0;
  for (const e of log) {
    if (e.event === 'compact') {
      rows += `<tr class="compact-row"><td colspan="8">⚡ Compact — context reset to ${e.context_pct}%</td></tr>`;
    } else {
      i++;
      const t = e.input_tokens + e.cache_read_tokens + e.cache_write_tokens + e.output_tokens;
      rows += `<tr>
        <td>${i}</td><td>${fmtDt(e.at)}</td>
        <td>${fmtN(e.input_tokens)}</td><td>${fmtN(e.cache_read_tokens)}</td>
        <td>${fmtN(e.cache_write_tokens)}</td><td>${fmtN(e.output_tokens)}</td>
        <td>${fmtN(t)}</td><td>${e.context_pct}%</td>
      </tr>`;
    }
  }
  return `<table class="log">
    <thead><tr><th>#</th><th>Time</th><th>Input</th><th>Cache rd</th><th>Cache wr</th><th>Output</th><th>Total</th><th>Ctx</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
