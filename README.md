# Serhii Hordiichuk — Portfolio (B/W/G) + AI on Vercel

Frontend + API в одному проєкті Vercel (same origin). Домен уже підключений там.
Автодеплой: push в `main` → Vercel redeploy.

## Deploy (1 раз)
1. Vercel → Add New Project → Import `portfolio` repo → Framework: Other.
2. Environment Variables (Production + Preview):
   OPENROUTER_API_KEY, GROQ_API_KEY, HF_TOKEN, OPENAI_API_KEY (що є),
   OLLAMA_URL=https://твій-ollama-доступ (або порожньо), OLLAMA_MODEL=llama3.1:8b,
   ALLOWED_ORIGINS=https://твій-домен
3. Deploy. Перевір: https://твій-домен/api/health → ok:true.
4. Domains: твій домен уже там — нічого міняти не треба.

## Chat
Auto → /api/chat на тому ж домені (ключі тільки в Vercel env).
Fallback: BYOK ключ у шестірні → localStorage; demo офлайн.

## Local
node dev-server.js (емулює /api/* локально на :8787).


