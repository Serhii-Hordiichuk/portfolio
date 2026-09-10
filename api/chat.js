import { cors, chatOAI, chatOllama, KB } from "./_lib.js";
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = req.body || {};
  const messages = Array.isArray(b.messages) ? b.messages.slice(-12) : [];
  if (!messages.length) return res.status(400).json({ error: "empty messages" });
  const p = String(b.provider || "auto").toLowerCase();
  const order = p === "auto" ? ["ollama", "openrouter", "groq", "hf", "openai"] : [p];
  let lastErr = "no provider configured (set keys in Vercel env)";
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
      if (reply) return res.status(200).json({ reply, via: name });
    } catch (e) { lastErr = name + ": " + (e.message || e); }
  }
  return res.status(502).json({ error: "All providers failed. " + lastErr });
}
