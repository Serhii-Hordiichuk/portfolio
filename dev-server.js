/**
 * SH Portfolio AI proxy (no deps, Node 18+).
 * Mirrors Vercel /api/* for local dev. Run: node dev-server.js (port 8787)
 * Endpoints: GET /api/health, POST /api/chat, POST /api/models
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteKB, buildKB, listModels, ollamaBase, ollamaModel, chatOAI, chatOllama } from "./api/_lib.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const ALLOWED = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());

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
    const b = await readBody(req);
    const messages = Array.isArray(b.messages) ? b.messages.slice(-12) : [];
    if (!messages.length) return json(res, 400, { error: "empty messages" });
    const p = String(b.provider || "auto").toLowerCase();
    const sysKB = buildKB(b.siteContext, b.attachments);
    const ollamaUrl = String(b.ollamaUrl || "").replace(/\/$/, "");
    const order = p === "auto" ? ["ollama", "openrouter", "groq", "hf"] : [p];
    let lastErr = "no provider configured (set keys in Vercel env)";
    for (const name of order) {
      try {
        let reply = "";
        if (name === "ollama") reply = await chatOllama([{ role: "system", content: sysKB }, ...messages], ollamaUrl, b.model);
        else if (name === "openrouter" && process.env.OPENROUTER_API_KEY)
          reply = await chatOAI("https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY, b.model || "meta-llama/llama-3.1-8b-instruct:free", [{ role: "system", content: sysKB }, ...messages]);
        else if (name === "groq" && process.env.GROQ_API_KEY)
          reply = await chatOAI("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, b.model || "llama-3.1-8b-instant", [{ role: "system", content: sysKB }, ...messages]);
        else if ((name === "hf" || name === "huggingface") && process.env.HF_TOKEN)
          reply = await chatOAI("https://router.huggingface.co/v1/chat/completions", process.env.HF_TOKEN, b.model || "meta-llama/Llama-3.1-8B-Instruct", [{ role: "system", content: sysKB }, ...messages]);
        else { lastErr = name + ": key not set in Vercel env"; continue; }
        if (reply) return json(res, 200, { reply, via: name });
      } catch (e) { lastErr = name + ": " + (e.message || e); }
    }
    return json(res, 502, { error: "All providers failed. " + lastErr });
  }
  if (req.method === "GET") {
    const rel = u.pathname === "/" ? "/index.html" : u.pathname;
    const fp = path.join(__dirname, path.normalize(rel).replace(/^\//, ""));
    if (fp.startsWith(__dirname) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      const ext = path.extname(fp);
      const ct = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".pdf": "application/pdf", ".txt": "text/plain" }[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      return fs.createReadStream(fp).pipe(res);
    }
  }
  return json(res, 404, { error: "not found" });
});
server.listen(PORT, () => console.log("AI proxy on :" + PORT + " | KB chars: " + siteKB().length));
