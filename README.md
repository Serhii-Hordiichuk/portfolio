# Serhii Hordiichuk — Portfolio + AI Assistant (Vercel)

Frontend + API in one Vercel project (same origin). Auto-deploy on push to `main`.

## Project Layout

```
portfolio/
├── public/              # static frontend (Vercel outputDirectory)
│   ├── index.html       # SPA: cover, CV, stack, contacts, chat, widgets
│   ├── src/             # ESM source (built by Vite)
│   ├── assets/          # legacy assets (kept for reference)
│   ├── docs/            # CV-Serhii.Hordiichuk.pdf, cv.txt (AI knowledge base)
│   └── sw.js, manifest.json, favicon*.svg/png, apple-touch-icon.png, icon-*.png
├── api/                 # Vercel serverless functions (Node 20, ESM)
│   ├── _lib.js          # shared logic (KB, providers, streaming, model listing, rate limiting)
│   ├── chat/index.js    # POST /api/chat (streaming + non-streaming, vision, rate limited)
│   ├── health/index.js  # GET /api/health
│   └── models/index.js  # GET|POST /api/models
├── scripts/
│   └── dev-server.js    # local dev API mirror (port 8788; NEVER 8787 — that's Vite)
├── tests/
│   └── _lib.test.js     # Vitest unit tests (57 tests)
├── vite.config.js       # Vite build config (ESM, code splitting)
├── vercel.json          # Vercel config (build command, outputDirectory=dist, function timeouts, headers)
├── api/openapi.yaml     # OpenAPI 3.0 specification
├── .env.example         # environment variables template
├── package.json         # Node ≥20, scripts: dev, build, test, lint
└── .github/workflows/smoke.yml
```

## Tech Stack Page

- 38 technologies in 9 groups (Languages, Systems/Shell, P2P, Private Networks, AI/ML, APIs, Data Formats, Identity/Web3, Tools).
- 38 custom SVG icons (`t-*`), monoline style, theme-aware (light/dark).
- Filter chips + live search + counters (`src/stack.js`).
- Full i18n: 10 languages (ar, de, en, es, fr, no, pl, ru, uk, zh), sorted alphabetically in the language selector with "Auto" option.
- Stack automatically feeds into AI assistant's knowledge base (`siteContext → "Tech stack: …"`).

## Contacts Page

- 9 contact buttons rendered by `public/src/contacts.js` into `#contacts-content`:
  LinkedIn, X, Facebook, Reddit, Discord, Telegram, Gmail (with copy-email button), FINN, Frilansbasen.
- 9 custom monoline SVG icons (`c-linkedin`, `c-x`, `c-fb`, `c-reddit`, `c-discord`,
  `c-tg`, `c-gmail`, `c-finn`, `c-frilans`) in `public/index.html`, theme-aware (light/dark).
- Subtitle in 10 languages (re-rendered on `sh:lang` event).
- Placeholder links (`href: "#"`) don't navigate — the card just shakes.
  Replace them with real profile URLs in the `SH_CONTACTS` array (`public/src/contacts.js`):
  `linkedin`, `x`, `facebook`, `reddit`, `discord`, `telegram`,
  `gmail` (`href: "mailto:..."` + `copy` + `handle`), `finn`, `frilansbasen`.
- Contacts text automatically feeds into the AI assistant's knowledge base
  (`siteContext → "Contacts: …"`).

## Deploy (One-time)

1. Vercel → Add New Project → import `portfolio` repo → Framework: **Other**.
2. Build Command: `npm run build` | Output Directory: `dist`
3. Environment Variables (Production + Preview):
   - `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `HF_TOKEN` (whichever you have)
   - `OLLAMA_URL=https://your-public-ollama` (optional — browser connects directly to local Ollama)
   - `OLLAMA_MODEL=llama3.1:8b`, `ALLOWED_ORIGINS=https://your-domain`
4. Deploy. Verify: `https://your-domain/api/models`.

## Local Models (Ollama)

Vercel cannot reach your `localhost`. The browser probes `Ollama URL + /api/tags` directly:
- Cloud models (OpenRouter/Groq/HF): via Vercel env; `GET /api/models` returns live lists.
- Local Ollama: set URL in chat sidebar (localStorage, not a secret). `OLLAMA_URL` in env is optional.
- Requirements: `OLLAMA_ORIGINS=* ollama serve`, `ollama pull llama3.1:8b`.
- Mobile access: use a tunnel (ngrok, Cloudflare Tunnel, Tailscale Funnel).

## AI Chat — Full Assistant (ChatGPT/Gemini-like)

- **Dual mode**: questions about Serhii/the site → answered only from site info (DOM + `docs/cv.txt`); all other topics → general AI.
- **Vision**: attach images (paperclip) → resized to 1024px, sent as `image_url` (OpenRouter/Groq/HF) or `images` (Ollama). Vision models: `llama3.2-vision`, `llava`, `llama-3.2-11b-vision-preview`, `meta-llama/llama-3.2-11b-vision-instruct:free`.
- **Streaming**: token-by-token via SSE (`/api/chat`, maxDuration 60s); Ollama direct from browser with fallback.
- **Files**: txt/md/pdf/json/csv/code up to 4MB → text in context.
- **Voice**: speech-to-text input, text-to-speech output.
- **History**: persistent sessions (localStorage), export/copy.
- **Rate limiting**: 30 requests/minute per IP on `/api/chat`.

## Local Development

```bash
npm install          # install deps (Vite, Vitest, ESLint)
npm run dev          # concurrent: API (8788) + Vite frontend (8787)
npm run dev:api      # API only
npm run dev:frontend # Vite only
npm run build        # production build to dist/
npm run test         # Vitest (57 tests)
npm run lint         # ESLint
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Streaming/non-streaming chat, vision, multi-provider fallback, rate limited |
| `/api/models` | GET/POST | List models for all or specific provider |
| `/api/health` | GET | Health check + provider status |

See `api/openapi.yaml` for full OpenAPI 3.0 specification.

## Widgets

- **Radio**: 6 curated classical/ambient streams, geo-ordered, keyboard controls.
- **TV**: 4 live HLS channels (DW, TRT World, France 24, Red Bull TV), PiP + fullscreen.
- **News**: Infinite feed from HN, dev.to, Reddit, Lobsters, HackerNoon, Smashing Magazine; MyMemory translation, IntersectionObserver lazy load.

## Architecture Highlights

- **Zero runtime deps** in API (pure Node 20 `fetch`, `fs`, `path`).
- **Rate limiting** in-memory with automatic cleanup (works on Vercel & local).
- **JSDoc types** for all public APIs (`api/_lib.js`, `src/chat.js`).
- **Vitest** unit tests for core logic (intent detection, KB building, message formatting).
- **ESM + Vite** frontend with code splitting (vendor, i18n, chat, widgets, stack, news, app).
- **PWA** ready: manifest, service worker, install prompt.
- **Security headers**: CSP-ready, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.