// ---- Database / API loader ----

async function fetchFromApi(apiUrl, apiKey) {
  // Empty apiUrl = same-origin (report and API on the same Vercel deployment)
  const base = (apiUrl || '').replace(/\/$/, '');
  const url = base + '/api/sessions';
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (res.status === 401) throw new Error('Invalid API key (401 Unauthorized)');
  if (res.status === 403) throw new Error('Access denied (403 Forbidden)');
  if (res.status === 404) throw new Error('API endpoint not found (404) — check API URL');
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.text();
}

async function tryAutoLoadApi() {
  let apiUrl, apiKey;
  try {
    apiUrl = localStorage.getItem(LS_API_URL) || '';
    apiKey = localStorage.getItem(LS_API_KEY);
  } catch(e) { return; }
  if (!apiKey) return; // apiUrl is optional: empty = same-origin
  updateApiButton(true);
  try {
    const text = await fetchFromApi(apiUrl, apiKey);
    loadJson(text, { type: 'api', apiUrl, apiKey });
  } catch(e) {
    updateApiButton(false);
    console.warn('Auto-load from API failed:', e.message);
  }
}

// ---- Modal ----
function openApiModal() {
  let apiUrl = '', apiKey = '';
  try {
    apiUrl = localStorage.getItem(LS_API_URL) || '';
    apiKey = localStorage.getItem(LS_API_KEY) || '';
  } catch(e) {}
  document.getElementById('a-url').value = apiUrl;
  document.getElementById('a-key').value = apiKey;
  document.getElementById('api-modal-status').textContent = '';
  document.getElementById('api-modal-status').className = '';
  document.getElementById('api-clear-btn').style.display = apiKey ? 'inline-flex' : 'none';
  document.getElementById('api-modal-overlay').classList.add('open');
  document.getElementById('a-url').focus();
}

function closeApiModal() {
  document.getElementById('api-modal-overlay').classList.remove('open');
}

function toggleApiKey() {
  const el = document.getElementById('a-key');
  const btn = document.getElementById('api-key-toggle');
  if (el.type === 'password') { el.type = 'text'; btn.textContent = 'Hide'; }
  else { el.type = 'password'; btn.textContent = 'Show'; }
}

async function connectApi() {
  const apiUrl = document.getElementById('a-url').value.trim();
  const apiKey  = document.getElementById('a-key').value.trim();
  const btn     = document.getElementById('api-connect-btn');

  if (!apiKey) { setApiModalStatus('err', 'API Key is required.'); return; }

  btn.textContent = 'Connecting…';
  btn.disabled = true;
  setApiModalStatus('', '');

  try {
    const text = await fetchFromApi(apiUrl, apiKey);
    try {
      localStorage.setItem(LS_API_URL, apiUrl);
      localStorage.setItem(LS_API_KEY, apiKey);
    } catch(e) {}
    setApiModalStatus('ok', 'Connected to database');
    document.getElementById('api-clear-btn').style.display = 'inline-flex';
    updateApiButton(true);
    loadJson(text, { type: 'api', apiUrl, apiKey });
    setTimeout(closeApiModal, 800);
  } catch(e) {
    setApiModalStatus('err', e.message);
  } finally {
    btn.textContent = 'Connect';
    btn.disabled = false;
  }
}

function clearApiCredentials() {
  if (!confirm('Remove saved API credentials from this browser?')) return;
  try {
    localStorage.removeItem(LS_API_URL);
    localStorage.removeItem(LS_API_KEY);
  } catch(e) {}
  document.getElementById('a-url').value = '';
  document.getElementById('a-key').value = '';
  document.getElementById('api-clear-btn').style.display = 'none';
  updateApiButton(false);
  setApiModalStatus('ok', 'Credentials cleared.');
}

function setApiModalStatus(type, msg) {
  const el = document.getElementById('api-modal-status');
  el.textContent = msg;
  el.className = type;
}

function updateApiButton(connected) {
  const btn = document.getElementById('api-btn');
  if (!btn) return;
  if (connected) {
    btn.textContent = '📄 Database ✓';
    btn.classList.add('btn-connected');
  } else {
    btn.textContent = '📄 Database';
    btn.classList.remove('btn-connected');
  }
}
