// Central AI config - no secrets, no hardcoded model lists.
// Model lists come ONLY from Vercel env via GET /api/models.
window.SH_CONFIG = {
  providers: {
    auto: { label: "Auto (server)" },
    openrouter: { label: "OpenRouter" },
    groq: { label: "Groq" },
    hf: { label: "HuggingFace" },
    ollama: { label: "Ollama (server)" }
  }
};
