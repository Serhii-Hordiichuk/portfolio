# Serhii Hordiichuk — Portfolio (B/W/G) + AI on Vercel

Frontend + API в одному проєкті Vercel (same origin). Домен уже підключений там.
Автодеплой: push в `main` → Vercel redeploy.

## Dev / Stack сторінка («Розробки»)

- 38 технологій у 9 групах (мови, системи/Shell, P2P, приватні мережі, AI, API, формати даних, Identity/Web3, інструменти).
- 38 кастомні SVG-іконки (symbol `t-*`), monoline-стиль сайту, theme-aware (light/dark).
- Чіпси-фільтри + живий пошук + лічильники (`assets/stack.js`), повні переклади uk/en/no, назви груп ще для 7 мов.
- Стек автоматично потрапляє в knowledge асистента (siteContext → «Tech stack: …»).

## Deploy (1 раз)
1. Vercel → Add New Project → Import `portfolio` repo → Framework: Other.
2. Environment Variables (Production + Preview):
   OPENROUTER_API_KEY, GROQ_API_KEY, HF_TOKEN (що є),
   OLLAMA_URL=https://твій-публічний-ollama (або порожньо — тоді локальні моделі йдуть напряму з браузера),
   OLLAMA_MODEL=llama3.1:8b, ALLOWED_ORIGINS=https://твій-домен
3. Deploy. Перевір: https://твій-домен/api/models.

## Чому локальних моделей не було видно
Vercel-сервер не бачить твій `localhost` — це різна мережа. Тому:
- Хмарні моделі (OpenRouter/Groq/HF): тільки з Vercel env, `GET /api/models` повертає живі списки.
- Локальна Ollama: браузер сам опитує `твій Ollama URL + /api/tags` і моделі з'являються автоматично. Поле `Ollama URL` в сайдбарі чату (не секрет, localStorage). `OLLAMA_URL` в env — опційно.
- Умови локалки: `OLLAMA_ORIGINS=* ollama serve`, `ollama list` показує скачані, з телефона — URL тунелю (ngrok / Cloudflare Tunnel / Tailscale Funnel).

## Chat — повноцінний ШІ (як ChatGPT / Gemini)
- **Будь-які теми**: система працює в dual mode — про Сергія/сайт відповідає тільки з інформації сайту (DOM + docs/cv.txt), на всі інші питання (код, пояснення, творчість, математика, плани тощо) відповідає вільно як загальний ШІ.
- **Зображення (vision)**: прикріплюй картинки скріпкою — вони стискаються до 1024px (canvas) і шлються моделі в OpenAI-форматі `image_url` (OpenRouter/Groq/HF) або `images` (Ollama). Для аналізу зображень обери vision-модель: Ollama `llama3.2-vision` / `llava`, Groq `llama-3.2-11b-vision-preview`, OpenRouter `meta-llama/llama-3.2-11b-vision-instruct:free`. Підказка з'являється при прикріпленні картинки.
- **Стрімінг**: відповіді йдуть токен-за-токеном (SSE через /api/chat; для Ollama — напряму з браузера, fallback на non-stream). `api/chat` maxDuration 60s.
- Файли (txt/md/pdf/json/csv/code до 4MB → текст у контекст), голосовий ввід, озвучка відповідей, історія чатів.
- Знання про Сергія тільки із сайту; ключі тільки в Vercel env; Ollama URL в полі сайдбара.

## Local
node dev-server.js (:8787, /api/health, /api/chat (stream+non-stream), /api/models).
