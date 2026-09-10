/**
 * Serhii Hordiichuk \u2014 Portfolio AI proxy (no deps, Node 18+).
 * GitHub Pages is static -> keys live here, not in frontend.
 * Endpoints: GET /api/health, POST /api/chat {provider,model,messages}
 * Run: cp .env.example .env && node server.js (port 8787)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const ALLOWED = (process.env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim());
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const KB = `You are Serhii Hordiichuk's portfolio assistant. Serhii (34), Orsta Norway. Plumber 10+ years (Euro-oppvarming). IT: Full Stack DevOps AI \u2014 Python, JS React/Node, Docker, K8s, CI/CD, AWS, Terraform, LLM. Contacts: serhiihordiichuk@gmail.com, +4796689237. Motto: Possibilities are limitless.`;

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
  for await (const c of req) { s += c; if (s.length > 200_000) break; }
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}
async function chatOAI(url, key, model, messages) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: "Bearer " + key } : {}) },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 600 })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || ("HTTP " + r.status));
  return d.choices?.[0]?.message?.content || "";
}
async function chatOllama(messages) {
  const all = [{ role: "system", content: KB }, ...messages];
  try {
    return await chatOAI(OLLAMA_URL + "/v1/chat/completions", "", OLLAMA_MODEL, all);
  } catch {
    const r = await fetch(OLLAMA_URL + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages: all, stream: false })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || ("Ollama HTTP " + r.status));
    return d.message?.content || "";
  }
}

const server = http.createServer(async (req, res) => {
  if (cors(req, res)) return;
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/health" && req.method === "GET") {
    let ollama = false;
    try { const r = await fetch(OLLAMA_URL + "/api/tags"); ollama = r.ok; } catch {}
    return json(res, 200, { ok: true, ollamaModel: OLLAMA_MODEL,
      providers: { ollama, openrouter: !!process.env.OPENROUTER_API_KEY,
        groq: !!process.env.GROQ_API_KEY, hf: !!process.env.HF_TOKEN,
        openai: !!process.env.OPENAI_API_KEY } });
  }
  if (u.pathname === "/api/chat" && req.method === "POST") {
    const b = await readBody(req);
    const messages = Array.isArray(b.messages) ? b.messages.slice(-12) : [];
    if (!messages.length) return json(res, 400, { error: "empty messages" });
    const p = String(b.provider || "auto").toLowerCase();
    const order = p === "auto" ? ["ollama", "openrouter", "groq", "hf", "openai"] : [p];
    let lastErr = "no provider configured";
    for (const name of order) {
      try {
        let reply = "";
        if (name === "ollama") reply = await chatOllama(messages);
        else if (name === "openrouter" && process.env.OPENROUTER_API_KEY)
          reply = await chatOAI("https://openrouter.ai/api/v1/chat/completions",
            process.env.OPENROUTER_API_KEY,
            b.model || "meta-llama/llama-3.1-8b-instruct:free",
            [{ role: "system", content: KB }, ...messages]);
        else if (name === "groq" && process.env.GROQ_API_KEY)
          reply = await chatOAI("https://api.groq.com/openai/v1/chat/completions",
            process.env.GROQ_API_KEY, b.model || "llama-3.1-8b-instant",
            [{ role: "system", content: KB }, ...messages]);
        else if ((name === "hf" || name === "huggingface") && process.env.HF_TOKEN)
          reply = await chatOAI("https://router.huggingface.co/v1/chat/completions",
            process.env.HF_TOKEN, b.model || "meta-llama/Llama-3.1-8B-Instruct",
            [{ role: "system", content: KB }, ...messages]);
        else if (name === "openai" && process.env.OPENAI_API_KEY)
          reply = await chatOAI("https://api.openai.com/v1/chat/completions",
            process.env.OPENAI_API_KEY, b.model || "gpt-4o-mini",
            [{ role: "system", content: KB }, ...messages]);
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
      const ct = { ".html": "text/html", ".css": "text/css",
        ".js": "text/javascript", ".pdf": "application/pdf" }[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      return fs.createReadStream(fp).pipe(res);
    }
  }
  return json(res, 404, { error: "not found" });
});
server.listen(PORT, () => console.log("AI proxy on :" + PORT));

