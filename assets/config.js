// Central AI config - no secrets. Keys only in Vercel env or UI (BYOK, localStorage).
window.SH_CONFIG = {
  providers: {
    auto: { label: "Auto (server)", models: ["auto"], byok: false },
    openrouter: { label: "OpenRouter", api: "https://openrouter.ai/api/v1/chat/completions", models: ["meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free", "google/gemma-2-9b-it:free"], byok: true, keyName: "OpenRouter key" },
    groq: { label: "Groq", api: "https://api.groq.com/openai/v1/chat/completions", models: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile"], byok: true, keyName: "Groq key" },
    hf: { label: "HuggingFace", api: "https://router.huggingface.co/v1/chat/completions", models: ["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"], byok: true, keyName: "HF token" },
    ollama: { label: "Ollama (local)", models: ["llama3.1:8b", "qwen2.5", "mistral"], byok: false, ollama: true }
  }
};
