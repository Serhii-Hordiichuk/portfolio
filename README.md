# Serhii Hordiichuk — Portfolio (B/W/G) + AI on Vercel

Frontend + API в одному проєкті Vercel (same origin). Домен уже підключений там.
Автодеплой: push в `main` → Vercel redeploy.

## Deploy (1 раз)
1. Vercel → Add New Project → Import `portfolio` repo → Framework: Other.
2. Environment Variables (Production + Preview) — ТІЛЬКИ тут, жодних полів ключа в інтерфейсі:
   OPENROUTER_API_KEY, GROQ_API_KEY, HF_TOKEN (що є),
   OLLAMA_URL=https://твій-ollama-доступ (або порожньо), OLLAMA_MODEL=llama3.1:8b,
   ALLOWED_ORIGINS=https://твій-домен
3. Deploy. Перевір: https://твій-домен/api/models → порожні списки до додавання ключів, після додавання + redeploy — живі моделі.
4. Domains: твій домен уже там — нічого міняти не треба.

## Chat
- Моделі беруться ТІЛЬКИ з Vercel env через `GET /api/models` (bulk: всі провайдери одним запитом).
- Поки ключ не додано в env → список порожній: `— no models (set key in Vercel env) —`, відправка блокується з поясненням.
- Після додавання ключа в Vercel → Redeploy → моделі підтягуються автоматично (живий запит до API провайдера його ж ключем, ключ ніколи не покидає сервер).
- Жодних захардкоджених списків: якщо env порожній — порожньо і в UI. Жодних BYOK-полів у фронті.
- Ollama: тільки серверна — `OLLAMA_URL` в env. Локальний `http://localhost:11434` видно лише локальному dev-server; на Vercel треба публічний URL тунелю (ngrok / Cloudflare Tunnel / Tailscale Funnel) + `OLLAMA_ORIGINS=*`.
- Знання: AI бере інформацію з цього ж сайту — живий снапшот DOM + `docs/cv.txt` як system KB.

## Local
node dev-server.js (емулює /api/* локально на :8787: /api/health, /api/chat, /api/models). Без env-ключів `/api/models` повертає порожні списки — так само як на Vercel.
