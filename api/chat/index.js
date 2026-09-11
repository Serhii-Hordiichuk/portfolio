import { cors, chatOAI, chatOllama, buildKB } from "../_lib.js";
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = req.body || {};
  const messages = Array.isArray(b.messages) ? b.messages.slice(-12) : [];
  if (!messages.length) return res.status(400).json({ error: "empty messages" });
  const p = String(b.provider || "auto").toLowerCase();
  const sysKB = buildKB(b.siteContext);
  const order = p === "auto" ? ["ollama", "openrouter", "groq", "hf"] : [p];
  const byok = b.key || "";
  const ollamaUrl = b.ollamaUrl || "";
  let lastErr = "no provider configured (set keys in Vercel env or send BYOK key)";
  for (const name of order) {
    try {
      let reply = "";
      if (name === "ollama") reply = await chatOllama([{ role: "system", content: sysKB }, ...messages], ollamaUrl, b.model);
      else if (name === "openrouter" && (process.env.OPENROUTER_API_KEY || byok))
        reply = await chatOAI("https://openrouter.ai/api/v1/chat/completions", byok || process.env.OPENROUTER_API_KEY, b.model || "meta-llama/llama-3.1-8b-instruct:free", [{ role: "system", content: sysKB }, ...messages], { "HTTP-Referer": "https://portfolio", "X-Title": "SH Portfolio" });
      else if (name === "groq" && (process.env.GROQ_API_KEY || byok))
        reply = await chatOAI("https://api.groq.com/openai/v1/chat/completions", byok || process.env.GROQ_API_KEY, b.model || "llama-3.1-8b-instant", [{ role: "system", content: sysKB }, ...messages]);
      else if ((name === "hf" || name === "huggingface") && (process.env.HF_TOKEN || byok))
        reply = await chatOAI("https://router.huggingface.co/v1/chat/completions", byok || process.env.HF_TOKEN, b.model || "meta-llama/Llama-3.1-8B-Instruct", [{ role: "system", content: sysKB }, ...messages]);
      else { lastErr = name + ": missing key"; continue; }
      if (reply) return res.status(200).json({ reply, via: name });
    } catch (e) { lastErr = name + ": " + (e.message || e); }
  }
  return res.status(502).json({ error: "All providers failed. " + lastErr });
}
