// ---- Render ----
function renderAll() {
  const sessions = Object.values(globalData.sessions)
    .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at));

  let totalTok = 0, totalComp = 0, totalCR = 0, totalIn = 0;
  for (const s of sessions) {
    const st = sessStats(s);
    totalTok += st.total;
    totalComp += st.compacts;
    totalCR  += st.exch.reduce((x, e) => x + e.cache_read_tokens, 0);
    totalIn  += st.exch.reduce((x, e) => x + e.input_tokens + e.cache_read_tokens + e.cache_write_tokens, 0);
  }

  document.getElementById('s-count').textContent    = sessions.length;
  document.getElementById('s-tokens').textContent   = fmtN(totalTok);
  document.getElementById('s-cache').textContent    = totalIn > 0 ? Math.round(totalCR / totalIn * 100) + '%' : '—';
  document.getElementById('s-compacts').textContent = totalComp;

  initDailySection();

  const list = document.getElementById('sessions');
  list.innerHTML = '';
  sessions.forEach((sess, i) => {
    const st = sessStats(sess);
    const el = document.createElement('div');
    el.className = 'sess-item';
    el.innerHTML = `
      <div class="sess-name" title="${sess.session_name || sess.session_id}">${sess.session_name || sess.session_id.slice(0, 8)}</div>
      <div class="sess-meta">${sess.model}</div>
      <div class="sess-meta">${fmtN(st.total)} &middot; ${fmtDt(sess.started_at)}</div>
    `;
    el.onclick = () => {
      document.querySelectorAll('.sess-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      renderDetail(sess);
    };
    list.appendChild(el);
    if (i === 0) { el.classList.add('active'); renderDetail(sess); }
  });
}

function renderDetail(sess) {
  const st = sessStats(sess);
  const detail = document.getElementById('detail');

  detail.innerHTML = `
    <div class="detail-header">
      <h2>${sess.session_name || sess.session_id}</h2>
      <p>${sess.model} &middot; ${fmtDt(sess.started_at)} &middot; ${fmtDur(sess.started_at, sess.last_activity_at)} &middot; ${st.exch.length} exchanges</p>
    </div>
    <div class="detail-stats">
      <div><div class="ds-label">Total tokens</div><div class="ds-val">${fmtN(st.total)}</div></div>
      <div><div class="ds-label">Cache hit rate</div><div class="ds-val">${Math.round(st.cacheHit)}%</div></div>
      <div><div class="ds-label">Compacts</div><div class="ds-val">${st.compacts}</div></div>
      <div><div class="ds-label">Last context</div><div class="ds-val">${sess._state?.last_ctx ?? '—'}%</div></div>
    </div>
    <div class="chart-section">
      <h3>Tokens per Exchange</h3>
      <div class="legend">
        <span><span class="dot" style="background:${TC.input}"></span>Input</span>
        <span><span class="dot" style="background:${TC.cache_read}"></span>Cache read</span>
        <span><span class="dot" style="background:${TC.cache_write}"></span>Cache write</span>
        <span><span class="dot" style="background:${TC.output}"></span>Output</span>
        <span style="color:var(--orange)">&#10072; Compact</span>
      </div>
      <div class="chart-wrap"><canvas id="c-tok"></canvas></div>
    </div>
    <div class="chart-section">
      <h3>Context Window Usage</h3>
      <div class="chart-wrap"><canvas id="c-ctx"></canvas></div>
    </div>
    <div class="log-section">
      <h3>Exchange Log</h3>
      ${buildLogTable(st.log)}
    </div>
  `;

  buildCharts(st.log);
}
