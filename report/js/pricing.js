// ---- Pricing storage format ----
// New: { "prices": { "Sonnet 4.6": { input, cacheRead, cacheWrite, output }, ... }, "_default": { ... } }
// Old (legacy): root level LS_PRICE_INPUT, LS_PRICE_CACHE_READ, etc

function migrateOldPrices() {
  try {
    const rawIn  = localStorage.getItem(LS_PRICE_INPUT);
    const rawCR  = localStorage.getItem(LS_PRICE_CACHE_READ);
    const rawCW  = localStorage.getItem(LS_PRICE_CACHE_WRITE);
    const rawOut = localStorage.getItem(LS_PRICE_OUTPUT);
    if (rawIn === null && rawCR === null && rawCW === null && rawOut === null) return false;
    const data = getPricingData();
    data._default = {
      input: parseFloat(rawIn) || 0,
      cacheRead: parseFloat(rawCR) || 0,
      cacheWrite: parseFloat(rawCW) || 0,
      output: parseFloat(rawOut) || 0,
    };
    savePricingData(data);
    localStorage.removeItem(LS_PRICE_INPUT);
    localStorage.removeItem(LS_PRICE_CACHE_READ);
    localStorage.removeItem(LS_PRICE_CACHE_WRITE);
    localStorage.removeItem(LS_PRICE_OUTPUT);
    return true;
  } catch(e) { return false; }
}

function getPricingData() {
  try {
    const raw = localStorage.getItem('claude_usage_stats_pricing');
    if (!raw) return { prices: {}, _default: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 } };
    return JSON.parse(raw);
  } catch(e) { return { prices: {}, _default: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 } }; }
}

function savePricingData(data) {
  try {
    localStorage.setItem('claude_usage_stats_pricing', JSON.stringify(data));
  } catch(e) {}
}

function getPricing() {
  migrateOldPrices();
  const data = getPricingData();
  const isEmpty = Object.keys(data.prices).length === 0 &&
    (data._default.input === 0 && data._default.cacheRead === 0 &&
     data._default.cacheWrite === 0 && data._default.output === 0);
  return isEmpty ? null : data;
}

function calcCost(sessions, pricingData) {
  let cost = 0;
  for (const s of sessions) {
    const log = dedupe(s.log || []);
    for (const e of log) {
      if (e.event) continue;
      const mp = entryModelPrice(e, s.model, pricingData);
      cost += (e.input_tokens       || 0) / 1e6 * mp.input;
      cost += (e.cache_read_tokens  || 0) / 1e6 * mp.cacheRead;
      cost += (e.cache_write_tokens || 0) / 1e6 * mp.cacheWrite;
      cost += (e.output_tokens      || 0) / 1e6 * mp.output;
    }
  }
  return cost;
}

function calcUnpricedTokens(sessions, pricingData) {
  let unpriced = 0;
  const defaultPrice = pricingData._default;
  const defaultIsEmpty = defaultPrice.input === 0 && defaultPrice.cacheRead === 0 &&
                         defaultPrice.cacheWrite === 0 && defaultPrice.output === 0;
  for (const s of sessions) {
    const log = dedupe(s.log || []);
    for (const e of log) {
      if (e.event) continue;
      const key = e.model || s.model || '';
      const hasPrice = pricingData.prices[key] !== undefined;
      if (!hasPrice && defaultIsEmpty) {
        unpriced += (e.input_tokens || 0) + (e.cache_read_tokens || 0) +
                    (e.cache_write_tokens || 0) + (e.output_tokens || 0);
      }
    }
  }
  return unpriced;
}

function extractModelsFromLog(sessions) {
  const models = new Set();
  for (const s of Object.values(sessions)) {
    if (s.model) models.add(s.model);
    for (const e of (Array.isArray(s.log) ? s.log : [])) {
      if (!e.event && e.model) models.add(e.model);
    }
  }
  return Array.from(models).sort();
}

function groupModelsByFamily(models) {
  const families = { Sonnet: [], Opus: [], Haiku: [], Fable: [], Other: [] };
  for (const m of models) {
    if (m.includes('Sonnet')) families.Sonnet.push(m);
    else if (m.includes('Opus')) families.Opus.push(m);
    else if (m.includes('Haiku')) families.Haiku.push(m);
    else if (m.includes('Fable')) families.Fable.push(m);
    else families.Other.push(m);
  }
  return Object.entries(families).filter(([, v]) => v.length > 0);
}

function fmtCost(usd) {
  if (usd >= 1000) return '$' + (usd / 1000).toFixed(1) + 'k';
  return '$' + usd.toFixed(2);
}

// ---- Pricing modal (multi-model) ----
function openPricingModal() {
  if (!globalData) return;
  const allModels = extractModelsFromLog(globalData.sessions);
  const grouped = groupModelsByFamily(allModels);
  const data = getPricingData();

  const select = document.getElementById('p-model-select');
  select.innerHTML = '';

  for (const [family, models] of grouped) {
    const optg = document.createElement('optgroup');
    optg.label = family;
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m;
      const hasPrice = data.prices[m] !== undefined;
      opt.textContent = hasPrice ? `${m} — $${data.prices[m].input}/MTok` : `⚠ ${m}`;
      optg.appendChild(opt);
    }
    select.appendChild(optg);
  }

  const optg = document.createElement('optgroup');
  optg.label = 'Add new';
  const opt = document.createElement('option');
  opt.value = '__new__';
  opt.textContent = 'Other / Add manually';
  optg.appendChild(opt);
  select.appendChild(optg);

  select.value = allModels[0] || '__new__';
  loadModelPrices();
  updateUnpricedBadge();

  const hasPricing = Object.keys(data.prices).length > 0;
  document.getElementById('p-clear-btn').style.display = hasPricing ? 'inline-flex' : 'none';

  rebuildConfiguredList(data);

  document.getElementById('pricing-modal-overlay').classList.add('open');
  select.focus();
}

function setFieldsDisabled(disabled) {
  ['p-input', 'p-cr', 'p-cw', 'p-output'].forEach(id => {
    const el = document.getElementById(id);
    el.disabled = disabled;
    if (disabled) el.value = '0';
  });
}

function onFreeToggle() {
  const checked = document.getElementById('p-free-cb').checked;
  setFieldsDisabled(checked);
}

function loadModelPrices() {
  const select = document.getElementById('p-model-select');
  const modelName = select.value;
  const data = getPricingData();

  const freeField = document.getElementById('p-free-field');
  const freeCb    = document.getElementById('p-free-cb');

  if (modelName === '__new__') {
    document.getElementById('p-model-name-field').style.display = '';
    document.getElementById('p-model-name').value = '';
    document.getElementById('p-model-name').focus();
    document.getElementById('p-model-display-field').style.display = 'none';
    freeField.style.display = '';
    freeCb.checked = false;
    setFieldsDisabled(false);
    document.getElementById('p-input').value  = '';
    document.getElementById('p-cr').value     = '';
    document.getElementById('p-cw').value     = '';
    document.getElementById('p-output').value = '';
  } else {
    document.getElementById('p-model-name-field').style.display = 'none';
    document.getElementById('p-model-display-field').style.display = '';
    document.getElementById('p-model-display').textContent = modelName;
    freeField.style.display = '';
    const price = data.prices[modelName];
    const isFree = price !== undefined &&
      price.input === 0 && price.cacheRead === 0 &&
      price.cacheWrite === 0 && price.output === 0;
    freeCb.checked = isFree;
    setFieldsDisabled(isFree);
    document.getElementById('p-input').value  = price ? (price.input  || '') : '';
    document.getElementById('p-cr').value     = price ? (price.cacheRead  || '') : '';
    document.getElementById('p-cw').value     = price ? (price.cacheWrite || '') : '';
    document.getElementById('p-output').value = price ? (price.output || '') : '';
  }
}

function updateUnpricedBadge() {
  if (!globalData) return;
  const select = document.getElementById('p-model-select');
  if (!select) return;
  const data = getPricingData();
  let unpricedCount = 0;
  for (const opt of select.options) {
    if (opt.value === '__new__') continue;
    const hasPrice = data.prices[opt.value] !== undefined;
    if (hasPrice) {
      opt.textContent = `${opt.value} — $${data.prices[opt.value].input}/MTok`;
    } else {
      opt.textContent = `⚠ ${opt.value}`;
      unpricedCount++;
    }
  }
  const field = select.closest('.field');
  if (!field) return;
  let badge = field.querySelector('.unpriced-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'unpriced-badge';
    field.querySelector('label').appendChild(badge);
  }
  badge.textContent = unpricedCount > 0 ? `${unpricedCount} unpriced` : '';
  badge.hidden = unpricedCount === 0;
}

function rebuildConfiguredList(data) {
  const list = document.getElementById('p-configured-list');
  list.innerHTML = '';
  for (const [model, price] of Object.entries(data.prices)) {
    const item = document.createElement('div');
    item.className = 'price-item';
    item.innerHTML = `
      <span><strong>${model}</strong></span>
      <span class="price-val">${price.input}/${price.cacheRead}/${price.cacheWrite}/${price.output}</span>
      <button class="btn-remove" onclick="removeModel('${model.replace(/'/g, "\\'")}')">✕</button>
    `;
    list.appendChild(item);
  }
}

function removeModel(modelName) {
  const data = getPricingData();
  delete data.prices[modelName];
  savePricingData(data);
  rebuildConfiguredList(data);
  const select = document.getElementById('p-model-select');
  select.value = '__new__';
  loadModelPrices();
}

function closePricingModal() {
  document.getElementById('pricing-modal-overlay').classList.remove('open');
}

function updatePricingButton() {
  const btn = document.getElementById('pricing-btn');
  if (!btn) return;
  if (getPricing()) {
    btn.textContent = '🪙 Pricing ✓';
    btn.classList.add('btn-connected');
  } else {
    btn.textContent = 'Pricing';
    btn.classList.remove('btn-connected');
  }
}

function savePrices() {
  const select = document.getElementById('p-model-select');
  const pIn  = parseFloat(document.getElementById('p-input').value) || 0;
  const pCR  = parseFloat(document.getElementById('p-cr').value) || 0;
  const pCW  = parseFloat(document.getElementById('p-cw').value) || 0;
  const pOut = parseFloat(document.getElementById('p-output').value) || 0;

  let modelName = select.value;
  if (modelName === '__new__') {
    modelName = document.getElementById('p-model-name').value.trim();
    if (!modelName) { alert('Model name is required'); return; }
  }

  const data = getPricingData();
  data.prices[modelName] = { input: pIn, cacheRead: pCR, cacheWrite: pCW, output: pOut };
  savePricingData(data);
  updatePricingButton();

  select.value = modelName;
  loadModelPrices();
  rebuildConfiguredList(data);
  updateUnpricedBadge();
  if (globalData) renderAll();
}

function clearPrices() {
  if (!confirm('Remove all saved pricing from this browser?')) return;
  try {
    localStorage.removeItem('claude_usage_stats_pricing');
  } catch(e) {}
  updatePricingButton();
  closePricingModal();
  if (globalData) renderAll();
}

// Events (only in browser)
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('p-model-select');
    if (select) select.addEventListener('change', loadModelPrices);
  });
}

// Overlay click + focus trap (only in browser)
if (typeof document !== 'undefined') {
  updatePricingButton();
  document.getElementById('pricing-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('pricing-modal-overlay')) closePricingModal();
  });
  document.getElementById('pricing-modal-overlay').addEventListener('keydown', e => {
    if (!document.getElementById('pricing-modal-overlay').classList.contains('open')) return;
    if (e.key !== 'Tab') return;
    const focusable = Array.from(
      document.querySelector('#pricing-modal-overlay .modal').querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')
    );
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });
}
