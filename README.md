# Serhii Hordiichuk — Portfolio (Astro)

Професійне монохромне портфоліо на **Astro** (static) + Vercel serverless API. Віджети (Radio / TV / News) видалено.

## Розділи

- **Hero** — ім'я, роль, статуси, CTA
- **Resume** (`/#resume`) — CV з `src/data/cv.ts` (10 мов), кнопка PDF (`public/docs/`)
- **Stack** (`/#stack`) — 38 технологій у 9 групах, пошук + фільтр (`src/data/stack.ts`)
- **Contacts** (`/#contacts`) — 9 каналів (`src/data/contacts.ts`)
- **Assistant** (`/sh_ai` (додаток `apps/sh_ai`), окрема сторінка без хедера портфоліо) — повноцінний ШІ-чат:
  Gemini-стиль (щоразу різне анімоване привітання, ввод під ним), топбар без ліній:
  зліва dropdown Flash (Groq) / Deep (OpenRouter, модель з апі) / Uncensored (приватна Ollama з `.env`),
  справа тумблер запису в історію. shadcn Sidebar тільки з чатами, icon-rail, бульбашки.

## Палітра й іконки

- Строго **чорний / білий / сірий** (`src/styles/global.css`, light + dark auto)
- 58 монохромних SVG (`src/components/Icons.astro`, `stroke=currentColor`): навігація, контакти (9), стек (38)

## Структура

```
portfolio/
├── src/
│   ├── pages/index.astro + sh_ai.astro (/sh_ai → apps/sh_ai/App.astro)
│   ├── layouts/Base.astro
│   ├── components/Header|Hero|Resume|Stack|Contacts|Icons.astro
│   ├── data/i18n.ts (10 мов: uk,en,no,de,fr,es,pl,ru,zh,ar)
│   ├── data/cv.ts | contacts.ts | stack.ts
│   ├── scripts/app.ts (головна: мова, тема, CV, фільтр)
│   └── styles/global.css (монохром)
├── apps/sh_ai/ (окремий додаток: App.astro, ui/, scripts/, styles/ — див. apps/sh_ai/README.md)
├── public/ (favicons, manifest.json, docs/cv.txt + PDF)
├── api/ (_lib.js, chat, health, models — ключі ТІЛЬКИ з env)
├── tests/ (53 тести: api _lib + CV)
├── astro.config.mjs (proxy /api → :8788 локально)
└── dist/ (build output, в .gitignore)
```

## Мова і тема — автоматично з пристрою

За замовчуванням (`Auto`) мова береться з `navigator.language`, тема — з
`prefers-color-scheme` і живе підтягується при зміні системної теми.
Вибір у хедері (`UA/EN/...`, кнопка теми) зберігається в localStorage.

## Моделі (.env — все тут, користувач нічого не чіпає)

```bash
OPENROUTER_API_KEY=...            # дефолт-модель: openrouter/free (роутер free-моделей)
# OPENROUTER_MODEL=openrouter/free
GROQ_API_KEY=...                  # дефолт: openai/gpt-oss-20b (з живого каталогу Groq)
# GROQ_MODEL=openai/gpt-oss-20b
# OLLAMA_URL=http://localhost:11434  # опційно — браузер ходить напряму
# OLLAMA_MODEL=llama3.1:8b
```

Порядок fallback при provider=auto: ollama → openrouter → groq.

## Команди

```bash
npm install
npm run dev      # API :8788 + Astro :8787
npm run build    # astro build → dist/
npm run test     # vitest (53 tests)
npm run lint     # eslint api+scripts+tests
```

## Deploy (Vercel)

- Build Command: `npm run build` | Output Directory: `dist`
- Env: `OPENROUTER_API_KEY`, `GROQ_API_KEY`
- Перевірка: `https://your-domain/api/models`

## Що видалено

- `news.js`, `radio-player.js`, `tv-player.js`, `widgets.js`, `stations.js`
- `hls.js` dep, `vite.config.js`, `tests/media.test.js`, `public/src|assets`, `sw.js`
- Ключі i18n віджетів (`tv/radio/news/live/...`), `navHobby` → `navStack`
