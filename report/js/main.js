// ---- File loader ----
document.getElementById('file-btn').onclick = () => document.getElementById('file-in').click();
document.getElementById('file-in').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => loadJson(ev.target.result);
  r.readAsText(f);
  e.target.value = '';
});

// ---- URL loader ----
document.getElementById('url-btn').onclick = fetchUrl;
document.getElementById('url-in').addEventListener('keydown', e => { if (e.key === 'Enter') fetchUrl(); });

// ---- Auto-load from ?data= param ----
(function() {
  const u = new URLSearchParams(location.search).get('data');
  if (u) { document.getElementById('url-in').value = u; fetchUrl(); return; }
  // Auto-load from saved private repo credentials
  tryAutoLoad();
})();

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// Focus trap inside modal
document.getElementById('modal-overlay').addEventListener('keydown', e => {
  if (!document.getElementById('modal-overlay').classList.contains('open')) return;
  if (e.key !== 'Tab') return;
  const focusable = Array.from(
    document.querySelector('.modal').querySelectorAll('button:not([disabled]), input:not([disabled])')
  );
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
});
