import { cors, listModels } from "../_lib.js";
// Models come ONLY from Vercel env keys. No BYOK via client.
// GET /api/models -> {providers: {openrouter:{configured,models,via,error?}, ...}}
// GET /api/models?provider=openrouter -> {provider, configured, models, via}
// POST same as GET (body {provider?})
export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  let provider = "";
  if (req.method === "POST") provider = (req.body && req.body.provider) || "";
  else if (req.method === "GET") provider = (req.query && req.query.provider) || "";
  else return res.status(405).json({ error: "GET or POST only" });
  provider = String(provider || "").toLowerCase();
  const known = ["openrouter", "groq", "hf", "huggingface", "ollama"];
  if (!provider) {
    // bulk: one call populates all dropdowns
    const out = {};
    for (const p of ["openrouter", "groq", "hf", "ollama"]) {
      try {
        const r = await listModels(p);
        out[p] = { configured: true, models: r.models, via: r.via };
      } catch (e) {
        out[p] = { configured: false, models: [], via: "none", error: String((e && e.message) || e) };
      }
    }
    return res.status(200).json({ providers: out });
  }
  if (provider === "huggingface") provider = "hf";
  if (!known.includes(provider)) return res.status(400).json({ error: "unknown provider", providers: known });
  try {
    const r = await listModels(provider);
    return res.status(200).json({ provider, configured: true, models: r.models, via: r.via });
  } catch (e) {
    // NO fallback list: empty = key missing in Vercel env
    return res.status(200).json({ provider, configured: false, models: [], via: "none", error: String((e && e.message) || e) });
  }
}
