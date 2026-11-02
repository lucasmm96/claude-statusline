function buildLogTable(log, modelPrice) {
  let rows = '', i = 0;
  const cols = modelPrice ? 9 : 8;
  const numbered = log.map(e => ({ ...e, _n: e.event === 'compact' ? null : ++i }));
  const sorted = [...numbered].sort((a, b) => new Date(b.at) - new Date(a.at));
  for (const e of sorted) {
    if (e.event === 'compact') {
      rows += `<tr class="compact-row"><td colspan="${cols}">⚡ Compact — context reset to ${e.context_pct}%</td></tr>`;
    } else {
      const t = e.input_tokens + e.cache_read_tokens + e.cache_write_tokens + e.output_tokens;
      const costCell = modelPrice
        ? '<td>' + fmtCost(
            (e.input_tokens        || 0) / 1e6 * modelPrice.input +
            (e.cache_read_tokens   || 0) / 1e6 * modelPrice.cacheRead +
            (e.cache_write_tokens  || 0) / 1e6 * modelPrice.cacheWrite +
            (e.output_tokens       || 0) / 1e6 * modelPrice.output
          ) + '</td>'
        : '';
      rows += `<tr>
        <td>${e._n}</td><td>${fmtDt(e.at)}</td>
        <td>${fmtN(e.input_tokens)}</td><td>${fmtN(e.cache_read_tokens)}</td>
        <td>${fmtN(e.cache_write_tokens)}</td><td>${fmtN(e.output_tokens)}</td>
        <td>${fmtN(t)}</td>${costCell}<td>${e.context_pct}%</td>
      </tr>`;
    }
  }
  const costHeader = modelPrice ? '<th>Cost</th>' : '';
  return `<table class="log">
    <thead><tr><th>#</th><th>Time</th><th>Input</th><th>Cache rd</th><th>Cache wr</th><th>Output</th><th>Total</th>${costHeader}<th>Ctx</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
