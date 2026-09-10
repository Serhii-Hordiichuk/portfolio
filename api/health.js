import { cors } from "./_lib.js";
export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  let ollama = false;
  try {
    const base = (process.env.OLLAMA_URL || "").replace(/\/$/, "");
    if (base) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(base + "/api/tags", { signal: ctl.signal });
      clearTimeout(t);
      ollama = r.ok;
    }
  } catch {}
  return res.status(200).json({ ok: true,
    ollamaModel: process.env.OLLAMA_MODEL || "llama3.1:8b",
    providers: { ollama,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      hf: !!process.env.HF_TOKEN,
      openai: !!process.env.OPENAI_API_KEY } });
}

