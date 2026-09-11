# Serhii Hordiichuk — Portfolio (B/W/G) + AI on Vercel

Frontend + API в одному проєкті Vercel (same origin). Домен уже підключений там.
Автодеплой: push в `main` → Vercel redeploy.

## Deploy (1 раз)
1. Vercel → Add New Project → Import `portfolio` repo → Framework: Other.
2. Environment Variables (Production + Preview):
   OPENROUTER_API_KEY, GROQ_API_KEY, HF_TOKEN (що є),
   OLLAMA_URL=https://твій-ollama-доступ (або порожньо), OLLAMA_MODEL=llama3.1:8b,
   ALLOWED_ORIGINS=https://твій-домен
3. Deploy. Перевір: https://твій-домен/api/health → ok:true.
4. Domains: твій домен уже там — нічого міняти не треба.

## Chat
- Auto → `/api/chat` на тому ж домені (ключі тільки в Vercel env).
- BYOK: введи ключ провайдера (OpenRouter / Groq / HF) у полі під списком моделей — моделі підтягнуться автоматично через `POST /api/models` (ключ в body, не в URL) і збережуться в localStorage. Повторне введення не потрібне.
- Ollama: введи `Ollama URL` (напр. `http://localhost:11434` локально або `https://твій-тунель` для Vercel) — список локальних моделей підтягнеться з `/api/tags`. Якщо proxy недоступний, фронт говорить з Ollama напряму (`/v1/chat/completions` → fallback `/api/chat`). Увага: браузер → localhost працює тільки коли сайт відкритий локально; на Vercel треба публічний URL тунелю (ngrok / Cloudflare Tunnel / Tailscale Funnel) + `OLLAMA_ORIGINS=*`.
- Помилки більше не ховаються за "демо": фронт показує текст помилки.
- Знання: AI бере інформацію з цього ж сайту — живий снапшот DOM (`#cv-content`, `#contacts-content`) + `docs/cv.txt` (сервер читає той же файл як system KB). Жодних захардкоджених секретів у фронті.

## Local
node dev-server.js (емулює /api/* локально на :8787: /api/health, /api/chat, /api/models).
