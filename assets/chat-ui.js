/* SH chat UI: sessions sidebar + send + health */
(function () {
"use strict";
const $ = (s) => document.querySelector(s);
const store = () => window.SH.store;
function fillModels() {
const p = $("#provider").value, cfg = window.SH_CONFIG.providers[p] || {};
const ms = $("#model"); ms.innerHTML = "";
const list = (cfg.models && cfg.models.length) ? cfg.models : [cfg.defaultModel || "default"];
list.forEach((m) => { const o = document.createElement("option"); o.value = m; o.textContent = m; ms.appendChild(o); });
const saved = store().get("sh.model:" + p, cfg.defaultModel || "");
if (saved) ms.value = saved;
}
function sessions() { try { return JSON.parse(localStorage.getItem("sh.sessions") || "[]"); } catch { return []; } }
function saveSessions(s) { try { localStorage.setItem("sh.sessions", JSON.stringify(s.slice(0, 20))); } catch {} }
function curId() { return store().get("sh.cur", ""); }
function setCur(id) { store().set("sh.cur", id); }
function renderSessions() {
const box = $("#sessions"); box.innerHTML = "";
const all = sessions();
all.forEach((s) => {
const d = document.createElement("div");
d.className = "sess" + (s.id === curId() ? " active" : "");
const t = document.createElement("span"); t.textContent = s.title || "Chat";
t.addEventListener("click", () => openSession(s.id));
const x = document.createElement("button"); x.textContent = "×"; x.title = "delete";
x.addEventListener("click", (e) => { e.stopPropagation(); delSession(s.id); });
d.appendChild(t); d.appendChild(x); box.appendChild(d);
});
}
function snapshot() {
return Array.from($("#chat-body").querySelectorAll(".msg")).map((m) => ({
role: m.classList.contains("user") ? "user" : "assistant", content: m.textContent, via: (m.querySelector(".via") || {}).textContent || ""
}));
}
function persist() {
const all = sessions();
const id = curId();
const msgs = snapshot();
const title = (msgs.find((m) => m.role === "user") || {}).content || "New chat";
const i = all.findIndex((s) => s.id === id);
const rec = { id, title: String(title).slice(0, 40), msgs: msgs.slice(-40), ts: Date.now() };
if (i >= 0) all[i] = rec; else all.unshift(rec);
saveSessions(all); renderSessions();
}
function paint(msgs) {
$("#chat-body").innerHTML = "";
(msgs || []).forEach((m) => window.SH_CHAT.add(m.content, m.role === "user" ? "user" : "bot", (m.via || "").replace(/^via /, "")));
}
function openSession(id) {
setCur(id);
const s = sessions().find((x) => x.id === id);
paint(s ? s.msgs : []);
if (!s || !s.msgs.length) greet();
renderSessions();
}
function newSession() {
const id = "s" + Date.now();
setCur(id); paint([]); greet();
saveSessions([{ id, title: "New chat", msgs: [], ts: Date.now() }, ...sessions()]);
renderSessions();
}
function delSession(id) {
const rest = sessions().filter((s) => s.id !== id);
saveSessions(rest);
if (id === curId()) { if (rest.length) openSession(rest[0].id); else newSession(); }
else renderSessions();
}
function greet() {
const T = window.SH_I18N[window.SH.getLang()] || {};
if (!$("#chat-body").children.length) window.SH_CHAT.add(T.welcome || "Hi!", "bot");
}
async function health() {
const dot = $("#cdot"), txt = $("#ctxt");
try {
const b = window.SH_CHAT.proxyBase();
const r = await fetch(b + "/api/health");
const d = await r.json();
if (d.ok) { dot.classList.add("ok"); txt.textContent = "online"; return; }
} catch (e) {}
dot.classList.remove("ok"); txt.textContent = "demo";
}
async function send() {
const inp = $("#chat-input");
const q = inp.value.trim(); if (!q) return;
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
const key = ($("#api-key").value || "").trim();
if (provider === "auto" || !key) throw pe;
ans = await window.SH_CHAT.direct(provider, model, key, msgs);
}
$("#typing").style.display = "none";
window.SH_CHAT.add(ans.reply, "bot", ans.via);
} catch (e) {
$("#typing").style.display = "none";
window.SH_CHAT.add(window.SH_CHAT.demo(q), "bot", "demo");
}
persist();
}
document.addEventListener("DOMContentLoaded", () => {
const prov = $("#provider");
Object.keys(window.SH_CONFIG.providers).forEach((k) => {
const o = document.createElement("option");
o.value = k; o.textContent = window.SH_CONFIG.providers[k].label; prov.appendChild(o);
});
prov.value = store().get("sh.provider", "auto");
fillModels();
prov.addEventListener("change", fillModels);
$("#model").addEventListener("change", (e) => store().set("sh.model:" + prov.value, e.target.value));
$("#api-key").value = store().get("sh.key", "");
$("#api-key").addEventListener("change", (e) => store().set("sh.key", e.target.value.trim()));
$("#tone").value = store().get("sh.tone", "professional");
$("#tone").addEventListener("change", (e) => store().set("sh.tone", e.target.value));
$("#clang").value = store().get("sh.clang", "auto");
$("#clang").addEventListener("change", (e) => store().set("sh.clang", e.target.value));
$("#send").addEventListener("click", send);
$("#chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
$("#new-chat").addEventListener("click", newSession);
document.addEventListener("sh:proxy", health);
const all = sessions();
if (all.length && curId()) openSession(curId());
else if (all.length) openSession(all[0].id);
else newSession();
renderSessions();
health(); setInterval(health, 30000);
});
})();
