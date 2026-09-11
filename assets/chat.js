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
if (/\u0434\u043e\u0441\u0432\u0456\u0434|\u0440\u043e\u0431\u043e\u0442|experience|erfaring|practice/.test(s)) return 'Plumber 10+ years in Ukraine: Euro-warming Sniatyn (2011-2013, O&M, install heating/water systems); private practice Sniatyn (2013-2023, repairs).';
if (/\u043e\u0441\u0432\u0456\u0442|education|utdanning|\u043d\u0430\u0432\u0447\u0430\u043d|\u0432\u0447\u0438\u0432\u0441\u044f|\u0443\u043d\u0456\u0432\u0435\u0440/.test(s)) return 'Education: Berezhany Agrarian Technical Institute (Business Economics 2015-2016); West Ukrainian National University (Bachelor Management 2013-2015); Sniatyn Vocational School (Law 2007-2013); Sniatyn school I-III Stefanyk (2006-2007); Sniatyn boarding school I-III (1998-2006).';
if (/\u043c\u043e\u0432|language|sprak|\u043c\u043e\u0432\u0430|\u0430\u043d\u0433\u043b\u0456\u0439|\u043d\u043e\u0440\u0432\u0435\u0437/.test(s)) return 'Languages: Ukrainian (good oral/written), English (beginner), Norwegian (beginner), Russian (beginner).';
if (/\u043d\u0430\u0432\u0438\u0447|skill|\u043a\u043e\u043c\u043f\u0435\u0442\u0435\u043d|\u0432\u043c\u0456\u0454\u0448|\u0441\u0430\u043d\u0442\u0435\u0445/.test(s)) return 'Competencies: Plumbing - install, repair, maintain heating and water supply systems. Hobbies: web dev, PC building, tech news.';
if (/\u0445\u0442\u043e|\u0441\u0435\u0440\u0433\u0456\u0439|serhii|\u043f\u0440\u043e \u0441\u0435\u0431\u0435|\u0440\u043e\u0437\u043a\u0430\u0436\u0438/.test(s)) return 'Serhii Hordiichuk, 34 (27.02.1992). Plumber 10+ years, now into web dev & IT. Personality: introverted, modest, shy, emotional, quiet, reserved, direct. Motto: Possibilities are limitless.';
if (/\u043f\u0440\u0438\u0432\u0456\u0442|hello|hi|hei|\u0434\u043e\u0431\u0440\u0438\u0439/.test(s)) return 'Hi! I am Serhii assistant. Ask about experience, education, languages, competencies, personality.';
return 'Demo mode (offline): set Proxy URL or insert API key in the gear for full AI. I can answer about experience, education, languages, competencies.';
};
})();
