import { cors, listModels, DEFAULT_MODELS } from "../_lib.js";
// POST /api/models {provider, key?, ollamaUrl?} -> {models, via}
// GET  /api/models?provider=openrouter (server keys only, no BYOK via GET)
export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  let provider = ""; let key = ""; let ollamaUrl = "";
  if (req.method === "POST") {
    const b = req.body || {};
    provider = b.provider || ""; key = b.key || ""; ollamaUrl = b.ollamaUrl || "";
  } else if (req.method === "GET") {
    provider = (req.query && req.query.provider) || "";
  } else return res.status(405).json({ error: "GET or POST only" });
  provider = String(provider || "").toLowerCase();
  const known = ["openrouter", "groq", "hf", "huggingface", "ollama"];
  if (!known.includes(provider)) return res.status(400).json({ error: "unknown provider", providers: known });
  // never log keys; just proxy the models call
  try {
    const out = await listModels(provider, key, ollamaUrl);
    return res.status(200).json({ provider, models: out.models, via: out.via });
  } catch (e) {
    const p = provider === "huggingface" ? "hf" : provider;
    const fb = (DEFAULT_MODELS[p] || []).slice();
    return res.status(200).json({ provider, models: fb, via: "fallback", error: String((e && e.message) || e) });
  }
}
