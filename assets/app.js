/* SH app: nav, theme, i18n */
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
  function autoLang() {
    try {
      const b = (navigator.language || "uk").toLowerCase();
      if (b.startsWith("en")) return "en";
      if (b.startsWith("no") || b.startsWith("nb") || b.startsWith("nn")) return "no";
    } catch {}
    return "uk";
  }
  function applyLang(l) {
    if (!window.SH_I18N[l]) l = "uk";
    lang = l; store.set("sh.lang", l);
    document.documentElement.lang = l;
    const T = window.SH_I18N[l];
    $$("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      if (T[k] !== undefined) el.innerHTML = T[k];
    });
    $$("[data-i18n-ph]").forEach((el) => {
      const k = el.getAttribute("data-i18n-ph");
      if (T[k]) el.placeholder = T[k];
    });
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
    $("#panel").classList.remove("open");
    window.scrollTo(0, 0); store.set("sh.tab", id);
  }
  $$("[data-nav]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); show(b.getAttribute("data-nav")); }));
  $("#gear").addEventListener("click", (e) => { e.stopPropagation(); $("#panel").classList.toggle("open"); });
  document.addEventListener("click", (e) => {
    if (!$("#panel").contains(e.target) && e.target.id !== "gear") $("#panel").classList.remove("open");
  });
  $("#lang-select").addEventListener("change", (e) => applyLang(e.target.value));
  $("#theme-select").addEventListener("change", (e) => applyTheme(e.target.value));
  $("#proxy-url").value = store.get("sh.proxy", "");
  $("#proxy-url").addEventListener("change", (e) => { store.set("sh.proxy", e.target.value.trim()); document.dispatchEvent(new Event("sh:proxy")); });
  $("#dl").addEventListener("click", () => { $("#panel").classList.remove("open"); show("official"); setTimeout(() => window.print(), 250); });
  try {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const h = () => { if ((store.get("sh.theme", "auto")) === "auto") applyTheme("auto"); };
    mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener(h);
  } catch {}
  window.SH.show = show;
  window.SH.getLang = () => lang;
  applyLang(lang);
  applyTheme(store.get("sh.theme", "auto"));
  show(store.get("sh.tab", "cover"));
})();
