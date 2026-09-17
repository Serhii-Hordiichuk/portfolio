/* SH chat core v5 - env keys + local Ollama direct probe, voice/file helpers, site-grounded */
(function () {
"use strict";
window.SH_CHAT = window.SH_CHAT || {};
function box() { return document.getElementById('chat-body'); }
function inner() { return document.getElementById('chat-inner'); }
function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }
window.SH_CHAT.scrollBottom = function (instant) {
  const b = box();
  if (!b) return;
  try { b.scrollTo({ top: b.scrollHeight, behavior: instant ? 'auto' : 'smooth' }); }
  catch (e) { b.scrollTop = b.scrollHeight; }
};
/* Safe markdown-lite renderer: escape first, then apply formatting. */
window.SH_CHAT.formatMsg = function (text) {
  let t = esc(text);
  t = t.replace(/```([\s\S]*?)```/g, (m, code) => '<pre class="cx-code">' + esc(code).replace(/\n/g, '<br>') + '</pre>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  t = t.replace(/^#### (.*)$/gm, '<div class="cx-h4">$1</div>');
  t = t.replace(/^### (.*)$/gm, '<div class="cx-h3">$1</div>');
  t = t.replace(/^## (.*)$/gm, '<div class="cx-h2">$1</div>');
  t = t.replace(/^# (.*)$/gm, '<div class="cx-h1">$1</div>');
  t = t.replace(/^- (.*)$/gm, '&bull; $1');
  t = t.replace(/^\d+\. (.*)$/gm, '<span class="cx-num">&bull;</span> $1');
  t = t.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  t = t.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
  return t;
};
/* Strip markdown for natural speech synthesis (no stars/code fences). */
window.SH_CHAT.cleanSpeech = function (text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, function () { return ' код. '; })
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([.!?:;])(?=\S)/g, '$1 ');
};
/* Detect if a user message is asking about the site/Serhii. */
window.SH_CHAT.intentFor = function (text) {
  const s = String(text || '').toLowerCase();
  return /серг|serhii|резюме|\bcv\b|освіт|досвід прац|контакт|мов\w|хобі|сантех|plumb|sniatyn|снятин|про себе|сайт|портфоліо|portfolio|skills|навичк|education|experience|about you|about serhii|who is|cv\b/.test(s) ? 'site' : 'general';
};
window.SH_CHAT.add = function (text, who, via) {
  const host = inner() || box();
  if (!host) return null;
  const d = document.createElement('div');
  d.className = 'cx-msg ' + (who === 'user' ? 'u' : 'b');
  const p = document.createElement('div');
  p.className = 'cx-text';
  p.innerHTML = window.SH_CHAT.formatMsg(text);
  d.appendChild(p);
  if (via) { const v = document.createElement('span'); v.className = 'cx-via'; v.textContent = 'via ' + via; d.appendChild(v); }
  const acts = document.createElement('div');
  acts.className = 'cx-acts';
  const cp = document.createElement('button');
  cp.type = 'button'; cp.className = 'cx-act'; cp.title = 'Copy'; cp.setAttribute('aria-label', 'Copy message');
  cp.innerHTML = '<svg class="ic"><use href="#i-copy"/></svg>';
  cp.addEventListener('click', () => { try { navigator.clipboard.writeText(String(text || '')); cp.classList.add('ok'); setTimeout(() => cp.classList.remove('ok'), 900); } catch (e) {} });
  acts.appendChild(cp);
  if (who !== 'user') {
    const sp = document.createElement('button');
    sp.type = 'button'; sp.className = 'cx-act'; sp.title = 'Read aloud'; sp.setAttribute('aria-label', 'Read aloud');
    sp.innerHTML = '<svg class="ic"><use href="#i-vol"/></svg>';
    sp.addEventListener('click', () => window.SH_CHAT.speak(String(text || '')));
    acts.appendChild(sp);
  }
  d.appendChild(acts);
  host.appendChild(d);
  window.SH_CHAT.scrollBottom();
  return d;
};
window.SH_CHAT.addFiles = function (files, who) {
  const host = inner() || box();
  if (!host || !files || !files.length) return null;
  const d = document.createElement('div');
  d.className = 'cx-msg ' + (who === 'user' ? 'u' : 'b') + ' cx-filesmsg';
  Array.from(files).slice(0, 4).forEach((f) => {
    const chip = document.createElement('div');
    chip.className = 'cx-filechip';
    if (f.kind === 'image' && f.dataUrl) {
      const im = document.createElement('img');
      im.src = f.dataUrl; im.alt = f.name || 'image'; im.loading = 'lazy';
      chip.appendChild(im);
    } else {
      const ic = document.createElement('span');
      ic.className = 'cx-fileic'; ic.textContent = (f.name || '?').slice(-4).toUpperCase().replace('.', '') || 'FILE';
      chip.appendChild(ic);
    }
    const nm = document.createElement('span');
    nm.className = 'cx-filename'; nm.textContent = (f.name || 'file') + (f.size ? ' (' + Math.round(f.size / 1024) + ' KB)' : '');
    chip.appendChild(nm);
    d.appendChild(chip);
  });
  host.appendChild(d);
  window.SH_CHAT.scrollBottom();
  return d;
};
window.SH_CHAT.updateBot = function (node, text, via) {
  if (!node) return window.SH_CHAT.add(text, 'bot', via);
  const p = node.querySelector('.cx-text');
  if (p) p.innerHTML = window.SH_CHAT.formatMsg(text);
  let v = node.querySelector('.cx-via');
  if (via) { if (!v) { v = document.createElement('span'); v.className = 'cx-via'; node.appendChild(v); } v.textContent = 'via ' + via; }
  window.SH_CHAT.scrollBottom(true);
  return node;
};
window.SH_CHAT.clear = function () { const h = inner(); if (h) h.innerHTML = ''; };
window.SH_CHAT.count = function () { return (inner() || box() || { children: [] }).children.length; };
var cvCache = null;
async function cvText() {
  if (cvCache) return cvCache;
  try {
    const r = await fetch('docs/cv.txt', { cache: 'no-store' });
    if (r.ok) { cvCache = (await r.text()).trim().slice(0, 4000); return cvCache; }
  } catch (e) {}
  return '';
}
function domText() {
  try {
    const parts = [];
    const cv = document.getElementById('cv-content');
    if (cv) parts.push('CV: ' + cv.innerText.trim().slice(0, 2500));
    const cc = document.getElementById('contacts-content');
    if (cc && cc.innerText.trim()) parts.push('Contacts: ' + cc.innerText.trim().slice(0, 800));
    const hero = document.querySelector('.hero');
    if (hero) parts.push('Name: ' + hero.innerText.trim().slice(0, 120));
    const motto = document.querySelector('.motto');
    if (motto) parts.push('Motto: ' + motto.innerText.trim().slice(0, 120));
    const st = document.getElementById('st-groups');
    if (st) {
      const pairs = [].slice.call(st.querySelectorAll('.st-tile')).map(function (t) {
        const b = t.querySelector('b');
        const sp = t.querySelector('span');
        return b ? (b.textContent + (sp ? ' - ' + sp.textContent : '')) : t.textContent.trim();
      });
      if (pairs.length) parts.push('Tech stack: ' + pairs.join('; '));
    }
    return parts.join('\n').slice(0, 4800);
  } catch (e) { return ''; }
}
window.SH_CHAT.siteContext = async function () {
  const live = domText();
  const cv = await cvText();
  return ('SITE SNAPSHOT (this website is the source of truth):\n' + live + '\n\nCV FILE:\n' + cv).slice(0, 6000);
};
window.SH_CHAT.siteFactsSync = function () {
  const t = domText();
  return t ? ('Facts from this site: ' + t).slice(0, 3000) : 'Facts: Serhii Hordiichuk, plumber 10+ years, into web dev. Motto: Possibilities are limitless.';
};
window.SH_CHAT.sysMsg = function () {
  const tone = ((document.getElementById('tone') || {}).value) || 'professional';
  let t = 'Be polite and professional.';
  if (tone === 'friendly') t = 'Be friendly and warm.';
  if (tone === 'short') t = 'Answer very briefly (1-2 sentences).';
  const lang = ((document.getElementById('clang') || {}).value) || 'auto';
  let l = 'Reply in the same language as the user.';
  if (lang === 'uk') l = 'Reply ONLY in Ukrainian.';
  if (lang === 'en') l = 'Reply ONLY in English.';
  if (lang === 'no') l = 'Reply ONLY in Norwegian bokmal.';
  const rest = { de: 'German', fr: 'French', es: 'Spanish', pl: 'Polish', ru: 'Russian', zh: 'Chinese', ar: 'Arabic' };
  if (rest[lang]) l = 'Reply ONLY in ' + rest[lang] + '.';
  return { role: 'system', content: "You are the AI assistant of serhii-portfolio. DUAL MODE: answer about Serhii from the site info, for any other topic act as a general AI like ChatGPT. " + l + ' ' + t + ' ' + window.SH_CHAT.siteFactsSync() };
};
window.SH_CHAT.history = function (limit) {
  const host = inner() || box();
  if (!host) return [];
  return Array.from(host.querySelectorAll('.cx-msg'))
    .filter((m) => !m.classList.contains('cx-filesmsg'))
    .slice(-limit).map((m) => ({
      role: m.classList.contains('u') ? 'user' : 'assistant',
      content: ((m.querySelector('.cx-text') || m.firstChild || {}).textContent) || m.textContent
    })).filter((m) => m.content && m.content.trim() && m.content.trim() !== '…');
};
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
window.SH_CHAT.ollamaUrl = function () {
  return (lsGet('sh.ollamaUrl', '') || '').trim().replace(/\/$/, '');
};
window.SH_CHAT.setOllamaUrl = function (u) { lsSet('sh.ollamaUrl', String(u || '').trim()); };
window.SH_CHAT.proxyBase = function () {
  try { return (window.SH.store.get('sh.proxy', '') || '').replace(/\/$/, ''); } catch (e) { return ''; }
};
function attFor(attachments) {
  return (attachments || []).slice(0, 3).map((a) => ({ name: a.name, text: a.text, image: a.image ? a.image : undefined }));
}
window.SH_CHAT.viaProxy = async function (provider, model, messages, attachments) {
  const b = window.SH_CHAT.proxyBase();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60000);
  try {
    const siteContext = await window.SH_CHAT.siteContext();
    const r = await fetch(b + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: provider, model: (model === 'auto' ? undefined : model),
        messages: messages, siteContext: siteContext,
        ollamaUrl: provider === 'ollama' || provider === 'auto' ? window.SH_CHAT.ollamaUrl() : '',
        attachments: attFor(attachments)
      }), signal: ctl.signal
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.reply) return { reply: d.reply, via: 'proxy:' + (d.via || provider) };
    throw new Error(d.error || ('HTTP ' + r.status));
  } finally { clearTimeout(t); }
};
function readStreamLines(r, onLine) {
  const dec = new TextDecoder();
  let buf = '';
  return new Promise((resolve, reject) => {
    const reader = r.body.getReader();
    (function pump() {
      return reader.read().then((chunk) => {
        if (chunk.done) { if (buf.trim()) onLine(buf); resolve(); return; }
        buf += dec.decode(chunk.value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) onLine(line);
        pump();
      }).catch((e) => reject(e));
    })();
  });
}
window.SH_CHAT.viaProxyStream = async function (provider, model, messages, attachments, onDelta) {
  const b = window.SH_CHAT.proxyBase();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 90000);
  try {
    const siteContext = await window.SH_CHAT.siteContext();
    const r = await fetch(b + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stream: true, provider: provider, model: (model === 'auto' ? undefined : model),
        messages: messages, siteContext: siteContext,
        ollamaUrl: provider === 'ollama' || provider === 'auto' ? window.SH_CHAT.ollamaUrl() : '',
        attachments: attFor(attachments)
      }), signal: ctl.signal
    });
    if (!r.ok || !r.body) { const d = await r.json().catch(() => ({})); throw new Error(d.error || ('HTTP ' + r.status)); }
    let full = '', via = provider, streamErr = null, done = false;
    await readStreamLines(r, (line) => {
      const x = String(line).trim();
      if (!x.startsWith('data:')) return;
      const data = x.slice(5).trim();
      if (!data || data === '[DONE]') return;
      try {
        const j = JSON.parse(data);
        if (j.via) via = j.via;
        if (j.d) { full += j.d; if (onDelta) onDelta(j.d); }
        if (j.err) streamErr = j.err;
        if (j.done) done = true;
      } catch (e) {}
    });
    if (streamErr) throw new Error(streamErr);
    if (!full || !done) throw new Error(full ? 'stream closed early' : 'empty response');
    return { reply: full, via: 'proxy:' + via };
  } finally { clearTimeout(t); }
};
async function probeOllamaTags(base, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs || 6000);
  try {
    const r = await fetch(String(base).replace(/\/$/, '') + '/api/tags', { signal: ctl.signal });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (d.models || []).map((m) => m && m.name).filter(Boolean);
  } finally { clearTimeout(t); }
}
window.SH_CHAT.probeOllama = function (base) { return probeOllamaTags(base || window.SH_CHAT.ollamaUrl(), 6000); };
window.SH_CHAT.ollamaDirectStream = async function (model, messages, attachments, onDelta) {
  const base = window.SH_CHAT.ollamaUrl();
  if (!base) throw new Error('set Ollama URL first');
  const md = model && model !== 'auto' ? model : (lsGet('sh.model:ollama', '') || '');
  if (!md) throw new Error('pick an Ollama model first');
  const all = [window.SH_CHAT.sysMsg()].concat(messages);
  const images = (attachments || []).filter((a) => a && a.image).slice(0, 2)
    .map((a) => String(a.image).replace(/^data:image\/[^;]+;base64,/, ''));
  const r = await fetch(base + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: md, messages: all, images: images.length ? images : undefined, stream: true })
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d && d.error) || ('Ollama HTTP ' + r.status)); }
  let full = '', streamErr = null, done = false;
  await readStreamLines(r, (line) => {
    const t = String(line).trim();
    if (!t) return;
    try {
      const j = JSON.parse(t);
      if (j.error) streamErr = j.error;
      if (j.message && j.message.content) { full += j.message.content; if (onDelta) onDelta(j.message.content); }
      if (j.done) done = true;
    } catch (e) {}
  });
  if (streamErr) throw new Error(streamErr);
  if (!full || !done) throw new Error(full ? 'stream closed early' : 'empty answer from Ollama');
  return { reply: full, via: 'ollama local' };
};
var modelsBulk = null;
var modelsBulkAt = 0;
window.SH_CHAT.fetchAllModels = async function (ollamaUrl) {
  const now = Date.now();
  if (modelsBulk && (now - modelsBulkAt) < 60000 && !ollamaUrl) return modelsBulk;
  const b = window.SH_CHAT.proxyBase();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(b + '/api/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaUrl ? { ollamaUrl: ollamaUrl } : {}), signal: ctl.signal
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
    if (!ollamaUrl) { modelsBulk = (d && d.providers) || {}; modelsBulkAt = now; }
    return (d && d.providers) || {};
  } finally { clearTimeout(t); }
};
window.SH_CHAT.fetchModels = async function (provider) {
  const p = String(provider || '').toLowerCase();
  if (p === 'auto') return { models: ['auto'], via: 'auto', configured: true };
  if (p === 'ollama') {
    const base = window.SH_CHAT.ollamaUrl();
    if (base) {
      try {
        const names = await probeOllamaTags(base, 6000);
        if (names.length) return { models: names, via: 'ollama local', configured: true };
      } catch (e) { /* fall through to server check for a clear error */ }
    }
    const all = await window.SH_CHAT.fetchAllModels(base || '');
    const e = all.ollama || {};
    if (e.configured && e.models && e.models.length) return { models: e.models, via: e.via || 'server', configured: true };
    throw new Error((e && e.error) || ('Ollama: no models. Open chat settings and set Ollama URL (e.g. http://localhost:11434), allow CORS via OLLAMA_ORIGINS, and pull a model.'));
  }
  const all = await window.SH_CHAT.fetchAllModels();
  const e = all[p] || {};
  if (e.configured && Array.isArray(e.models) && e.models.length) return { models: e.models, via: e.via || 'server', configured: true };
  throw new Error((e && e.error) || ('no models: key for ' + p + ' not set in Vercel env'));
};
window.SH_CHAT.speak = function (text) {
  try {
    if (!('speechSynthesis' in window)) return;
    const clean = window.SH_CHAT.cleanSpeech(text);
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean.slice(0, 1600));
    const lang = (window.SH && window.SH.getLang && window.SH.getLang()) || 'uk';
    u.lang = lang === 'uk' ? 'uk-UA' : lang === 'no' ? 'nb-NO' : lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'pl' ? 'pl-PL' : lang === 'zh' ? 'zh-CN' : lang === 'ar' ? 'ar-SA' : 'en-US';
    u.rate = 1.0; u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch (e) {}
};
window.SH_CHAT.stopSpeak = function () { try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {} };
window.SH_CHAT.compressImage = function (dataUrl, maxSize, quality) {
  maxSize = maxSize || 1024; quality = quality || 0.85;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          const sc = Math.min(1, maxSize / Math.max(w, h));
          w = Math.max(1, Math.round(w * sc)); h = Math.max(1, Math.round(h * sc));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', quality));
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch (e) { resolve(dataUrl); }
  });
};
window.SH_CHAT.readFile = function (file) {
  return new Promise((resolve) => {
    const name = file.name || 'file';
    const size = file.size || 0;
    const isImg = /^image\//.test(file.type || '');
    if (size > 4 * 1024 * 1024) { resolve({ name: name, size: size, kind: isImg ? 'image' : 'file', text: '', skipped: 'too big (>4MB)' }); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const res = String(fr.result || '');
      if (isImg) {
        window.SH_CHAT.compressImage(res, 1024, 0.85).then((small) => {
          resolve({ name: name, size: size, kind: 'image', image: small, dataUrl: small, text: '' });
        });
        return;
      }
      resolve({ name: name, size: size, kind: 'text', text: res.slice(0, 8000) });
    };
    fr.onerror = () => resolve({ name: name, size: size, kind: isImg ? 'image' : 'file', text: '' });
    if (isImg) fr.readAsDataURL(file);
    else fr.readAsText(file);
  });
};
})();
