/* SH chat UI v2 — sessions, guarded init, no duplicate listeners */
(function () {
"use strict";
const $ = (s) => document.querySelector(s);
let booted = false;
const store = () => window.SH.store;
function fillModels() {
const pEl = $("#provider"), mEl = $("#model");
if (!pEl || !mEl) return;
const cfg = window.SH_CONFIG.providers[pEl.value] || {};
mEl.innerHTML = "";
const list = (cfg.models && cfg.models.length) ? cfg.models : [cfg.defaultModel || "default"];
list.forEach((m) => { const o = document.createElement("option"); o.value = m; o.textContent = m; mEl.appendChild(o); });
const saved = store().get("sh.model:" + pEl.value, cfg.defaultModel || "");
if (saved && list.includes(saved)) mEl.value = saved;
}
function sessions() { try { const v = JSON.parse(localStorage.getItem("sh.sessions") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function saveSessions(s) { try { localStorage.setItem("sh.sessions", JSON.stringify((s || []).slice(0, 20))); } catch {} }
function curId() { return store().get("sh.cur", ""); }
function setCur(id) { store().set("sh.cur", id); }
function escT(s) { return String(s == null ? "" : s); }
function renderSessions() {
const box = $("#sessions");
if (!box) return;
box.innerHTML = "";
sessions().forEach((s) => {
const d = document.createElement("div");
d.className = "cx-item" + (s.id === curId() ? " on" : "");
const t = document.createElement("span");
t.textContent = s.title || "Chat";
t.title = s.title || "Chat";
t.addEventListener("click", () => openSession(s.id));
const x = document.createElement("button");
x.textContent = "\u00d7"; x.title = "delete"; x.setAttribute("aria-label", "delete chat");
x.addEventListener("click", (e) => { e.stopPropagation(); delSession(s.id); });
d.appendChild(t); d.appendChild(x); box.appendChild(d);
});
}
function snapshot() {
const body = $("#chat-body");
if (!body) return [];
return Array.from(body.querySelectorAll(".cx-msg")).map((m) => {
const txt = (m.firstChild && m.firstChild.textContent != null) ? m.firstChild.textContent : m.textContent;
const via = (m.querySelector(".cx-via") || {}).textContent || "";
return { role: m.classList.contains("u") ? "user" : "assistant", content: txt, via };
});
}
function persist() {
const all = sessions();
const id = curId();
if (!id) return;
const msgs = snapshot();
const first = msgs.find((m) => m.role === "user");
const title = (first ? first.content : "New chat") || "New chat";
const rec = { id, title: escT(title).slice(0, 42), msgs: msgs.slice(-60), ts: Date.now() };
const i = all.findIndex((s) => s.id === id);
if (i >= 0) all[i] = rec; else all.unshift(rec);
saveSessions(all); renderSessions();
}
function paint(msgs) {
const body = $("#chat-body");
if (!body) return;
body.innerHTML = "";
(msgs || []).forEach((m) => window.SH_CHAT.add(m.content, m.role === "user" ? "user" : "bot", (m.via || "").replace(/^via /, "")));
}
function greet() {
const T = (window.SH_I18N[window.SH.getLang()] || window.SH_I18N.uk || {});
if ($("#chat-body") && !$("#chat-body").children.length) window.SH_CHAT.add(T.welcome || "Hi!", "bot");
}
function openSession(id) {
setCur(id);
const s = sessions().find((x) => x.id === id);
paint(s ? s.msgs : []);
if (!s || !s.msgs || !s.msgs.length) greet();
renderSessions();
}
function newSession() {
const id = "s" + Date.now();
setCur(id); paint([]); greet();
saveSessions([{ id, title: "New chat", msgs: snapshot(), ts: Date.now() }, ...sessions()]);
renderSessions();
}
function delSession(id) {
const rest = sessions().filter((s) => s.id !== id);
saveSessions(rest);
if (id === curId()) { if (rest.length) openSession(rest[0].id); else newSession(); }
else renderSessions();
}
async function health() {
const dot = $("#cdot"), txt = $("#ctxt");
if (!dot || !txt) return;
try {
const b = window.SH_CHAT.proxyBase();
const ctl = new AbortController();
const t = setTimeout(() => ctl.abort(), 8000);
const r = await fetch(b + "/api/health", { signal: ctl.signal });
clearTimeout(t);
const d = await r.json();
if (d && d.ok) { dot.classList.add("ok"); txt.textContent = "online"; return; }
} catch (e) {}
dot.classList.remove("ok"); txt.textContent = "demo";
}
let sending = false;
async function send() {
if (sending) return;
const inp = $("#chat-input");
if (!inp) return;
const q = inp.value.trim();
if (!q) return;
sending = true;
$("#send").disabled = true;
inp.value = "";
window.SH_CHAT.add(q, "user");
$("#typing").style.display = "block";
const provider = $("#provider").value, model = $("#model").value;
store().set("sh.provider", provider);
store().set("sh.model:" + provider, model);
const msgs = [...window.SH_CHAT.history(10), { role: "user", content: q }];
try {
let ans;
try { ans = await window.SH_CHAT.viaProxy(provider, model, [window.SH_CHAT.sysMsg(), ...msgs]); }
catch (pe) {
const key = (($("#api-key") || {}).value || "").trim();
if (provider === "auto" || !key) throw pe;
ans = await window.SH_CHAT.direct(provider, model, key, msgs);
}
$("#typing").style.display = "none";
window.SH_CHAT.add(ans.reply, "bot", ans.via);
} catch (e) {
$("#typing").style.display = "none";
window.SH_CHAT.add(window.SH_CHAT.demo(q), "bot", "demo");
}
$("#send").disabled = false;
sending = false;
persist();
inp.focus();
}
function boot() {
if (booted) return;
if (!$("#chat-body") || !$("#provider")) return;
booted = true;
const prov = $("#provider");
Object.keys(window.SH_CONFIG.providers).forEach((k) => {
const o = document.createElement("option");
o.value = k; o.textContent = window.SH_CONFIG.providers[k].label; prov.appendChild(o);
});
prov.value = store().get("sh.provider", "auto");
if (!window.SH_CONFIG.providers[prov.value]) prov.value = "auto";
fillModels();
prov.addEventListener("change", () => { store().set("sh.provider", prov.value); fillModels(); });
$("#model").addEventListener("change", (e) => store().set("sh.model:" + prov.value, e.target.value));
const ak = $("#api-key");
if (ak) { ak.value = store().get("sh.key", ""); ak.addEventListener("change", (e) => store().set("sh.key", e.target.value.trim())); }
$("#tone").value = store().get("sh.tone", "professional");
$("#tone").addEventListener("change", (e) => store().set("sh.tone", e.target.value));
$("#clang").value = store().get("sh.clang", "auto");
$("#clang").addEventListener("change", (e) => store().set("sh.clang", e.target.value));
$("#send").addEventListener("click", send);
$("#chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
$("#new-chat").addEventListener("click", newSession);
document.addEventListener("sh:proxy", health);
const all = sessions();
const cur = curId();
if (all.length && cur && all.some((s) => s.id === cur)) openSession(cur);
else if (all.length) openSession(all[0].id);
else newSession();
health();
setInterval(health, 30000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
})();
