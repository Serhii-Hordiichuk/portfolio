# Serhii Hordiichuk — Portfolio (B/W/G) + AI on Vercel

Frontend + API in one Vercel project (same origin). Domain is already connected there.
Auto-deploy: push to `main` → Vercel redeploy.

## Project layout

```
portfolio/
├── public/            # static frontend served by Vercel (outputDirectory)
│   ├── index.html     # SPA: cover, CV, stack, contacts, chat, widgets
│   ├── assets/        # app.js, chat.js, chat-ui.js, stack.js, radio.js, news.js,
│   │                 # tv.js, widgets.js, config.js, stations.js, i18n*.js, styles.css, chat.css
│   ├── docs/          # CV-Serhii.Hordiichuk.pdf, cv.txt (knowledge base for the AI)
│   └── sw.js, manifest.json, favicon*.svg/png, apple-touch-icon.png, icon-*.png
├── api/               # Vercel serverless functions
│   ├── _lib.js        # shared logic (KB, providers, streaming, model listing)
│   ├── chat/index.js  # POST /api/chat (stream + non-stream)
│   ├── health/index.js # GET /api/health
│   └── models/index.js # GET|POST /api/models
├── scripts/
│   └── dev-server.js  # local dev server mirroring Vercel /api/* (port 8787)
├── vercel.json        # Vercel config (outputDirectory=public, function timeouts, headers)
├── .env.example       # env vars template
├── package.json
└── .github/workflows/smoke.yml
```

## Dev / Stack page ("Hobby")

- 38 technologies in 9 groups (languages, systems/Shell, P2P, private networks, AI, API, data formats, Identity/Web3, tools).
- 38 custom SVG icons (symbols `t-*`), monoline style of the site, theme-aware (light/dark).
- Filter chips + live search + counters (`public/assets/stack.js`), full translations uk/en/no, group labels also for 7 more languages.
- The stack flows automatically into the AI assistant's knowledge base (siteContext → "Tech stack: …").

## Deploy (once)

1. Vercel → Add New Project → import `portfolio` repo → Framework: Other.
2. Environment Variables (Production + Preview):
   - `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `HF_TOKEN` (whichever you have)
   - `OLLAMA_URL=https://your-public-ollama` (or empty — then local models go directly from the browser)
   - `OLLAMA_MODEL=llama3.1:8b`, `ALLOWED_ORIGINS=https://your-domain`
3. Deploy. Verify: `https://your-domain/api/models`.

## Why local models weren't visible

The Vercel server cannot see your `localhost` — different network. So:

- Cloud models (OpenRouter/Groq/HF): only via Vercel env; `GET /api/models` returns live lists.
- Local Ollama: the browser probes `your Ollama URL + /api/tags` directly and models appear automatically. The `Ollama URL` field in the chat sidebar (not a secret, localStorage). `OLLAMA_URL` in env is optional.
- Local conditions: `OLLAMA_ORIGINS=* ollama serve`, `ollama list` shows installed ones; from a phone use a tunnel URL (ngrok / Cloudflare Tunnel / Tailscale Funnel).

## Chat — full AI (like ChatGPT / Gemini)

- **Any topic**: the system runs in dual mode — questions about Serhii/the site are answered only from site info (DOM + `docs/cv.txt`); all other questions (code, explanations, creativity, math, plans, etc.) are answered freely as a general AI.
- **Images (vision)**: attach a picture with the paperclip — it is resized to 1024px (canvas) and sent to the model in OpenAI `image_url` format (OpenRouter/Groq/HF) or `images` (Ollama). For image analysis pick a vision model: Ollama `llama3.2-vision` / `llava`, Groq `llama-3.2-11b-vision-preview`, OpenRouter `meta-llama/llama-3.2-11b-vision-instruct:free`. A hint appears when you attach an image.
- **Streaming**: replies arrive token-by-token (SSE via `/api/chat`; for Ollama — directly from the browser, fallback to non-stream). `api/chat` maxDuration 60s.
- Files (txt/md/pdf/json/csv/code up to 4MB → text in context), voice input, text-to-speech, chat history.
- Knowledge about Serhii comes only from the site; keys only in Vercel env; Ollama URL in the sidebar field.

## Local

`node scripts/dev-server.js` (:8787, `/api/health`, `/api/chat` (stream+non-stream), `/api/models`).