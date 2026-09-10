/* SH chat core v3 */
(function () {
"use strict";
const $ = (s) => document.querySelector(s);
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
return { role: 'system', content: "You are Serhii's portfolio assistant. " + l + ' ' + t + ' Facts: ' + window.SH_CONFIG.kb };
};
window.SH_CHAT.history = function (limit) {
const host = inner() || box();
if (!host) return [];
return Array.from(host.querySelectorAll('.cx-msg')).slice(-limit).map((m) => ({
role: m.classList.contains('u') ? 'user' : 'assistant',
content: ((m.firstChild || {}).textContent) || m.textContent
}));
};
window.SH_CHAT.proxyBase = function () {
try { return (window.SH.store.get('sh.proxy', '') || '').replace(/\/$/, ''); } catch (e) { return ''; }
};
window.SH_CHAT.viaProxy = async function (provider, model, messages) {
const b = window.SH_CHAT.proxyBase();
const ctl = new AbortController();
const t = setTimeout(() => ctl.abort(), 45000);
try {
const r = await fetch(b + '/api/chat', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ provider: (provider === 'auto' ? 'auto' : provider), model: (model === 'auto' ? undefined : model), messages }), signal: ctl.signal
});
const d = await r.json().catch(() => ({}));
if (r.ok && d.reply) return { reply: d.reply, via: 'proxy:' + (d.via || provider) };
throw new Error(d.error || ('HTTP ' + r.status));
} finally { clearTimeout(t); }
};
window.SH_CHAT.direct = async function (provider, model, key, messages) {
const cfg = window.SH_CONFIG.providers[provider];
if (!cfg || !cfg.api) throw new Error('Pick a cloud provider (OpenRouter/Groq/HF/OpenAI) for direct mode');
if (!key) throw new Error('missing API key');
const all = [window.SH_CHAT.sysMsg()].concat(messages);
const r = await fetch(cfg.api, {
method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
body: JSON.stringify({ model: model, messages: all, temperature: 0.7, max_tokens: 600 })
});
const d = await r.json().catch(() => ({}));
if (!r.ok) throw new Error(((d && d.error && d.error.message) || ('HTTP ' + r.status)));
const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
if (!txt) throw new Error('empty answer');
return { reply: txt, via: provider + ' direct' };
};
window.SH_CHAT.demo = function (q) {
const s = String(q || '').toLowerCase();
if (/досвід|робот|experience|erfaring|практик|стаж/.test(s)) return 'Сантехнік 2008–2023 (Euro-oppvarming, Sniatyn): монтаж опалення та водопостачання, ремонт, обслуговування. Клієнт задоволений, системи працюють.';
if (/освіт|education|utdanning|навчан|вчився|універ/.test(s)) return 'Освіта: Бережанський агротехнічний інститут — економіка підприємства (2015–2016); ЗУНУ — бакалавр менеджменту (2013–2015); правознавство (2007–2013); школа в Снятині (2006–2007).';
if (/мов|language|sprak|мова|англій|норвез/.test(s)) return 'Мови: українська — добре (писемно і усно); англійська, норвезька, російська — початкові.';
if (/контакт|contact|email|телефон|адрес|де живе/.test(s)) return 'Контакти: serhiihordiichuk@gmail.com, +4796689237, Leitevegen 4a, 6150 Ørsta.';
if (/навич|skill|компетен|вмієш|сантех/.test(s)) return 'Навички: сантехнічні роботи — монтаж, ремонт, обслуговування систем опалення та водопостачання. Хобі: технології, веб-розробка, збірка ПК.';
if (/хто|сергій|serhii|про себе|розкажи/.test(s)) return 'Сергій Гордійчук, 34 (27.02.1992), Ørsta, Норвегія. 10+ років сантехніком, зараз цікавиться веб-розробкою та IT. Девіз: можливості безмежні.';
if (/привіт|hello|hi|hei|добрий/.test(s)) return 'Привіт! Я асистент Сергія. Питай про досвід, освіту, мови, контакти.';
return 'Демо-режим (без мережі): вкажи Proxy URL або встав API-ключ у шестірні для повного ШІ. Можу відповісти про досвід, освіту, мови, контакти.';
};
})();
