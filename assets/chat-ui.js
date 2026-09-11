/* SH chat UI v5 - models ONLY from Vercel env via GET /api/models. No BYOK, no defaults. */
(function () {
"use strict";
let booted = false, sending = false;
const store = () => window.SH.store;
function provEl() { return document.getElementById('provider'); }
function modelEl() { return document.getElementById('model'); }
function setModelHint(t) { const h = document.getElementById('model-hint'); if (h) h.textContent = t || ''; }
function fillModels(list, keep) {
  const p = provEl(), m = modelEl();
  if (!p || !m) return;
  m.innerHTML = '';
  if (!list || !list.length) {
    m.style.display = '';
    const o = document.createElement('option');
    o.value = ''; o.textContent = '— no models (set key in Vercel env) —';
    m.appendChild(o); m.value = '';
    updateStatusSub();
    return;
  }
  m.style.display = (list.length === 1 && list[0] === 'auto') ? 'none' : '';
  list.forEach((v) => { const o = document.createElement('option'); o.value = v; o.textContent = v; m.appendChild(o); });
  const want = keep || store().get('sh.model:' + p.value, list[0]);
  m.value = list.includes(want) ? want : list[0];
  updateStatusSub();
}
async function refreshModels(silent) {
  const p = provEl(); if (!p) return;
  const prov = p.value;
  if (prov === 'auto') { fillModels(['auto'], 'auto'); setModelHint('server picks provider'); return; }
  const keep = modelEl() && modelEl().value ? modelEl().value : store().get('sh.model:' + prov, '');
  if (!silent) setModelHint('loading...');
  try {
    const out = await window.SH_CHAT.fetchModels(prov);
    fillModels(out.models, keep);
    setModelHint(out.models.length + ' models (' + (out.via || 'server') + ')');
  } catch (e) {
    fillModels([], '');
    setModelHint(String((e && e.message) || e));
  }
}
function sessions() { try { const v = JSON.parse(localStorage.getItem('sh.sessions') || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function saveSessions(s) { try { localStorage.setItem('sh.sessions', JSON.stringify((s || []).slice(0, 30))); } catch (e) {} }
function curId() { return store().get('sh.cur', ''); }
function setCur(id) { store().set('sh.cur', id); }
function renderSessions() {
  const b = document.getElementById('sessions');
  if (!b) return;
  b.innerHTML = '';
  sessions().forEach((s) => {
    const d = document.createElement('div');
    d.className = 'cx-item' + (s.id === curId() ? ' on' : '');
    const t = document.createElement('span');
    t.textContent = s.title || 'Chat'; t.title = s.title || 'Chat';
    t.addEventListener('click', () => openSession(s.id));
    const x = document.createElement('button');
    x.textContent = '\u00d7'; x.title = 'delete';
    x.addEventListener('click', (e) => { e.stopPropagation(); delSession(s.id); });
    d.appendChild(t); d.appendChild(x); b.appendChild(d);
  });
}
function snapshot() {
  const host = document.getElementById('chat-inner') || document.getElementById('chat-body');
  if (!host) return [];
  return Array.from(host.querySelectorAll('.cx-msg')).map((m) => ({
    role: m.classList.contains('u') ? 'user' : 'assistant',
    content: ((m.firstChild || {}).textContent) || m.textContent,
    via: ((m.querySelector('.cx-via') || {}).textContent) || ''
  }));
}
function persist() {
  const id = curId();
  if (!id) return;
  const msgs = snapshot();
  const f = msgs.find((m) => m.role === 'user');
  const title = ((f && f.content) || 'New chat');
  const all = sessions();
  const rec = { id: id, title: String(title).slice(0, 42), msgs: msgs.slice(-80), ts: Date.now() };
  const i = all.findIndex((s) => s.id === id);
  if (i >= 0) all[i] = rec; else all.unshift(rec);
  saveSessions(all); renderSessions();
}
function greet() {
  if (window.SH_CHAT.count() === 0) {
    const T = window.SH_I18N[window.SH.getLang()] || window.SH_I18N.uk;
    window.SH_CHAT.add(T.welcome || 'Hi!', 'bot');
  }
}
function closeSide() { const s = document.getElementById('cx-side'); if (s) s.classList.remove('open'); }
function openSession(id) {
  setCur(id);
  closeSide();
  window.SH_CHAT.clear();
  const s = sessions().find((x) => x.id === id);
  ((s && s.msgs) || []).forEach((m) => window.SH_CHAT.add(m.content, m.role === 'user' ? 'user' : 'bot', (m.via || '').replace(/^via /, '')));
  greet(); renderSessions();
}
function newSession() {
  const id = 's' + Date.now();
  setCur(id);
  window.SH_CHAT.clear(); greet();
  saveSessions([{ id: id, title: 'New chat', msgs: snapshot(), ts: Date.now() }].concat(sessions()));
  renderSessions();
}
function delSession(id) {
  const rest = sessions().filter((s) => s.id !== id);
  saveSessions(rest);
  if (id === curId()) { if (rest.length) openSession(rest[0].id); else newSession(); }
  else renderSessions();
}
function setStatus(mode) {
  const dot = document.getElementById('cdot');
  const t2 = document.getElementById('ctxt2');
  if (dot) dot.classList.toggle('ok', mode === 'online');
  if (t2) t2.textContent = mode;
  updateStatusSub();
}
function updateStatusSub() {
  const t3 = document.getElementById('ctxt3');
  const p = document.getElementById('provider');
  const m = document.getElementById('model');
  if (t3 && p) t3.textContent = p.value + (m && m.value && m.value !== 'auto' ? ' / ' + m.value : '');
}
async function health() {
  try {
    const b = window.SH_CHAT.proxyBase();
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(b + '/api/health', { signal: ctl.signal });
    clearTimeout(t);
    const d = await r.json();
    setStatus(d && d.ok ? 'online' : 'offline');
  } catch (e) { setStatus('offline'); }
}
function autoresize() {
  const ta = document.getElementById('chat-input');
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
}
function errText(e) {
  const m = String((e && e.message) || e || 'request failed');
  const lang = (window.SH && window.SH.getLang && window.SH.getLang()) || 'uk';
  const hints = {
    uk: 'Помилка: ' + m,
    en: 'Error: ' + m,
    no: 'Feil: ' + m
  };
  return hints[lang] || hints.en;
}
async function send() {
  if (sending) return;
  const inp = document.getElementById('chat-input');
  if (!inp) return;
  const q = inp.value.trim();
  if (!q) return;
  const provider = provEl().value, model = modelEl().value;
  if (provider !== 'auto' && !model) {
    window.SH_CHAT.add(q, 'user');
    window.SH_CHAT.add('No models: set the key in Vercel env first, then redeploy.', 'bot', 'error');
    return;
  }
  sending = true;
  document.getElementById('send').disabled = true;
  inp.value = ''; autoresize();
  window.SH_CHAT.add(q, 'user');
  const ty = document.getElementById('typing');
  ty.classList.add('show');
  store().set('sh.provider', provider);
  if (model) store().set('sh.model:' + provider, model);
  updateStatusSub();
  const msgs = window.SH_CHAT.history(10).concat([{ role: 'user', content: q }]);
  try {
    const ans = await window.SH_CHAT.viaProxy(provider, model, [window.SH_CHAT.sysMsg()].concat(msgs));
    ty.classList.remove('show');
    window.SH_CHAT.add(ans.reply, 'bot', ans.via);
  } catch (e) {
    ty.classList.remove('show');
    window.SH_CHAT.add(errText(e), 'bot', 'error');
  }
  document.getElementById('send').disabled = false;
  sending = false;
  persist();
  closeSide();
  inp.focus();
}
function boot() {
  if (booted) return;
  if (!document.getElementById('chat-body') || !provEl()) return;
  booted = true;
  const p = provEl();
  Object.keys(window.SH_CONFIG.providers).forEach((k) => {
    const o = document.createElement('option');
    o.value = k; o.textContent = window.SH_CONFIG.providers[k].label; p.appendChild(o);
  });
  const savedP = store().get('sh.provider', 'auto');
  p.value = window.SH_CONFIG.providers[savedP] ? savedP : 'auto';
  fillModels([], '');
  p.addEventListener('change', () => { store().set('sh.provider', p.value); fillModels([], ''); refreshModels(false); persist(); updateStatusSub(); });
  modelEl().addEventListener('change', (e) => { store().set('sh.model:' + p.value, e.target.value); updateStatusSub(); });
  const tone = document.getElementById('tone');
  tone.value = store().get('sh.tone', 'professional');
  tone.addEventListener('change', (e) => store().set('sh.tone', e.target.value));
  const cl = document.getElementById('clang');
  cl.value = store().get('sh.clang', 'auto');
  cl.addEventListener('change', (e) => store().set('sh.clang', e.target.value));
  document.getElementById('send').addEventListener('click', send);
  const ta = document.getElementById('chat-input');
  ta.addEventListener('input', autoresize);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  document.getElementById('new-chat').addEventListener('click', () => { newSession(); closeSide(); });
  const mb = document.getElementById('cx-menu');
  if (mb) mb.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('cx-side').classList.toggle('open'); });
  document.addEventListener('sh:proxy', () => { health(); refreshModels(true); });
  const all = sessions();
  const cur = curId();
  if (all.length && cur && all.some((s) => s.id === cur)) openSession(cur);
  else if (all.length) openSession(all[0].id);
  else newSession();
  autoresize();
  health();
  refreshModels(true);
  setInterval(health, 30000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
