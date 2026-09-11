# Serhii Hordiichuk — Portfolio (B/W/G) + AI on Vercel

Frontend + API в одному проєкті Vercel (same origin). Домен уже підключений там.
Автодеплой: push в `main` → Vercel redeploy.

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
- Локальна Ollama: браузер сам опитує `твій Ollama URL + /api/tags` (direct probe) і моделі з'являються автоматично. Поле `Ollama URL` в сайдбарі чату (не секрет, зберігається в localStorage). Vercel env `OLLAMA_URL` — опційно, для серверного шляху.
- Умови для локалки: `OLLAMA_ORIGINS=* ollama serve` (інакше браузер заблокує CORS), `ollama list` показує скачані, URL доступний з цього пристрою (`http://localhost:11434` — тільки на тому ж ПК; з телефона — URL тунелю: ngrok / Cloudflare Tunnel / Tailscale Funnel).
- Чат: якщо proxy недоступний — фронт говорить з Ollama напряму (`/v1/chat/completions` → fallback `/api/chat`).

## Chat (повноцінний)
- Історії чатів (30, localStorage), перейменування-автозаголовок, видалення, копія всього чату, копія/озвучка кожної відповіді.
- Голос: ввід мікрофоном (Web Speech Recognition) + озвучка відповідей (TTS, перемикач Voice answers).
- Файли: скріпка (txt/md/pdf/json/csv/code до 2MB як текст + картинки-превʼю), текст файлів йде в system KB.
- Мобільна клавіатура: висота через visualViewport (`--vv-h`), композер не ховається, автодоставка вниз.
- Знання: тільки з сайту (живий DOM + `docs/cv.txt`).

## Local
node dev-server.js (:8787, /api/health, /api/chat, /api/models).
