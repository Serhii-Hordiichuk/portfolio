// Shared logic for Vercel serverless API (no deps).
// Knowledge base is built from the site itself (docs/cv.txt), not hardcoded.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FALLBACK_KB = "Serhii Hordiichuk, 34, born 27.02.1992. Plumber 10+ years in Ukraine (Euro-warming Sniatyn 2011-2013 O&M; private practice 2013-2023). Education: Berezhany Agrarian Technical Institute (Business Economics 2015-2016); West Ukrainian National University (Bachelor Management 2013-2015); Sniatyn Vocational School (Law 2007-2013). Languages: Ukrainian good, English/Norwegian/Russian beginner. Hobbies: web dev, PC building, tech news. Motto: Possibilities are limitless.";
export const KB = FALLBACK_KB;

export function siteKB() {
  if (process.env.SITE_KB) return String(process.env.SITE_KB).slice(0, 6000);
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const cands = [path.join(here, "..", "docs", "cv.txt"), path.join(process.cwd(), "docs", "cv.txt")];
    for (const p of cands) {
      if (fs.existsSync(p)) {
        const t = fs.readFileSync(p, "utf8").trim();
        if (t) return t.slice(0, 6000);
      }
    }
  } catch {}
  return FALLBACK_KB;
}

export function buildKB(extra, attachments, intent) {
  const x = String(extra || "").trim().slice(0, 4000);
  let att = "";
  const imgs = [];
  try {
    const arr = Array.isArray(attachments) ? attachments.slice(0, 3) : [];
    const parts = [];
    for (const a of arr) {
      const nm = String((a && a.name) || "file").slice(0, 80);
      if (a && a.image) imgs.push(nm);
      const tx = String((a && a.text) || "").slice(0, 3000);
      if (tx) parts.push("[" + nm + "] " + tx);
    }
    if (parts.length) att = " Attached files: " + parts.join(" | ").slice(0, 6000);
    if (imgs.length) att += " User sent images: " + imgs.join(", ") + ". Analyze them when asked.";
  } catch {}
  let mode = "";
  if (intent === "site") {
    mode = "\n\nINTENT: the user is asking about Serhii or this site — use ONLY the site info above. If the exact info is absent, do NOT invent: say it is not on the site and ask a short clarifying question.";
  } else {
    mode = "\n\nINTENT: general topic — answer freely like ChatGPT. If the question seems possibly about Serhii but you are not sure, ask one short clarifying question first instead of guessing.";
  }
  return "You are the AI assistant of serhii-portfolio site. DUAL MODE:\n" +
    "1) If the user asks about Serhii Hordiichuk (bio, CV, skills, education, experience, languages, contacts, projects, personality) - answer ONLY from the site info below. If info is missing, say it is not on the site.\n" +
    "2) For ANY other question or request (explanations, coding, writing, ideas, math, research, general chat, image analysis) - act as a capable general AI like ChatGPT / Gemini: answer helpfully, thoroughly and freely.\n" +
    "When in doubt whether it is a site question or a general question, ask a short clarifying question instead of guessing.\n" +
    "Always reply in the user's language. If the user attaches an image, inspect it carefully and answer questions about it.\n\n" +
    "SITE INFO (about Serhii):\n" + siteKB() + (x ? "\nLIVE PAGE SNAPSHOT:\n" + x : "") + att + mode;
}

export function detectIntent(messages) {
  try {
    const arr = Array.isArray(messages) ? messages : [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const m = arr[i];
      if (m && m.role === "user" && typeof m.content === "string") {
        const s = m.content.toLowerCase();
        return /серг|serhii|резюме|\bcv\b|освіт|досвід прац|контакт|мов\w|хобі|сантех|plumb|sniatyn|снятин|про себе|сайт|портфоліо|portfolio|skills|навичк|education|experience|about you|about serhii|who is/.test(s) ? "site" : "general";
      }
    }
  } catch (e) {}
  return "general";
}

export function buildLLMMessages(messages, attachments) {
  const arr = Array.isArray(messages) ? messages.slice() : [];
  const images = (Array.isArray(attachments) ? attachments : []).filter((a) => a && a.image).slice(0, 2);
  if (images.length && arr.length) {
    const last = arr[arr.length - 1];
    if (last && last.role === "user") {
      const text = String(last.content || "");
      const parts = [{ type: "text", text: text || "Analyze the attached image(s)." }];
      for (const im of images) parts.push({ type: "image_url", image_url: { url: String(im.image) } });
      const trimmed = arr.slice(0, -1).concat([{ role: "user", content: parts }]);
      return { messages: trimmed, ollamaImages: images.map((i) => String(i.image).replace(/^data:image\/[^;]+;base64,/, "")) };
    }
  }
  return { messages: arr, ollamaImages: [] };
}

export function ollamaBase(u) { return String(u || process.env.OLLAMA_URL || "").replace(/\/$/, ""); }
export function ollamaModel(m) { return m || process.env.OLLAMA_MODEL || "llama3.1:8b"; }

export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : allowed[0]));
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

export async function chatOAI(url, key, model, messages, extraHeaders) {
  const r = await fetch(url, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, key ? { Authorization: "Bearer " + key } : {}, extraHeaders || {}),
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024 })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d && d.error && d.error.message) || d.error || ("HTTP " + r.status));
  return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
}

export async function chatOllama(messages, attachments, url, model) {
  const base = ollamaBase(url);
  const md = ollamaModel(model);
  if (!base) throw new Error("OLLAMA_URL not set");
  const llm = buildLLMMessages(messages, attachments);
  try {
    return await chatOAI(base + "/v1/chat/completions", "", md, llm.messages);
  } catch (e1) {
    const r = await fetch(base + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: md, messages: llm.messages.map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : ((m.content.find((p) => p.type === "text") || {}).text || "") })), images: llm.ollamaImages.length ? llm.ollamaImages : undefined, stream: false })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ("Ollama HTTP " + r.status));
    return (d.message && d.message.content) || "";
  }
}

function sseHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
}
function writeSSE(res, obj) {
  if (res.writableEnded) return;
  res.write("data: " + JSON.stringify(obj) + "\n\n");
}
export async function streamOAISSE(url, key, model, messages, res, opts) {
  const o = opts || {};
  const r = await fetch(url, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, key ? { Authorization: "Bearer " + key } : {}, o.extraHeaders || {}),
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: 1024 })
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d && d.error && d.error.message) || d.error || ("HTTP " + r.status)); }
  sseHeaders(res);
  writeSSE(res, { via: o.via || "server" });
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buf += dec.decode(chunk.value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      const t = String(line).trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (d) writeSSE(res, { d: d });
      } catch (e) {}
    }
  }
  writeSSE(res, { done: true });
  try { res.end(); } catch (e) {}
}
export async function streamOllamaChat(messages, attachments, url, model, res, via) {
  const base = ollamaBase(url);
  const md = ollamaModel(model);
  if (!base) throw new Error("OLLAMA_URL not set");
  const llm = buildLLMMessages(messages, attachments);
  const r = await fetch(base + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: md, messages: llm.messages.map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : ((m.content.find((p) => p.type === "text") || {}).text || "") })), images: llm.ollamaImages.length ? llm.ollamaImages : undefined, stream: true })
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || ("Ollama HTTP " + r.status)); }
  sseHeaders(res);
  writeSSE(res, { via: via || "ollama" });
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let done = false;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buf += dec.decode(chunk.value, { stream: true });
    const nl = buf.lastIndexOf("\n");
    if (nl === -1) continue;
    const lineBatch = buf.slice(0, nl); buf = buf.slice(nl + 1);
    for (const raw of lineBatch.split("\n")) {
      const t = raw.trim(); if (!t) continue;
      try {
        const j = JSON.parse(t);
        if (j.message && j.message.content) writeSSE(res, { d: j.message.content });
        if (j.done) { done = true; break; }
      } catch (e) {}
    }
    if (done) break;
  }
  writeSSE(res, { done: true });
  try { res.end(); } catch (e) {}
}

export async function fetchJSON(url, key, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs || 12000);
  try {
    const r = await fetch(url, { headers: key ? { Authorization: "Bearer " + key } : {}, signal: ctl.signal });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d && d.error && d.error.message) || d.error || ("HTTP " + r.status));
    return d;
  } finally { clearTimeout(t); }
}

export async function listModels(provider, clientUrl) {
  const p = String(provider || "").toLowerCase();
  if (p === "openrouter") {
    const k = process.env.OPENROUTER_API_KEY || "";
    if (!k) throw new Error("OPENROUTER_API_KEY not set in Vercel env");
    const d = await fetchJSON("https://openrouter.ai/api/v1/models", k);
    const ids = (d.data || []).map((m) => m && m.id).filter(Boolean);
    if (!ids.length) throw new Error("no models returned");
    const free = ids.filter((id) => /:free$/.test(id));
    return { models: (free.length ? free : ids).slice(0, 60), via: "openrouter-api" };
  }
  if (p === "groq") {
    const k = process.env.GROQ_API_KEY || "";
    if (!k) throw new Error("GROQ_API_KEY not set in Vercel env");
    const d = await fetchJSON("https://api.groq.com/openai/v1/models", k);
    const ids = (d.data || []).map((m) => m && m.id).filter(Boolean);
    if (!ids.length) throw new Error("no models returned");
    return { models: ids.slice(0, 60), via: "groq-api" };
  }
  if (p === "hf" || p === "huggingface") {
    const k = process.env.HF_TOKEN || "";
    if (!k) throw new Error("HF_TOKEN not set in Vercel env");
    const d = await fetchJSON("https://huggingface.co/api/models?pipeline_tag=text-generation&sort=likes&direction=-1&limit=30", k);
    const ids = (Array.isArray(d) ? d : []).map((m) => m && m.id).filter(Boolean);
    if (!ids.length) throw new Error("no models returned");
    return { models: ids.slice(0, 30), via: "hf-api" };
  }
  if (p === "ollama") {
    const base = ollamaBase(clientUrl || "");
    if (!base) throw new Error("OLLAMA_URL not set in Vercel env (server cannot see your localhost; use the Ollama URL field in chat for direct local access)");
    let d;
    try { d = await fetchJSON(base + "/api/tags", "", 8000); }
    catch (e) { throw new Error("cannot reach Ollama from Vercel: " + (e.message || e) + " | OLLAMA_URL=" + base); }
    const names = (d.models || []).map((m) => m && m.name).filter(Boolean);
    if (!names.length) throw new Error("no local models (run: ollama pull llama3.1:8b)");
    return { models: names, via: "ollama-tags" };
  }
  throw new Error("unknown provider: " + provider);
}
