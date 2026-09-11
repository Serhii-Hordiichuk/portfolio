/* SH chat core v4 - no demo, no OpenAI, site-grounded, BYOK + Ollama */
(function () {
"use strict";
window.SH_CHAT = window.SH_CHAT || {};
function box() { return document.getElementById('chat-body'); }
function inner() { return document.getElementById('chat-inner'); }
window.SH_CHAT.scrollBottom = function () { const b = box(); if (b) b.scrollTop = b.scrollHeight; };
window.SH_CHAT.add = function (text, who, via) {
  const host = inner() || box();
  if (!host) return;
  const d = document.createElement('div');
  d.className = 'cx-msg ' + (who === 'user' ? 'u' : 'b');
  const p = document.createElement('div');
  p.textContent = String(text == null ? '' : text);
  d.appendChild(p);
  if (via) { const v = document.createElement('span'); v.className = 'cx-via'; v.textContent = 'via ' + via; d.appendChild(v); }
  host.appendChild(d);
  window.SH_CHAT.scrollBottom();
};
window.SH_CHAT.clear = function () { const h = inner(); if (h) h.innerHTML = ''; };
window.SH_CHAT.count = function () { return (inner() || box() || {children:[]}).children.length; };
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
    return parts.join('\n').slice(0, 3500);
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
  if (lang === 'de') l = 'Reply ONLY in German.';
  if (lang === 'fr') l = 'Reply ONLY in French.';
  if (lang === 'es') l = 'Reply ONLY in Spanish.';
  if (lang === 'pl') l = 'Reply ONLY in Polish.';
  if (lang === 'ru') l = 'Reply ONLY in Russian.';
  if (lang === 'zh') l = 'Reply ONLY in Chinese.';
  if (lang === 'ar') l = 'Reply ONLY in Arabic.';
  return { role: 'system', content: "You are Serhii's portfolio assistant. Answer ONLY from the site info. If not on the site, say so honestly. " + l + ' ' + t + ' ' + window.SH_CHAT.siteFactsSync() };
};
window.SH_CHAT.history = function (limit) {
  const host = inner() || box();
  if (!host) return [];
  return Array.from(host.querySelectorAll('.cx-msg')).slice(-limit).map((m) => ({
    role: m.classList.contains('u') ? 'user' : 'assistant',
    content: ((m.firstChild || {}).textContent) || m.textContent
  }));
};
function storeGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
window.SH_CHAT.getKey = function (provider) {
  const p = String(provider || '').toLowerCase();
  return (storeGet('sh.key:' + p, '') || storeGet('sh.key', '') || '').trim();
};
window.SH_CHAT.getOllamaUrl = function () {
  return (storeGet('sh.ollamaUrl', '') || '').trim().replace(/\/$/, '');
};
window.SH_CHAT.proxyBase = function () {
  try { return (window.SH.store.get('sh.proxy', '') || '').replace(/\/$/, ''); } catch (e) { return ''; }
};
window.SH_CHAT.viaProxy = async function (provider, model, messages) {
  const b = window.SH_CHAT.proxyBase();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const siteContext = await window.SH_CHAT.siteContext();
    const r = await fetch(b + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: provider, model: (model === 'auto' ? undefined : model),
        messages: messages,
        key: window.SH_CHAT.getKey(provider),
        ollamaUrl: window.SH_CHAT.getOllamaUrl(),
        siteContext: siteContext
      }), signal: ctl.signal
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.reply) return { reply: d.reply, via: 'proxy:' + (d.via || provider) };
    throw new Error(d.error || ('HTTP ' + r.status));
  } finally { clearTimeout(t); }
};
var modelsCache = {};
window.SH_CHAT.fetchModels = async function (provider) {
  const p = String(provider || '').toLowerCase();
  if (p === 'auto') return { models: ['auto'], via: 'auto' };
  const key = window.SH_CHAT.getKey(p);
  const ollamaUrl = window.SH_CHAT.getOllamaUrl();
  const ck = p + '|' + (key ? 'k' + key.length + ':' + key.slice(-4) : 'nokey') + '|' + ollamaUrl;
  if (modelsCache[ck]) return modelsCache[ck];
  const b = window.SH_CHAT.proxyBase();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(b + '/api/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: p, key: key, ollamaUrl: ollamaUrl }), signal: ctl.signal
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(d.models) && d.models.length) {
      const out = { models: d.models, via: d.via || 'server' };
      modelsCache[ck] = out;
      return out;
    }
    throw new Error((d && d.error) || ('HTTP ' + r.status));
  } finally { clearTimeout(t); }
};
window.SH_CHAT.direct = async function (provider, model, key, messages) {
  const cfg = window.SH_CONFIG.providers[provider];
  if (!cfg || !cfg.api) throw new Error('Pick a cloud provider (OpenRouter / Groq / HF) for direct mode');
  if (!key) throw new Error('missing API key');
  const all = [window.SH_CHAT.sysMsg()].concat(messages);
  const extra = provider === 'openrouter' ? { 'HTTP-Referer': location.origin, 'X-Title': 'SH Portfolio' } : {};
  const r = await fetch(cfg.api, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, extra),
    body: JSON.stringify({ model: model, messages: all, temperature: 0.7, max_tokens: 600 })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(((d && d.error && d.error.message) || (d && d.error) || ('HTTP ' + r.status)));
  const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!txt) throw new Error('empty answer');
  return { reply: txt, via: provider + ' direct' };
};
window.SH_CHAT.ollamaDirect = async function (model, messages) {
  const base = window.SH_CHAT.getOllamaUrl();
  if (!base) throw new Error('set Ollama URL first (e.g. http://localhost:11434)');
  const md = model && model !== 'auto' ? model : (storeGet('sh.model:ollama', '') || 'llama3.1:8b');
  const all = [window.SH_CHAT.sysMsg()].concat(messages);
  try {
    const r = await fetch(base + '/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: md, messages: all, temperature: 0.7, max_tokens: 600 })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
    const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    if (txt) return { reply: txt, via: 'ollama direct' };
    throw new Error('empty answer');
  } catch (e1) {
    const r2 = await fetch(base + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: md, messages: all, stream: false })
    });
    const d2 = await r2.json().catch(() => ({}));
    if (!r2.ok) throw new Error((d2 && d2.error) || ('Ollama HTTP ' + r2.status));
    const txt2 = d2 && d2.message && d2.message.content;
    if (!txt2) throw new Error('empty answer from Ollama');
    return { reply: txt2, via: 'ollama direct' };
  }
};
})();
