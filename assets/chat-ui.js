/* SH chat part 2: UI wiring */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  function fillModels() {
    const p = $("#provider").value, cfg = window.SH_CONFIG.providers[p] || {};
    const ms = $("#model"); ms.innerHTML = "";
    const list = (cfg.models && cfg.models.length) ? cfg.models : [cfg.defaultModel || "default"];
    list.forEach((m) => { const o = document.createElement("option"); o.value = m; o.textContent = m; ms.appendChild(o); });
    const saved = window.SH.store.get("sh.model:" + p, cfg.defaultModel || "");
    if (saved) ms.value = saved;
  }
  async function health() {
    const dot = $("#cdot"), txt = $("#ctxt");
    try {
      const b = window.SH_CHAT.proxyBase();
      const r = await fetch(b + "/api/health");
      const d = await r.json();
      if (d.ok) { dot.classList.add("ok"); txt.textContent = "proxy: online"; return; }
    } catch (e) {}
    dot.classList.remove("ok"); txt.textContent = "proxy: offline (direct/demo)";
  }
  async function send() {
    const inp = $("#chat-input");
    const q = inp.value.trim(); if (!q) return;
    inp.value = "";
    window.SH_CHAT.add(q, "user");
    $("#typing").style.display = "block";
    const provider = $("#provider").value, model = $("#model").value;
    window.SH.store.set("sh.provider", provider);
    window.SH.store.set("sh.model:" + provider, model);
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
  }
  document.addEventListener("DOMContentLoaded", () => {
    const T = (window.SH_I18N[window.SH.getLang()] || {});
    const prov = $("#provider");
    Object.keys(window.SH_CONFIG.providers).forEach((k) => {
      const o = document.createElement("option");
      o.value = k; o.textContent = window.SH_CONFIG.providers[k].label; prov.appendChild(o);
    });
    prov.value = window.SH.store.get("sh.provider", "auto");
    fillModels();
    prov.addEventListener("change", fillModels);
    $("#model").addEventListener("change", (e) => window.SH.store.set("sh.model:" + prov.value, e.target.value));
    $("#api-key").value = window.SH.store.get("sh.key", "");
    $("#api-key").addEventListener("change", (e) => window.SH.store.set("sh.key", e.target.value.trim()));
    $("#tone").value = window.SH.store.get("sh.tone", "professional");
    $("#tone").addEventListener("change", (e) => window.SH.store.set("sh.tone", e.target.value));
    $("#clang").value = window.SH.store.get("sh.clang", "auto");
    $("#clang").addEventListener("change", (e) => window.SH.store.set("sh.clang", e.target.value));
    document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => { $("#chat-input").value = c.textContent; send(); }));
    $("#send").addEventListener("click", send);
    $("#chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    $("#clear").addEventListener("click", () => { $("#chat-body").innerHTML = ""; window.SH_CHAT.add(T.welcome || "Hi!", "bot"); });
    document.addEventListener("sh:proxy", health);
    if (!$("#chat-body").children.length) window.SH_CHAT.add(T.welcome || "Hi!", "bot");
    health(); setInterval(health, 30000);
  });
})();
