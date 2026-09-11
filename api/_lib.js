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

export function buildKB(extra) {
  const x = String(extra || "").trim().slice(0, 4000);
  return "You are Serhii Hordiichuk's portfolio assistant. Answer only from the site info below. If not on the site, say so honestly. Site info:\n" + siteKB() + (x ? "\n\nLive page snapshot:\n" + x : "");
}

export const DEFAULT_MODELS = {
  openrouter: ["meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free", "google/gemma-2-9b-it:free"],
  groq: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile"],
  hf: ["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
  ollama: ["llama3.1:8b", "qwen2.5", "mistral"]
};

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
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 600 })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d && d.error && d.error.message) || d.error || ("HTTP " + r.status));
  return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
}

export async function chatOllama(messages, url, model) {
  const base = ollamaBase(url);
  const md = ollamaModel(model);
  if (!base) throw new Error("OLLAMA_URL not set");
  try {
    return await chatOAI(base + "/v1/chat/completions", "", md, messages);
  } catch (e1) {
    const r = await fetch(base + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: md, messages, stream: false })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ("Ollama HTTP " + r.status));
    return (d.message && d.message.content) || "";
  }
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

export async function listModels(provider, key, ollamaUrl) {
  const p = String(provider || "").toLowerCase();
  if (p === "openrouter") {
    const k = key || process.env.OPENROUTER_API_KEY || "";
    if (!k) throw new Error("missing OpenRouter key");
    const d = await fetchJSON("https://openrouter.ai/api/v1/models", k);
    const ids = (d.data || []).map((m) => m && m.id).filter(Boolean);
    if (!ids.length) throw new Error("no models returned");
    const free = ids.filter((id) => /:free$/.test(id));
    return { models: (free.length ? free : ids).slice(0, 60), via: "openrouter-api" };
  }
  if (p === "groq") {
    const k = key || process.env.GROQ_API_KEY || "";
    if (!k) throw new Error("missing Groq key");
    const d = await fetchJSON("https://api.groq.com/openai/v1/models", k);
    const ids = (d.data || []).map((m) => m && m.id).filter(Boolean);
    if (!ids.length) throw new Error("no models returned");
    return { models: ids.slice(0, 60), via: "groq-api" };
  }
  if (p === "hf" || p === "huggingface") {
    const k = key || process.env.HF_TOKEN || "";
    const d = await fetchJSON("https://huggingface.co/api/models?pipeline_tag=text-generation&sort=likes&direction=-1&limit=30", k);
    const ids = (Array.isArray(d) ? d : []).map((m) => m && m.id).filter(Boolean);
    if (!ids.length) throw new Error("no models returned");
    return { models: ids.slice(0, 30), via: "hf-api" };
  }
  if (p === "ollama") {
    const base = ollamaBase(ollamaUrl);
    if (!base) return { models: DEFAULT_MODELS.ollama.slice(), via: "default" };
    const d = await fetchJSON(base + "/api/tags", "", 8000);
    const names = (d.models || []).map((m) => m && m.name).filter(Boolean);
    if (!names.length) throw new Error("no local models (run: ollama pull llama3.1:8b)");
    return { models: names, via: "ollama-tags" };
  }
  throw new Error("unknown provider: " + provider);
}
