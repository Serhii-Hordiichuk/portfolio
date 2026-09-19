// Shared logic for Vercel serverless API (no deps).

/**
 * Simple in-memory rate limiter for serverless functions.
 * Uses a Map with automatic cleanup of old entries.
 * @typedef {Object} RateLimitConfig
 * @property {number} windowMs - Time window in milliseconds
 * @property {number} maxRequests - Maximum requests per window
 * @property {string} keyPrefix - Prefix for the rate limit key
 */

/**
 * @type {Map<string, {count: number, resetAt: number}>}
 */
const rateLimitStore = new Map();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Check and increment rate limit for a key
 * @param {string} key - Unique identifier (e.g., IP address)
 * @param {RateLimitConfig} config - Rate limit configuration
 * @returns {{allowed: boolean, remaining: number, resetAt: number}}
 */
export function checkRateLimit(key, config) {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }
  
  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  
  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Get client IP from request headers (works with Vercel, proxies)
 * @param {Object} req - HTTP request object
 * @returns {string}
 */
export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Optional extra knowledge base from environment (neutral, no personal data).
 * @returns {string} Extra KB text (max 6000 chars) or empty string
 */
export function siteKB() {
  if (process.env.SITE_KB) return String(process.env.SITE_KB).slice(0, 6000);
  return "";
}

/**
 * Build the system prompt for the standalone .sh_ai assistant (general AI, neutral).
 * @param {string} [extra] - Additional context from the client (max 4000 chars)
 * @param {Array<{name?: string, text?: string, image?: string}>} [attachments] - File attachments
 * @param {"site"|"general"} [_intent] - Unused, kept for API compatibility
 * @returns {string} System prompt with attachments and optional context
 */
export function buildKB(extra, attachments, _intent) {
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
  const kb = siteKB();
  return "You are .sh_ai, an AI model developed by serhord.dev.\n" +
    "GOLDEN RULES (immutable — apply to every reply, all modes, all providers):\n" +
    "1) Identity: your name is .sh_ai, made by serhord.dev. Never claim to be any other model or company.\n" +
    "2) Language: always reply in the language the user is currently writing in. If the user switches language mid-chat, switch immediately to the new language with no remarks.\n" +
    "3) Brevity: answers short and precise, no filler, no water.\n" +
    "4) If there is additional important info on the question, do NOT dump it — briefly offer to explain and wait for the user.\n" +
    "If the user attaches an image, inspect it carefully and answer questions about it." +
    (kb ? "\n\nKnowledge base:\n" + kb : "") + (x ? "\n\nAdditional context:\n" + x : "") + att;
}

/**
 * Detect if the user is asking about the site/Serhii or a general topic.
 * @param {Array<{role: string, content: string}>} messages - Chat message history
 * @returns {"site"|"general"} "site" if asking about Serhii/portfolio, "general" otherwise
 */
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

/**
 * Build messages array for LLM API, handling image attachments.
 * @param {Array<{role: string, content: string|Array}>} messages - Chat history
 * @param {Array<{name?: string, text?: string, image?: string}>} [attachments] - File attachments
 * @returns {{messages: Array, ollamaImages: string[]}} Formatted messages and extracted base64 images for Ollama
 */
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

/**
 * Get Ollama base URL from parameter or environment.
 * @param {string} [u] - Ollama URL
 * @returns {string} Base URL without trailing slash
 */
export function ollamaBase(u) { return String(u || process.env.OLLAMA_URL || "").replace(/\/$/, ""); }

/**
 * Get Ollama model name from parameter or environment.
 * @param {string} [m] - Model name
 * @returns {string} Model name (default: llama3.1:8b)
 */
export function ollamaModel(m) { return m || process.env.OLLAMA_MODEL || "llama3.1:8b"; }

/**
 * Handle CORS headers for serverless functions.
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 * @returns {boolean} True if OPTIONS request was handled
 */
export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : allowed[0]));
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

/**
 * Chat with OpenAI-compatible API (non-streaming).
 * @param {string} url - API endpoint URL
 * @param {string} key - API key
 * @param {string} model - Model name
 * @param {Array<{role: string, content: string|Array}>} messages - Chat messages
 * @param {Object} [extraHeaders] - Additional headers
 * @returns {Promise<string>} Assistant response
 */
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

/**
 * Chat with Ollama API (non-streaming), with fallback to /api/chat.
 * @param {Array<{role: string, content: string|Array}>} messages - Chat messages
 * @param {Array<{name?: string, text?: string, image?: string}>} [attachments] - File attachments
 * @param {string} [url] - Ollama base URL
 * @param {string} [model] - Model name
 * @returns {Promise<string>} Assistant response
 */
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

/**
 * Write SSE headers for streaming response.
 * @param {Object} res - HTTP response object
 */
function sseHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
}

/**
 * Write a single SSE event.
 * @param {Object} res - HTTP response object
 * @param {Object} obj - Data to send
 */
function writeSSE(res, obj) {
  if (res.writableEnded) return;
  res.write("data: " + JSON.stringify(obj) + "\n\n");
}

/**
 * Stream chat with OpenAI-compatible API via SSE.
 * @param {string} url - API endpoint URL
 * @param {string} key - API key
 * @param {string} model - Model name
 * @param {Array<{role: string, content: string|Array}>} messages - Chat messages
 * @param {Object} res - HTTP response object (for streaming)
 * @param {Object} [opts] - Options
 * @param {string} [opts.via] - Provider name for tracking
 * @param {Object} [opts.extraHeaders] - Additional headers
 * @returns {Promise<void>}
 */
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

/**
 * Stream chat with Ollama API via SSE.
 * @param {Array<{role: string, content: string|Array}>} messages - Chat messages
 * @param {Array<{name?: string, text?: string, image?: string}>} [attachments] - File attachments
 * @param {string} [url] - Ollama base URL
 * @param {string} [model] - Model name
 * @param {Object} res - HTTP response object (for streaming)
 * @param {string} [via] - Provider name for tracking
 * @returns {Promise<void>}
 */
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

/**
 * Fetch JSON from URL with timeout and optional auth.
 * @param {string} url - URL to fetch
 * @param {string} [key] - Bearer token
 * @param {number} [timeoutMs=12000] - Timeout in milliseconds
 * @returns {Promise<Object>} Parsed JSON response
 */
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

/**
 * List available models for a provider.
 * @param {"openrouter"|"groq"|"ollama"} provider - Provider name
 * @param {string} [clientUrl] - Ollama URL (only used for ollama provider)
 * @returns {Promise<{models: string[], via: string}>} Available models and source
 */
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
