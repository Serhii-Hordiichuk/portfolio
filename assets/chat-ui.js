/* SH chat UI v6 - full chatbot: voice in/out, files, mobile keyboard-safe, local Ollama auto-list */
(function () {
"use strict";
let booted = false, sending = false, recog = null, recogOn = false, pendingFiles = [];
const store = () => window.SH.store;
function provEl() { return document.getElementById('provider'); }
function modelEl() { return document.getElementById('model'); }
function hintEl() { return document.getElementById('model-hint'); }
function setModelHint(t) { const h = hintEl(); if (h) h.textContent = t || ''; }
function fillModels(list, keep) {
  const p = provEl(), m = modelEl();
  if (!p || !m) return;
  m.innerHTML = '';
  if (!list || !list.length) {
    m.style.display = '';
    const o = document.createElement('option');
    o.value = ''; o.textContent = '\u2014 no models \u2014';
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
function ollamaHint() {
  return 'Ollama: no models. Set Ollama URL below (e.g. http://localhost:11434), allow CORS: OLLAMA_ORIGINS=* ollama serve, and pull models (ollama pull llama3.1 / ollama list).';
}
async function refreshModels(silent) {
  const p = provEl(); if (!p) return;
  const prov = p.value;
  if (prov === 'auto') { fillModels(['auto'], 'auto'); setModelHint('server picks provider'); return; }
  const keep = modelEl() && modelEl().value ? modelEl().value : store().get('sh.model:' + prov, '');
  if (!silent) setModelHint('loading models\u2026');
  try {
    const out = await window.SH_CHAT.fetchModels(prov);
    fillModels(out.models, keep);
    setModelHint(out.models.length + ' models (' + (out.via || 'server') + ')');
  } catch (e) {
    fillModels([], '');
    setModelHint(prov === 'ollama' ? ollamaHint() : String((e && e.message) || e));
  }
}
/* ---------- sessions ---------- */
function sessions() { try { const v = JSON.parse(localStorage.getItem('sh.sessions') || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function saveSessions(s) { try { localStorage.setItem('sh.sessions', JSON.stringify((s || []).slice(0, 30))); } catch (e) {} }
function curId() { return store().get('sh.cur', ''); }
function setCur(id) { store().set('sh.cur', id); }
function msgCount(s) { return (s && s.msgs ? s.msgs.length : 0); }
function renderSessions() {
  const b = document.getElementById('sessions');
  if (!b) return;
  b.innerHTML = '';
  sessions().forEach((s) => {
    const d = document.createElement('div');
    d.className = 'cx-item' + (s.id === curId() ? ' on' : '');
    d.setAttribute('role', 'button');
    d.tabIndex = 0;
    const t = document.createElement('span');
    t.textContent = (s.title || 'Chat') + (msgCount(s) ? ' \u00b7 ' + msgCount(s) : '');
    t.title = s.title || 'Chat';
    const open = () => openSession(s.id);
    d.addEventListener('click', open);
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    const x = document.createElement('button');
    x.textContent = '\u00d7'; x.title = 'delete'; x.setAttribute('aria-label', 'Delete chat');
    x.addEventListener('click', (e) => { e.stopPropagation(); delSession(s.id); });
    d.appendChild(t); d.appendChild(x); b.appendChild(d);
  });
}
function snapshot() {
  const host = document.getElementById('chat-inner') || document.getElementById('chat-body');
  if (!host) return [];
  return Array.from(host.querySelectorAll('.cx-msg'))
    .filter((m) => !m.classList.contains('cx-filesmsg'))
    .map((m) => ({
      role: m.classList.contains('u') ? 'user' : 'assistant',
      content: ((m.querySelector('.cx-text') || m.firstChild || {}).textContent) || m.textContent,
      via: ((m.querySelector('.cx-via') || {}).textContent) || ''
    })).filter((m) => m.content && m.content.trim() && m.content.trim() !== '…');
}
function persist() {
  const id = curId();
  if (!id) return;
  const msgs = snapshot();
  const f = msgs.find((m) => m.role === 'user');
  const title = (f && f.content) || 'New chat';
  const all = sessions();
  const rec = { id: id, title: String(title).slice(0, 42), msgs: msgs.slice(-100), ts: Date.now() };
  const i = all.findIndex((s) => s.id === id);
  if (i >= 0) all[i] = rec; else all.unshift(rec);
  saveSessions(all); renderSessions();
}
function greet() {
  if (window.SH_CHAT.count() === 0) {
    const T = window.SH_I18N[window.SH.getLang()] || window.SH_I18N.uk;
    window.SH_CHAT.add(T.welcome || 'Hi!', 'bot');
    renderSugs();
  }
}
function sugQuestions() {
  const lang = (window.SH && window.SH.getLang && window.SH.getLang()) || 'uk';
  const Q = {
    uk: ['Хто такий Сергій?', 'Розкажи про досвід роботи', 'Яка освіта?', 'Які мови знає?', 'Чим захоплюється?'],
    en: ['Who is Serhii?', 'Tell me about work experience', 'What is his education?', 'Which languages?', 'What are his hobbies?'],
    no: ['Hvem er Serhii?', 'Fortell om arbeidserfaring', 'Hvilken utdanning?', 'Hvilke språk?', 'Hvilke hobbyer?']
  };
  return Q[lang] || Q.en;
}
function renderSugs() {
  const bar = document.getElementById('cx-sugs');
  if (!bar) return;
  bar.innerHTML = '';
  if (window.SH_CHAT.count() > 1) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  sugQuestions().forEach((q) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cx-sug'; b.textContent = q;
    b.addEventListener('click', () => {
      const ta = document.getElementById('chat-input');
      if (ta) { ta.value = q; autoresize(); }
      send();
    });
    bar.appendChild(b);
  });
}
function closeSide() { const s = document.getElementById('cx-side'); if (s) s.classList.remove('open'); }
function openSession(id) {
  setCur(id);
  closeSide();
  window.SH_CHAT.clear();
  const s = sessions().find((x) => x.id === id);
  ((s && s.msgs) || []).forEach((m) => window.SH_CHAT.add(m.content, m.role === 'user' ? 'user' : 'bot', (m.via || '').replace(/^via /, '')));
  greet(); renderSessions(); renderSugs();
}
function newSession() {
  const id = 's' + Date.now();
  setCur(id);
  window.SH_CHAT.clear(); greet();
  clearPending();
  saveSessions([{ id: id, title: 'New chat', msgs: snapshot(), ts: Date.now() }].concat(sessions()));
  renderSessions();
}
function delSession(id) {
  const rest = sessions().filter((s) => s.id !== id);
  saveSessions(rest);
  if (id === curId()) { if (rest.length) openSession(rest[0].id); else newSession(); }
  else renderSessions();
}
function exportSession() {
  const s = sessions().find((x) => x.id === curId());
  const txt = ((s && s.msgs) || snapshot()).map((m) => (m.role === 'user' ? 'YOU: ' : 'AI: ') + m.content).join('\n\n');
  try { navigator.clipboard.writeText(txt || 'empty'); toast('copied'); } catch (e) { toast('copy failed'); }
}
function toast(t) {
  let el = document.getElementById('cx-toast');
  if (!el) { el = document.createElement('div'); el.id = 'cx-toast'; el.className = 'cx-toast'; document.getElementById('chat').appendChild(el); }
  el.textContent = t;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1600);
}
/* ---------- status / health ---------- */
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
/* ---------- composer: keyboard-safe autoresize + voice + files ---------- */
function autoresize() {
  const ta = document.getElementById('chat-input');
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
}
function stopRec() {
  try { if (recog) recog.stop(); } catch (e) {}
  recogOn = false;
  const b = document.getElementById('mic');
  if (b) b.classList.remove('on');
}
function toggleRec() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById('mic');
  if (!SR) { toast('voice input not supported'); return; }
  if (recogOn) { stopRec(); return; }
  try {
    recog = new SR();
    const lang = (window.SH && window.SH.getLang && window.SH.getLang()) || 'uk';
    recog.lang = lang === 'uk' ? 'uk-UA' : lang === 'no' ? 'nb-NO' : lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'pl' ? 'pl-PL' : lang === 'zh' ? 'zh-CN' : lang === 'ar' ? 'ar-SA' : 'en-US';
    recog.interimResults = true;
    recog.continuous = false;
    const ta = document.getElementById('chat-input');
    const base = ta ? ta.value : '';
    recog.onresult = (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (ta) { ta.value = (base ? base + ' ' : '') + txt; autoresize(); }
    };
    recog.onend = () => { recogOn = false; if (btn) btn.classList.remove('on'); };
    recog.onerror = () => { recogOn = false; if (btn) btn.classList.remove('on'); };
    recog.start();
    recogOn = true;
    if (btn) btn.classList.add('on');
  } catch (e) { toast('mic failed'); }
}
function renderPending() {
  const bar = document.getElementById('cx-files');
  if (!bar) return;
  bar.innerHTML = '';
  pendingFiles.forEach((f, i) => {
    const c = document.createElement('span');
    c.className = 'cx-pfile';
    c.textContent = (f.name || 'file').slice(0, 24);
    const x = document.createElement('button');
    x.type = 'button'; x.textContent = '\u00d7'; x.setAttribute('aria-label', 'Remove file');
    x.addEventListener('click', () => { pendingFiles.splice(i, 1); renderPending(); });
    c.appendChild(x);
    bar.appendChild(c);
  });
  bar.style.display = pendingFiles.length ? 'flex' : 'none';
}
function clearPending() { pendingFiles = []; renderPending(); const fi = document.getElementById('file'); if (fi) fi.value = ''; }
async function onFiles(files) {
  const arr = Array.from(files || []).slice(0, 3);
  for (const f of arr) {
    const parsed = await window.SH_CHAT.readFile(f);
    pendingFiles.push(parsed);
  }
  pendingFiles = pendingFiles.slice(0, 3);
  renderPending();
  if (pendingFiles.length) toast(pendingFiles.length + ' file(s) attached');
}
function errText(e) {
  const m = String((e && e.message) || e || 'request failed');
  const lang = (window.SH && window.SH.getLang && window.SH.getLang()) || 'uk';
  const hints = { uk: 'Помилка: ' + m, en: 'Error: ' + m, no: 'Feil: ' + m };
  return hints[lang] || hints.en;
}
function canSend(provider, model) {
  if (provider === 'auto') return true;
  if (provider === 'ollama') return !!model;
  return !!model;
}
async function send() {
  if (sending) return;
  const inp = document.getElementById('chat-input');
  if (!inp) return;
  const q = inp.value.trim();
  if (!q && !pendingFiles.length) return;
  const provider = provEl().value;
  let model = modelEl().value;
  if (!canSend(provider, model)) {
    if (q) window.SH_CHAT.add(q, 'user');
    window.SH_CHAT.add(provider === 'ollama' ? ollamaHint() : 'No models: set the key in Vercel env first, then redeploy.', 'bot', 'error');
    return;
  }
  if (provider === 'ollama' && !window.SH_CHAT.ollamaUrl()) {
    try {
      const all = await window.SH_CHAT.fetchAllModels();
      if (!(all.ollama && all.ollama.configured)) {
        if (q) window.SH_CHAT.add(q, 'user');
        window.SH_CHAT.add(ollamaHint(), 'bot', 'error');
        return;
      }
    } catch (e) {}
  }
  sending = true;
  stopRec();
  window.SH_CHAT.stopSpeak();
  const btn = document.getElementById('send');
  if (btn) btn.disabled = true;
  const files = pendingFiles.slice();
  inp.value = ''; autoresize();
  if (files.length) window.SH_CHAT.addFiles(files, 'user');
  if (q) window.SH_CHAT.add(q, 'user');
  else if (files.length) window.SH_CHAT.add('(files attached: ' + files.map((f) => f.name).join(', ') + ')', 'user');
  clearPending();
  const ty = document.getElementById('typing');
  if (ty) ty.classList.add('show');
  store().set('sh.provider', provider);
  if (model) store().set('sh.model:' + provider, model);
  updateStatusSub();
  const msgs = window.SH_CHAT.history(10).concat([{ role: 'user', content: q || ('Analyze attached files: ' + files.map((f) => f.name).join(', ')) }]);
  const botNode = window.SH_CHAT.add('\u2026', 'bot');
  try {
    let ans;
    if (provider === 'ollama' && window.SH_CHAT.ollamaUrl() && !files.length) {
      try { ans = await window.SH_CHAT.viaProxy(provider, model, [window.SH_CHAT.sysMsg()].concat(msgs), files); }
      catch (pe) { ans = await window.SH_CHAT.ollamaDirect(model, msgs); }
    } else {
      ans = await window.SH_CHAT.viaProxy(provider, model, [window.SH_CHAT.sysMsg()].concat(msgs), files);
    }
    if (ty) ty.classList.remove('show');
    window.SH_CHAT.updateBot(botNode, ans.reply, ans.via);
    if (store().get('sh.tts', 'off') === 'on') window.SH_CHAT.speak(ans.reply);
  } catch (e) {
    if (ty) ty.classList.remove('show');
    window.SH_CHAT.updateBot(botNode, errText(e), 'error');
  }
  if (btn) btn.disabled = false;
  sending = false;
  persist();
  renderSugs();
  closeSide();
  inp.focus({ preventScroll: true });
}
/* ---------- mobile keyboard: keep composer visible ---------- */
function keyboardFix() {
  try {
    const vv = window.visualViewport;
    const chat = document.getElementById('chat');
    if (!vv || !chat) return;
    const HEADER = 60;
    const onR = () => {
      // visualViewport.height = видима область БЕЗ клавіатури;
      // мінус хедер (60px), бо body має padding-top:60px, а хедер fixed.
      const h = Math.max(320, Math.round(vv.height - HEADER));
      chat.style.setProperty('--vv-h', h + 'px');
      setTimeout(() => window.SH_CHAT.scrollBottom(), 60);
    };
    vv.addEventListener('resize', onR);
    vv.addEventListener('scroll', onR);
    onR();
  } catch (e) {}
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
  // Ollama URL row
  const orow = document.getElementById('ollama-row');
  const oinp = document.getElementById('ollama-url');
  const toggleOllama = () => { if (orow) orow.style.display = p.value === 'ollama' ? '' : 'none'; };
  if (oinp) {
    oinp.value = window.SH_CHAT.ollamaUrl();
    oinp.placeholder = 'Ollama URL, e.g. http://localhost:11434';
    let dt = 0;
    oinp.addEventListener('input', () => { window.SH_CHAT.setOllamaUrl(oinp.value); clearTimeout(dt); dt = setTimeout(() => refreshModels(false), 700); });
    oinp.addEventListener('change', () => refreshModels(false));
  }
  const refr = document.getElementById('models-refresh');
  if (refr) refr.addEventListener('click', () => refreshModels(false));
  toggleOllama();
  p.addEventListener('change', () => { store().set('sh.provider', p.value); toggleOllama(); fillModels([], ''); refreshModels(false); persist(); updateStatusSub(); });
  modelEl().addEventListener('change', (e) => { store().set('sh.model:' + p.value, e.target.value); updateStatusSub(); });
  const tone = document.getElementById('tone');
  if (tone) { tone.value = store().get('sh.tone', 'professional'); tone.addEventListener('change', (e) => store().set('sh.tone', e.target.value)); }
  const cl = document.getElementById('clang');
  if (cl) { cl.value = store().get('sh.clang', 'auto'); cl.addEventListener('change', (e) => store().set('sh.clang', e.target.value)); }
  const tts = document.getElementById('tts');
  if (tts) {
    tts.checked = store().get('sh.tts', 'off') === 'on';
    tts.addEventListener('change', () => { store().set('sh.tts', tts.checked ? 'on' : 'off'); if (!tts.checked) window.SH_CHAT.stopSpeak(); });
  }
  document.getElementById('send').addEventListener('click', send);
  const mic = document.getElementById('mic');
  if (mic) mic.addEventListener('click', toggleRec);
  const attach = document.getElementById('attach');
  const fi = document.getElementById('file');
  if (attach && fi) {
    attach.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => { onFiles(fi.files); fi.value = ''; });
  }
  const exp = document.getElementById('cx-export');
  if (exp) exp.addEventListener('click', exportSession);
  const ta = document.getElementById('chat-input');
  ta.addEventListener('input', autoresize);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  ta.addEventListener('focus', () => { setTimeout(() => window.SH_CHAT.scrollBottom(), 120); });
  document.getElementById('new-chat').addEventListener('click', () => { newSession(); closeSide(); });
  const mb = document.getElementById('cx-menu');
  if (mb) mb.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('cx-side').classList.toggle('open'); });
  document.addEventListener('click', (e) => {
    const side = document.getElementById('cx-side');
    if (side && side.classList.contains('open') && !side.contains(e.target) && !(mb && mb.contains(e.target))) side.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSide(); stopRec(); window.SH_CHAT.stopSpeak(); } });
  document.addEventListener('sh:proxy', () => { health(); refreshModels(true); });
  document.addEventListener('sh:lang', () => { greet(); renderSugs(); });
  const all = sessions();
  const cur = curId();
  if (all.length && cur && all.some((s) => s.id === cur)) openSession(cur);
  else if (all.length) openSession(all[0].id);
  else newSession();
  autoresize();
  health();
  refreshModels(true);
  keyboardFix();
  setInterval(health, 30000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
