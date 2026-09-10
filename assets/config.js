// Central AI config — no secrets here. Keys only in Vercel env (server) or UI (BYOK).
window.SH_CONFIG = {
  proxyCandidates: [""],
  providers: {
    auto: { label: "Auto (proxy first)", models: [] },
    ollama: { label: "Ollama (my server)", defaultModel: "llama3.1:8b",
      url: "http://localhost:11434", models: ["llama3.1:8b", "llama3.1:70b", "mistral", "qwen2.5"] },
    openrouter: { label: "OpenRouter (free)", api: "https://openrouter.ai/api/v1/chat/completions",
      defaultModel: "meta-llama/llama-3.1-8b-instruct:free",
      models: ["meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free", "google/gemma-2-9b-it:free"] },
    groq: { label: "Groq (free fast)", api: "https://api.groq.com/openai/v1/chat/completions",
      defaultModel: "llama-3.1-8b-instant",
      models: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "mixtral-8x7b-32768"] },
    hf: { label: "HuggingFace", api: "https://router.huggingface.co/v1/chat/completions",
      defaultModel: "meta-llama/Llama-3.1-8B-Instruct",
      models: ["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"] },
    openai: { label: "OpenAI", api: "https://api.openai.com/v1/chat/completions",
      defaultModel: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-4o"] }
  },
  kb: "Serhii Hordiichuk, 34, Orsta Norway. Plumber 10+ years (Euro-oppvarming, Sniatyn): heating/water installs, repairs. IT Full Stack DevOps AI: Python, JS React/Node, Docker, K8s, CI/CD, AWS, Terraform, LLM/GPT/LangChain. Projects: CI/CD pipeline (GitHub Actions+Docker), AI RAG chatbot (GPT-4), AWS+Terraform IaC, React+Node+Postgres web app. Education: Berezhany Agrotechnical Institute (enterprise economics), West Ukrainian National University (management bachelor), Law. Languages: Ukrainian good, English/Norwegian/Russian beginner. Contacts: serhiihordiichuk@gmail.com, +4796689237. Motto: Possibilities are limitless."
};
