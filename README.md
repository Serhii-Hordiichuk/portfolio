# Serhii Hordiichuk — Portfolio (B/W/G)

Static portfolio + full AI assistant. Frontend → GitHub Pages, proxy → Render/Fly/VPS.

## Files
- `index.html` — tabs: Home / Resume / IT / Assistant
- `assets/` — styles, config, i18n (uk/en/no), app, chat (proxy-first + BYOK direct + demo)
- `server.js` — zero-dep Node proxy: GET /api/health, POST /api/chat (ollama, openrouter, groq, hf, openai)
- `docs/CV-Serhii.Hordiichuk.pdf`

## Local
cp .env.example .env
node server.js

## Deploy
1. Pages: Settings → Pages → main → / (root).
2. Proxy: Render Web Service, start `node server.js`, env keys + OLLAMA_URL + ALLOWED_ORIGINS=https://you.github.io.
3. Paste Proxy URL in gear panel → status online.

