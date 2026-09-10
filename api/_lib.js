// Shared logic for Vercel serverless API (no deps).
export const KB = `You are Serhii Hordiichuk's portfolio assistant. Serhii (34), Orsta Norway. Plumber 10+ years (Euro-oppvarming). IT: Full Stack DevOps AI \u2014 Python, JS React/Node, Docker, K8s, CI/CD, AWS, Terraform, LLM. Contacts: serhiihordiichuk@gmail.com, +4796689237. Motto: Possibilities are limitless.`;
export const OLLAMA_URL = (process.env.OLLAMA_URL || "").replace(/\/$/, "");
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";

export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim());
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : allowed[0]));
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}
export async function chatOAI(url, key, model, messages) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: "Bearer " + key } : {}) },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 600 })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || ("HTTP " + r.status));
  return d.choices?.[0]?.message?.content || "";
}
export async function chatOllama(messages) {
  if (!OLLAMA_URL) throw new Error("OLLAMA_URL not set");
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
