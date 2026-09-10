/* SH chat part 1: helpers + proxy/direct */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  window.SH_CHAT = window.SH_CHAT || {};
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  window.SH_CHAT.esc = esc;
  window.SH_CHAT.add = function (text, who, via) {
    const b = $("#chat-body");
    const d = document.createElement("div");
    d.className = "msg " + who;
    d.innerHTML = esc(text) + (via ? `<span class="via">via ${esc(via)}</span>` : "");
    b.appendChild(d); b.scrollTop = b.scrollHeight;
  };
  window.SH_CHAT.sysMsg = function () {
    const tone = $("#tone").value;
    let t = "Be polite and professional.";
    if (tone === "friendly") t = "Be friendly and warm.";
    if (tone === "short") t = "Answer very briefly (1-2 sentences).";
    const lang = $("#clang").value;
    let l = "Reply in the same language as the user.";
    if (lang === "uk") l = "Reply ONLY in Ukrainian.";
    if (lang === "en") l = "Reply ONLY in English.";
    if (lang === "no") l = "Reply ONLY in Norwegian (bokmal).";
    return { role: "system", content: `You are Serhii's portfolio assistant. ${l} ${t} Facts: ${window.SH_CONFIG.kb}` };
  };
  window.SH_CHAT.history = function (limit) {
    const items = Array.from($("#chat-body").querySelectorAll(".msg")).slice(-limit);
    return items.map((m) => ({ role: m.classList.contains("user") ? "user" : "assistant", content: m.textContent }));
  };
  window.SH_CHAT.proxyBase = function () {
    const store = window.SH.store;
    const custom = (store.get("sh.proxy", "") || "").replace(/\/$/, "");
    return custom || "";
  };
  window.SH_CHAT.viaProxy = async function (provider, model, messages) {
    const b = window.SH_CHAT.proxyBase();
    const r = await fetch(b + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, messages })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.reply) return { reply: d.reply, via: "proxy:" + (d.via || provider) };
    throw new Error(d.error || ("HTTP " + r.status));
  };
  window.SH_CHAT.direct = async function (provider, model, key, messages) {
    const cfg = window.SH_CONFIG.providers[provider];
    if (!cfg || !cfg.api) throw new Error("no direct API for " + provider);
    if (!key) throw new Error("missing API key (paste it in settings)");
    const all = [window.SH_CHAT.sysMsg(), ...messages];
    const r = await fetch(cfg.api, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model, messages: all, temperature: 0.7, max_tokens: 600 })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d?.error?.message) || ("HTTP " + r.status));
    const txt = d.choices?.[0]?.message?.content || "";
    if (!txt) throw new Error("empty answer");
    return { reply: txt, via: provider + " direct" };
  };
  window.SH_CHAT.demo = function (q) {
    const s = q.toLowerCase();
    if (/досвід|робот|experience|erfaring/.test(s)) return "10+ років сантехніком (Euro-oppvarming): опалення, вода, ремонти.";
    if (/освіт|education|utdanning/.test(s)) return "Економіка підприємства, бакалавр менеджменту, право.";
    if (/it|проєкт|навич|skill|prosjekt|код|python|docker/.test(s)) return "Python, JS React/Node, Docker, K8s, CI/CD, AWS, Terraform, LLM. Проєкти: CI/CD, RAG-бот, IaC, веб-платформа.";
    if (/мов|language|sprak/.test(s)) return "Українська — добре; EN/NO/RU — початкові.";
    if (/контакт|contact|email|телефон/.test(s)) return "serhiihordiichuk@gmail.com, +4796689237, Ørsta.";
    if (/привіт|hello|hi|hei/.test(s)) return "Привіт! Питай про досвід, IT, освіту чи контакти.";
    return "Офлайн демо: вкажи Proxy URL або встав API-ключ у шестірні для повного ШІ.";
  };
})();
