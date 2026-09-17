/* SH app: nav, theme, i18n, radio — ESM entry point */
import { SH_I18N } from './i18n.js';
import './i18n2.js';
import { SH_CV } from './i18n3.js';
import { SH_CONFIG } from './config.js';
import { SH_STATIONS } from './stations.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

window.SH = window.SH || {};
window.SH.store = store;
window.SH_I18N = SH_I18N;
window.SH_CV = SH_CV;
window.SH_CONFIG = SH_CONFIG;
window.SH_STATIONS = SH_STATIONS;

let lang = store.get("sh.lang", autoLang());

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
  $$("[data-i18n-title]").forEach((el) => { const k = el.getAttribute("data-i18n-title"); if (T[k]) { el.title = T[k]; el.setAttribute("aria-label", T[k]); } });
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
  try { if (window.SH_NEWS) window.SH_NEWS.close(); } catch (e) {}
  const nav = $(".nav"); if (nav) nav.classList.remove("open");
  const mb = $("#menu-btn"); if (mb) mb.setAttribute("aria-expanded", "false");
  document.body.classList.toggle("locked", id === "chat");
  window.scrollTo(0, 0); store.set("sh.tab", id);
}

$$("[data-nav]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); show(b.getAttribute("data-nav")); }));
const menuBtn = $("#menu-btn");
if (menuBtn) menuBtn.addEventListener("click", (e) => { e.stopPropagation(); const nav = $(".nav"); if (nav) { nav.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", nav.classList.contains("open") ? "true" : "false"); } });
document.addEventListener("click", (e) => {
  const nav = $(".nav");
  if (nav && nav.classList.contains("open") && !nav.contains(e.target) && e.target.id !== "menu-btn") nav.classList.remove("open");
  const mb = $("#menu-btn"); if (mb) mb.setAttribute("aria-expanded", nav && nav.classList.contains("open") ? "true" : "false");
  const p = $("#panel");
  if (p && !p.contains(e.target) && e.target.id !== "gear" && !e.target.closest("#gear")) p.classList.remove("open");
});
const gear = $("#gear");
if (gear) gear.addEventListener("click", (e) => { e.stopPropagation(); $("#panel").classList.toggle("open"); });
const langSel = $("#lang-select");
if (langSel) {
  if (!window.SH_I18N[langSel.value]) langSel.value = lang;
  langSel.addEventListener("change", (e) => applyLang(e.target.value));
}
const themeSel = $("#theme-select");
if (themeSel) themeSel.addEventListener("change", (e) => applyTheme(e.target.value));
try {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const h = () => { if ((store.get("sh.theme", "auto")) === "auto") applyTheme("auto"); };
  if (mq.addEventListener) mq.addEventListener("change", h); else if (mq.addListener) mq.addListener(h);
} catch (e) {}

function renderCV() {
  const el = document.getElementById("cv-content");
  if (!el || !window.SH_CV) return;
  const T = window.SH_CV[lang.toUpperCase()] || window.SH_CV["UK"] || [];
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; };
  const mp = (s) => esc(s).replace(/\n{2}/g, '</p><p>').replace(/\n/g, '<br>');
  const head = T.slice(0, 22);
  const [navResume, sumT, sumX, aboutT, aboutX, workT, w1r, w1o, w1x, w2r, w2o, w2x, eduT, ed1s, ed1d, ed1f, ed2s, ed2d, ed2f, ed3s, ed3d, ed3f] = head;
  const tail = T.slice(-11);
  const [ed5s, ed5f, langT, lgUk, lgEn, lgNo, lgRu, skillT, skillX] = tail;
  const mid = T.slice(22, Math.max(22, T.length - 11)).map((s) => String(s ?? "").trim()).filter(Boolean);
  const ed4Html = mid.length ? `<p><strong>${esc(mid[0])}</strong>${mid[1] ? `<br>${esc(mid[1])}` : ""}</p>` : "";
  const selfItems = String(ed5f ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  const selfHtml = selfItems.length > 1
    ? `<ul class="cv-learn">${selfItems.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
    : `<p>${esc(ed5f ?? "")}</p>`;
  const langItems = [lgUk, lgEn, lgNo, lgRu].map((s) => String(s ?? "").trim()).filter(Boolean);
  const langHtml = `<ul class="cv-learn">${langItems.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  const allSummary = aboutX ? sumX + '\n\n' + aboutX : sumX;
  el.innerHTML = `
<h2>${esc(sumT)}</h2><p>${mp(allSummary)}</p>
<h2>${esc(workT)}</h2>
<p><strong>${esc(w1r)}</strong> &mdash; ${esc(w1o)}<br>${esc(w1x)}</p>
<p><strong>${esc(w2r)}</strong> &mdash; ${esc(w2o)}<br>${esc(w2x)}</p>
<h2>${esc(eduT)}</h2>
<p><strong>${esc(ed1s)}</strong><br>${esc(ed1d)} &mdash; ${esc(ed1f)}</p>
<p><strong>${esc(ed2s)}</strong><br>${esc(ed2d)} &mdash; ${esc(ed2f)}</p>
<p><strong>${esc(ed3s)}</strong><br>${esc(ed3d)} &mdash; ${esc(ed3f)}</p>
${ed4Html}
<h2>${esc(ed5s)}</h2>${selfHtml}
<h2>${esc(langT)}</h2>${langHtml}
<h2>${esc(skillT)}</h2><p>${esc(skillX)}</p>
`;
}

document.addEventListener("sh:lang", renderCV);
window.SH.show = show;
window.SH.getLang = () => lang;
applyLang(lang);
applyTheme(store.get("sh.theme", "auto"));
show(store.get("sh.tab", "cover"));
renderCV();