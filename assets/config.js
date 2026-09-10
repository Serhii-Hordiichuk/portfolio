// Central AI config \u2014 no secrets. Keys only in Vercel env or UI (BYOK).
window.SH_CONFIG = {
providers: {
auto: { label: "Auto (server)", models: ["auto"] },
openrouter: { label: "OpenRouter", api: "https://openrouter.ai/api/v1/chat/completions", models: ["meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free", "google/gemma-2-9b-it:free"] },
groq: { label: "Groq", api: "https://api.groq.com/openai/v1/chat/completions", models: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile"] },
hf: { label: "HuggingFace", api: "https://router.huggingface.co/v1/chat/completions", models: ["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"] },
openai: { label: "OpenAI", api: "https://api.openai.com/v1/chat/completions", models: ["gpt-4o-mini", "gpt-4o"] },
ollama: { label: "Ollama (local)", models: ["llama3.1:8b", "qwen2.5", "mistral"] }
},
kb: "Serhii Hordiichuk, 34, born 27.02.1992, Leitevegen 4a 6150 Orsta Norway. Plumber 2008-2023 Euro-oppvarming Sniatyn: heating/water installs, repairs, maintenance. Education: Berezhany Institute enterprise economics 2015-2016, WUNU management bachelor 2013-2015, Law 2007-2013, Sniatyn school 2006-2007. Languages: Ukrainian good, English/Norwegian/Russian beginner. Skills: plumbing. Contacts: serhiihordiichuk@gmail.com, +4796689237. Hobby: tech, web dev, PC builds. Motto: Possibilities are limitless."
};
