// ---- Pricing ----
function getPricing() {
  try {
    const rawIn  = localStorage.getItem(LS_PRICE_INPUT);
    const rawCR  = localStorage.getItem(LS_PRICE_CACHE_READ);
    const rawCW  = localStorage.getItem(LS_PRICE_CACHE_WRITE);
    const rawOut = localStorage.getItem(LS_PRICE_OUTPUT);
    if (rawIn === null && rawCR === null && rawCW === null && rawOut === null) return null;
    return {
      pIn:  parseFloat(rawIn)  || 0,
      pCR:  parseFloat(rawCR)  || 0,
      pCW:  parseFloat(rawCW)  || 0,
      pOut: parseFloat(rawOut) || 0,
    };
  } catch(e) { return null; }
}

function calcCost(sessions, pricing) {
  let cost = 0;
  for (const s of Object.values(sessions)) {
    const log = dedupe(s.log || []);
    for (const e of log) {
      if (e.event) continue;
      cost += (e.input_tokens       || 0) / 1e6 * pricing.pIn;
      cost += (e.cache_read_tokens  || 0) / 1e6 * pricing.pCR;
      cost += (e.cache_write_tokens || 0) / 1e6 * pricing.pCW;
      cost += (e.output_tokens      || 0) / 1e6 * pricing.pOut;
    }
  }
  return cost;
}

function fmtCost(usd) {
  if (usd >= 1000) return '$' + (usd / 1000).toFixed(1) + 'k';
  return '$' + usd.toFixed(2);
}

// ---- Pricing modal ----
function openPricingModal() {
  let pIn = '', pCR = '', pCW = '', pOut = '';
  try {
    pIn  = localStorage.getItem(LS_PRICE_INPUT)       || '';
    pCR  = localStorage.getItem(LS_PRICE_CACHE_READ)  || '';
    pCW  = localStorage.getItem(LS_PRICE_CACHE_WRITE) || '';
    pOut = localStorage.getItem(LS_PRICE_OUTPUT)      || '';
  } catch(e) {}
  document.getElementById('p-input').value  = pIn;
  document.getElementById('p-cr').value     = pCR;
  document.getElementById('p-cw').value     = pCW;
  document.getElementById('p-output').value = pOut;
  const hasPricing = [pIn, pCR, pCW, pOut].some(v => v !== '');
  document.getElementById('p-clear-btn').style.display = hasPricing ? 'inline-flex' : 'none';
  document.getElementById('pricing-modal-overlay').classList.add('open');
  document.getElementById('p-input').focus();
}

function closePricingModal() {
  document.getElementById('pricing-modal-overlay').classList.remove('open');
}

function savePrices() {
  const pIn  = document.getElementById('p-input').value.trim();
  const pCR  = document.getElementById('p-cr').value.trim();
  const pCW  = document.getElementById('p-cw').value.trim();
  const pOut = document.getElementById('p-output').value.trim();
  try {
    if (pIn)  localStorage.setItem(LS_PRICE_INPUT,       pIn);  else localStorage.removeItem(LS_PRICE_INPUT);
    if (pCR)  localStorage.setItem(LS_PRICE_CACHE_READ,  pCR);  else localStorage.removeItem(LS_PRICE_CACHE_READ);
    if (pCW)  localStorage.setItem(LS_PRICE_CACHE_WRITE, pCW);  else localStorage.removeItem(LS_PRICE_CACHE_WRITE);
    if (pOut) localStorage.setItem(LS_PRICE_OUTPUT,      pOut); else localStorage.removeItem(LS_PRICE_OUTPUT);
  } catch(e) {}
  closePricingModal();
  if (globalData) renderAll();
}

function clearPrices() {
  if (!confirm('Remove saved pricing from this browser?')) return;
  try {
    localStorage.removeItem(LS_PRICE_INPUT);
    localStorage.removeItem(LS_PRICE_CACHE_READ);
    localStorage.removeItem(LS_PRICE_CACHE_WRITE);
    localStorage.removeItem(LS_PRICE_OUTPUT);
  } catch(e) {}
  closePricingModal();
  if (globalData) renderAll();
}

// Overlay click + focus trap
document.getElementById('pricing-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('pricing-modal-overlay')) closePricingModal();
});
document.getElementById('pricing-modal-overlay').addEventListener('keydown', e => {
  if (!document.getElementById('pricing-modal-overlay').classList.contains('open')) return;
  if (e.key !== 'Tab') return;
  const focusable = Array.from(
    document.querySelector('#pricing-modal-overlay .modal').querySelectorAll('button:not([disabled]), input:not([disabled])')
  );
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
});
