/**
 * SH Portfolio AI proxy (no deps, Node 20+).
 * Mirrors Vercel /api/* for local dev. Run: node dev-server.js (port 8788).
 * NOTE: must NOT be 8787 — that port belongs to the Vite frontend.
 * Endpoints: GET /api/health, POST /api/chat, POST /api/models
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteKB, buildKB, listModels, ollamaBase, ollamaModel, chatOAI, chatOllama, streamOAISSE, streamOllamaChat, buildLLMMessages, detectIntent, checkRateLimit, getClientIp } from "../api/_lib.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "..", "public");

// Minimal .env loader (no deps): reads repo-root .env, does not override real env.
// Handles leading spaces, `export KEY=`, quotes, comments.
function loadDotEnv() {
  try {
    const p = path.join(__dirname, "..", ".env");
    if (!fs.existsSync(p)) return;
    const text = fs.readFileSync(p, "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let [, k, v] = m;
      v = v.trim();
      // strip inline comment not inside quotes
      if (!/^["']/.test(v)) v = v.split(/\s+#/)[0].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
loadDotEnv();

// API must NOT use PORT=8787 (Vite frontend). Use API_PORT or fixed 8788.
const PORT = Number(process.env.API_PORT || 8788);
const ALLOWED = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());

/** @type {import('../api/_lib.js').RateLimitConfig} */
const CHAT_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'chat'
};

function cors(req, res) {
  const origin = req.headers.origin || "*";
  const allow = ALLOWED.includes("*") ? "*" : (ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return true; }
  return false;
}
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  let s = "";
  for await (const c of req) { s += c; if (s.length > 200000) break; }
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  if (cors(req, res)) return;
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/health" && req.method === "GET") {
    let ollama = false;
    try {
      const base = ollamaBase("");
      if (base) { const r = await fetch(base + "/api/tags"); ollama = r.ok; }
    } catch {}
    return json(res, 200, { ok: true, ollamaModel: ollamaModel(""),
      providers: { ollama, openrouter: !!process.env.OPENROUTER_API_KEY, groq: !!process.env.GROQ_API_KEY, hf: !!process.env.HF_TOKEN } });
  }
  if (u.pathname === "/api/models" && (req.method === "POST" || req.method === "GET")) {
    let provider = ""; let ollamaUrl = "";
    if (req.method === "POST") { const b = await readBody(req); provider = b.provider || ""; ollamaUrl = b.ollamaUrl || ""; }
    else { provider = u.searchParams.get("provider") || ""; ollamaUrl = u.searchParams.get("ollamaUrl") || ""; }
    provider = String(provider).toLowerCase();
    if (!provider) {
      const out = {};
      for (const p of ["openrouter", "groq", "hf", "ollama"]) {
        try { const r = await listModels(p, p === "ollama" ? ollamaUrl : ""); out[p] = { configured: true, models: r.models, via: r.via }; }
        catch (e) { out[p] = { configured: false, models: [], via: "none", error: String((e && e.message) || e) }; }
      }
      return json(res, 200, { providers: out });
    }
    if (provider === "huggingface") provider = "hf";
    try {
      const out = await listModels(provider, provider === "ollama" ? ollamaUrl : "");
      return json(res, 200, { provider, configured: true, models: out.models, via: out.via });
    } catch (e) {
      return json(res, 200, { provider, configured: false, models: [], via: "none", error: String((e && e.message) || e) });
    }
  }
  if (u.pathname === "/api/chat" && req.method === "POST") {
    // Rate limiting
    const clientIp = getClientIp(req);
    const rateLimitKey = `${CHAT_RATE_LIMIT.keyPrefix}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, CHAT_RATE_LIMIT);
    
    res.setHeader('X-RateLimit-Limit', CHAT_RATE_LIMIT.maxRequests);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetAt / 1000));
    
    if (!rateLimit.allowed) {
      return json(res, 429, { 
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      });
    }

    const b = await readBody(req);
    const messages = Array.isArray(b.messages) ? b.messages.slice(-12) : [];
    if (!messages.length) return json(res, 400, { error: "empty messages" });
    const p = String(b.provider || "auto").toLowerCase();
    const sysKB = buildKB(b.siteContext, b.attachments, detectIntent(messages));
    const ollamaUrl = String(b.ollamaUrl || "").replace(/\/$/, "");
    const order = p === "auto" ? ["ollama", "openrouter", "groq", "hf"] : [p];
    const full = [{ role: "system", content: sysKB }, ...messages];
    const llm = buildLLMMessages(full, b.attachments);
    let lastErr = "no provider configured (set keys in Vercel env)";
    if (b.stream === true) {
      for (const name of order) {
        try {
          if (name === "ollama") await streamOllamaChat(full, b.attachments, ollamaUrl, b.model, res, name);
          else if (name === "openrouter" && process.env.OPENROUTER_API_KEY)
            await streamOAISSE("https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY, b.model || "meta-llama/llama-3.1-8b-instruct:free", llm.messages, res, { via: name, extraHeaders: { "HTTP-Referer": "https://portfolio", "X-Title": "SH Portfolio" } });
          else if (name === "groq" && process.env.GROQ_API_KEY)
            await streamOAISSE("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, b.model || "llama-3.1-8b-instant", llm.messages, res, { via: name });
          else if ((name === "hf" || name === "huggingface") && process.env.HF_TOKEN)
            await streamOAISSE("https://router.huggingface.co/v1/chat/completions", process.env.HF_TOKEN, b.model || "meta-llama/Llama-3.1-8B-Instruct", llm.messages, res, { via: name });
          else { lastErr = name + ": key not set in Vercel env"; continue; }
          return;
        } catch (e) {
          lastErr = name + ": " + (e.message || e);
          if (res.headersSent) { try { res.write("data: " + JSON.stringify({ err: String((e && e.message) || e) }) + "\n\n"); res.end(); } catch (_) {} return; }
        }
      }
      return json(res, 502, { error: "All providers failed. " + lastErr });
    }
    for (const name of order) {
      try {
        let reply = "";
        if (name === "ollama") reply = await chatOllama(full, b.attachments, ollamaUrl, b.model);
        else if (name === "openrouter" && process.env.OPENROUTER_API_KEY)
          reply = await chatOAI("https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY, b.model || "meta-llama/llama-3.1-8b-instruct:free", llm.messages);
        else if (name === "groq" && process.env.GROQ_API_KEY)
          reply = await chatOAI("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, b.model || "llama-3.1-8b-instant", llm.messages);
        else if ((name === "hf" || name === "huggingface") && process.env.HF_TOKEN)
          reply = await chatOAI("https://router.huggingface.co/v1/chat/completions", process.env.HF_TOKEN, b.model || "meta-llama/Llama-3.1-8B-Instruct", llm.messages);
        else { lastErr = name + ": key not set in Vercel env"; continue; }
        if (reply) return json(res, 200, { reply, via: name });
      } catch (e) { lastErr = name + ": " + (e.message || e); }
    }
    return json(res, 502, { error: "All providers failed. " + lastErr });
  }
  if (req.method === "GET") {
    const rel = u.pathname === "/" ? "/index.html" : u.pathname;
    const fp = path.join(PUBLIC, path.normalize(rel).replace(/^\//, ""));
    if (fp.startsWith(PUBLIC) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      const ext = path.extname(fp);
      const ct = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".pdf": "application/pdf", ".txt": "text/plain", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" }[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      return fs.createReadStream(fp).pipe(res);
    }
  }
  return json(res, 404, { error: "not found" });
});
server.listen(PORT, () => console.log("AI proxy on :" + PORT + " | KB chars: " + siteKB().length));
