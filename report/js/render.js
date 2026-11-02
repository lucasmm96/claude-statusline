// ---- Render ----
let activeSessId      = null;
let activeSessLogLen  = 0;
let activeSessLastAt  = '';
let activePricingJson = null;

function renderProfileBar() {
  const profiles = [...new Set(
    Object.values(globalData.sessions).map(s => s.profile).filter(Boolean)
  )].sort();

  const all = Object.values(globalData.sessions);
  const hasOther = all.some(s => !s.profile);

  const bar = document.getElementById('profile-bar');
  if (!profiles.length && !hasOther) { bar.hidden = true; activeProfile = null; return; }

  bar.hidden = false;
  const pills = document.getElementById('profile-pills');
  pills.innerHTML = '';

  const makeBtn = (label, value) => {
    const b = document.createElement('button');
    b.className = 'profile-btn' + (activeProfile === value ? ' active' : '');
    b.textContent = label;
    b.onclick = () => { activeProfile = value; renderAll(); };
    pills.appendChild(b);
  };

  makeBtn('All', null);
  profiles.forEach(p => makeBtn(p, p));
  if (hasOther) makeBtn('Other', '__other__');
}

function renderAll() {
  const sessions = getFilteredSessions()
    .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at));

  let statCount = 0, totalTok = 0, totalComp = 0, totalCR = 0, totalIn = 0;
  for (const s of sessions) {
    const log = dedupe(s.log || []);
    const exch = log.filter(e => !e.event && isInDateRange(e.at));
    const compacts = log.filter(e => e.event === 'compact' && isInDateRange(e.at)).length;
    if (exch.length > 0 || compacts > 0) statCount++;
    totalTok  += exch.reduce((x, e) => x + e.input_tokens + e.cache_read_tokens + e.cache_write_tokens + e.output_tokens, 0);
    totalComp += compacts;
    totalCR   += exch.reduce((x, e) => x + e.cache_read_tokens, 0);
    totalIn   += exch.reduce((x, e) => x + e.input_tokens + e.cache_read_tokens + e.cache_write_tokens, 0);
  }

  document.getElementById('s-count').textContent    = statCount;
  document.getElementById('s-tokens').textContent   = fmtN(totalTok);
  document.getElementById('s-cache').textContent    = totalIn > 0 ? Math.round(totalCR / totalIn * 100) + '%' : '—';
  document.getElementById('s-compacts').textContent = totalComp;

  const pricing = getPricing();
  const costStat = document.getElementById('s-cost-stat');
  const statBar  = document.getElementById('stat-bar');
  if (pricing) {
    let cost = 0, unpriced = 0;
    for (const s of sessions) {
      const modelName = s.model || 'Unknown';
      const hasModelPrice = pricing.prices[modelName] !== undefined;
      const defaultIsEmpty = pricing._default.input === 0 && pricing._default.cacheRead === 0 &&
                             pricing._default.cacheWrite === 0 && pricing._default.output === 0;
      const modelPrice = pricing.prices[modelName] || pricing._default;
      const log = dedupe(s.log || []);
      for (const e of log) {
        if (e.event || !isInDateRange(e.at)) continue;
        if (!hasModelPrice && defaultIsEmpty) {
          unpriced += (e.input_tokens || 0) + (e.cache_read_tokens || 0) +
                      (e.cache_write_tokens || 0) + (e.output_tokens || 0);
        } else {
          cost += (e.input_tokens       || 0) / 1e6 * modelPrice.input;
          cost += (e.cache_read_tokens  || 0) / 1e6 * modelPrice.cacheRead;
          cost += (e.cache_write_tokens || 0) / 1e6 * modelPrice.cacheWrite;
          cost += (e.output_tokens      || 0) / 1e6 * modelPrice.output;
        }
      }
    }
    let costText = fmtCost(cost);
    if (unpriced > 0) costText += ` <span class="cost-warning">⚠ ${fmtN(unpriced)} unpriced</span>`;
    document.getElementById('s-cost').innerHTML = costText;
    costStat.style.display = '';
    statBar.classList.add('has-cost');
  } else {
    costStat.style.display = 'none';
    statBar.classList.remove('has-cost');
  }

  // Snapshot of active state before DOM rebuild
  const prevId     = activeSessId;
  const prevLogLen = activeSessLogLen;
  const prevLastAt = activeSessLastAt;
  const detailEl   = document.getElementById('detail');
  const prevScroll = detailEl ? detailEl.scrollTop : 0;

  const list = document.getElementById('sessions');
  list.innerHTML = '';
  let activeItem = null;

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
      activeSessId = sess.session_id;
      renderDetail(sess);
    };
    list.appendChild(el);

    // Restore or default active item
    if (prevId ? sess.session_id === prevId : i === 0) {
      el.classList.add('active');
      activeItem = { el, sess };
    }
  });

  // Fallback: first session if prev selection not found
  if (!activeItem && sessions.length) {
    const firstEl = list.querySelector('.sess-item');
    if (firstEl) { firstEl.classList.add('active'); activeItem = { el: firstEl, sess: sessions[0] }; }
  }

  if (activeItem) {
    const { sess } = activeItem;
    activeSessId = sess.session_id;

    // Only re-render detail if this session's data or pricing changed
    const currentPricingJson = JSON.stringify(getPricing());
    const dataChanged = !prevId ||
      sess.last_activity_at !== prevLastAt ||
      (sess.log || []).length !== prevLogLen ||
      currentPricingJson !== activePricingJson;
    activePricingJson = currentPricingJson;

    if (dataChanged) {
      renderDetail(sess);
    } else {
      if (detailEl) detailEl.scrollTop = prevScroll;
    }
  }

  renderProfileBar();
  initDailySection();
}

function renderDetail(sess) {
  // Track for change detection on next renderAll
  activeSessLogLen = (sess.log || []).length;
  activeSessLastAt = sess.last_activity_at || '';

  const st     = sessStats(sess);
  const detail = document.getElementById('detail');

  const pricing = getPricing();
  const modelPrice = pricing
    ? (pricing.prices[sess.model || ''] || pricing._default)
    : null;

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
      ${buildLogTable(st.log, modelPrice)}
    </div>
  `;

  buildCharts(st.log);
}
