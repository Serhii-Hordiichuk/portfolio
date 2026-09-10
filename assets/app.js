/* SH app: nav, theme, i18n, radio */
(function () {
"use strict";
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const store = {
get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
window.SH = window.SH || {};
window.SH.store = store;
let lang = store.get("sh.lang", autoLang());
var LANGS = ["uk","en","no","de","fr","es","pl","ru","zh","ar"];
function autoLang() {
try {
const b = (navigator.language || "uk").toLowerCase();
if (b.startsWith("uk")) return "uk";
if (b.startsWith("nb") || b.startsWith("nn") || b.startsWith("no")) return "no";
if (b.startsWith("zh")) return "zh";
if (b.startsWith("ar")) return "ar";
if (b.startsWith("de")) return "de";
if (b.startsWith("fr")) return "fr";
if (b.startsWith("es")) return "es";
if (b.startsWith("pl")) return "pl";
if (b.startsWith("en")) return "en";
} catch {}
return "uk";
}
function applyLang(l) {
if (!window.SH_I18N[l]) l = "en";
if (!window.SH_I18N[l]) l = "uk";
lang = l; store.set("sh.lang", l);
document.documentElement.lang = l;
document.documentElement.dir = (l === "ar") ? "rtl" : "ltr";
const T = window.SH_I18N[l];
$$("[data-i18n]").forEach((el) => { const k = el.getAttribute("data-i18n"); if (T[k] !== undefined) el.innerHTML = T[k]; });
$$("[data-i18n-ph]").forEach((el) => { const k = el.getAttribute("data-i18n-ph"); if (T[k]) el.placeholder = T[k]; });
const ls = $("#lang-select"); if (ls) ls.value = l;
document.dispatchEvent(new CustomEvent("sh:lang", { detail: l }));
}
function applyTheme(m) {
store.set("sh.theme", m);
let dark = m === "dark";
if (m === "auto") { try { dark = matchMedia("(prefers-color-scheme: dark)").matches; } catch {} }
document.body.classList.toggle("dark", dark);
const ts = $("#theme-select"); if (ts) ts.value = m;
}
function show(id) {
$$(".section").forEach((s) => s.classList.remove("active"));
const t = document.getElementById(id); if (t) t.classList.add("active");
$$("[data-nav]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-nav") === id));
const panel = $("#panel"); if (panel) panel.classList.remove("open");
const wg = $("#widgets"); if (wg) wg.classList.remove("open");
const fab = $("#fab"); if (fab) fab.classList.remove("on");
const nw = $("#news"); if (nw) nw.classList.remove("open");
const nav = $(".nav"); if (nav) nav.classList.remove("open");
document.body.classList.toggle("locked", id === "chat");
window.scrollTo(0, 0); store.set("sh.tab", id);
}
$$("[data-nav]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); show(b.getAttribute("data-nav")); }));
const menuBtn = $("#menu-btn");
if (menuBtn) menuBtn.addEventListener("click", (e) => { e.stopPropagation(); const nav = $(".nav"); if (nav) nav.classList.toggle("open"); });
var gear = $("#gear");
if (gear) gear.addEventListener("click", (e) => { e.stopPropagation(); $("#panel").classList.toggle("open"); });
document.addEventListener("click", (e) => {
  var p = $("#panel");
  if (p && !p.contains(e.target) && e.target.id !== "gear" && !e.target.closest("#gear")) p.classList.remove("open");
});
var langSel = $("#lang-select");
if (langSel) {
  if (!window.SH_I18N[langSel.value]) langSel.value = lang;
  langSel.addEventListener("change", (e) => applyLang(e.target.value));
}
var themeSel = $("#theme-select");
if (themeSel) themeSel.addEventListener("change", (e) => applyTheme(e.target.value));
var px = $("#proxy-url");
if (px) {
  px.value = store.get("sh.proxy", "");
  px.addEventListener("change", (e) => { store.set("sh.proxy", e.target.value.trim()); document.dispatchEvent(new Event("sh:proxy")); });
}
var dl = $("#dl");
if (dl) dl.addEventListener("click", () => { $("#panel").classList.remove("open"); show("official"); setTimeout(() => window.print(), 250); });
try {
  var mq = matchMedia("(prefers-color-scheme: dark)");
  var h = () => { if ((store.get("sh.theme", "auto")) === "auto") applyTheme("auto"); };
  if (mq.addEventListener) mq.addEventListener("change", h); else if (mq.addListener) mq.addListener(h);
} catch (e) {}
window.SH.show = show;
window.SH.getLang = () => lang;
applyLang(lang);
applyTheme(store.get("sh.theme", "auto"));
show(store.get("sh.tab", "cover"));
})();
