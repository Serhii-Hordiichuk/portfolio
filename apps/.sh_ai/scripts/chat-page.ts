/* SH chat page — full AI chat, zero user settings.
 * Sidebar (shadcn composition): sessions only. Provider/model fixed to auto.
 * All message actions live on bubbles. */
import { SH_AI_STR } from '../strings';
import {
  setUiLang,
  formatMsg,
  sysMsg,
  viaProxy, viaProxyStream,
  speak, stopSpeak, readFile,
  type ChatMessage, type Attachment,
} from './chat-core';

const $ = <T extends HTMLElement = HTMLElement>(s: string): T | null => document.querySelector(s);
const $$ = (s: string): HTMLElement[] => Array.from(document.querySelectorAll(s));

const store = {
  get(k: string, d: string): string { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch {} },
};

const isDesktop = (): boolean => window.matchMedia('(min-width: 900px)').matches;

type Mode = 'flash' | 'deep' | 'uncensored';
const MODES: Mode[] = ['flash', 'deep', 'uncensored'];
function curMode(): Mode {
  const m = store.get('sh.mode', 'flash');
  return (MODES as string[]).includes(m) ? (m as Mode) : 'flash';
}
function modeTarget(): { p: string; m: string } {
  const mode = curMode();
  if (mode === 'deep') return { p: 'openrouter', m: store.get('sh.deepModel', 'auto') || 'auto' };
  if (mode === 'uncensored') return { p: 'ollama', m: 'auto' };
  return { p: 'groq', m: 'auto' };
}
let lang = store.get('sh.lang', detectLang());
let sending = false;
let aborter: AbortController | null = null;
let recog: unknown = null;
let recogOn = false;
let pendingFiles: Attachment[] = [];
let sessQuery = '';

function detectLang(): string {
  try {
    const b = (navigator.language || 'uk').toLowerCase();
    if (b.startsWith('uk')) return 'uk';
    if (b.startsWith('nb') || b.startsWith('nn') || b.startsWith('no')) return 'no';
    if (b.startsWith('zh')) return 'zh';
    if (b.startsWith('ar')) return 'ar';
    if (b.startsWith('de')) return 'de';
    if (b.startsWith('fr')) return 'fr';
    if (b.startsWith('es')) return 'es';
    if (b.startsWith('pl')) return 'pl';
    if (b.startsWith('ru')) return 'ru';
    if (b.startsWith('en')) return 'en';
  } catch {}
  return 'uk';
}
function S(): { newChat: string; ph: string; search: string } {
  return SH_AI_STR[lang] || SH_AI_STR.en;
}
function applyLang(choice: string): void {
  const l = SH_AI_STR[choice] ? choice : 'auto';
  lang = l === 'auto' ? detectLang() : l;
  if (!SH_AI_STR[lang]) lang = 'en';
  store.set('sh.lang', l);
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  const D = S();
  $$('[data-i18n]').forEach((el) => {
    if (el.getAttribute('data-i18n') === 'newChat') el.innerHTML = D.newChat;
  });
  $$('[data-i18n-ph]').forEach((el) => {
    const k = el.getAttribute('data-i18n-ph') || '';
    if (k === 'ph') (el as HTMLTextAreaElement).placeholder = D.ph;
    if (k === 'search') (el as HTMLInputElement).placeholder = D.search;
  });
  setUiLang(l);
  greet();
}
function applyTheme(): void {
  const m = store.get('sh.theme', 'auto');
  const dark = m === 'dark' || (m === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark', dark);
}
function renderThemeIcon(): void {
  const btn = $('#theme-btn');
  if (!btn) return;
  const m = store.get('sh.theme', 'auto');
  const icon = m === 'dark' ? 'i-moon' : m === 'light' ? 'i-sun' : 'i-contrast';
  btn.innerHTML = '<svg class="ic"><use href="#' + icon + '"/></svg>';
}

/* ---------- sidebar: offcanvas on mobile, icon rail on desktop ---------- */
function setSbOpen(open: boolean): void {
  $('#sb-provider')?.setAttribute('data-open', open ? 'true' : 'false');
}
function setSbCollapsed(c: boolean): void {
  $('#sb-provider')?.setAttribute('data-collapsed', c ? 'true' : 'false');
  store.set('sh.sbcollapsed', c ? '1' : '0');
}
function toggleSb(): void {
  const p = $('#sb-provider');
  if (!p) return;
  if (isDesktop()) setSbCollapsed(p.getAttribute('data-collapsed') !== 'true');
  else setSbOpen(p.getAttribute('data-open') !== 'true');
}

/* ---------- toast ---------- */
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let toastT = 0;
function toast(t: string): void {
  const el = $('#cx-toast');
  if (!el) return;
  el.textContent = t;
  el.classList.add('show');
  window.clearTimeout(toastT);
  toastT = window.setTimeout(() => el.classList.remove('show'), 1600);
}

/* ---------- messages (actions on bubbles) ---------- */
function scrollBottom(): void {
  const s = $('#chat-scroll');
  if (s) s.scrollTo({ top: s.scrollHeight, behavior: 'smooth' });
}
function msgCount(): number {
  return $('#chat-inner')?.querySelectorAll('.msg2').length || 0;
}
function addMsg(text: string, who: 'user' | 'bot', viaText?: string): HTMLElement {
  const host = $('#chat-inner')!;
  const d = document.createElement('div');
  d.className = 'msg2 ' + who;
  const col = document.createElement('div');
  col.style.cssText = 'display:flex;flex-direction:column;max-width:85%;min-width:0';
  if (who === 'user') col.style.alignItems = 'flex-end';
  const b = document.createElement('div');
  b.className = 'bubble';
  b.innerHTML = formatMsg(text);
  col.appendChild(b);
  if (viaText) {
    const v = document.createElement('div');
    v.className = 'via';
    v.textContent = viaText;
    col.appendChild(v);
  }
  const acts = document.createElement('div');
  acts.className = 'acts';
  const cp = document.createElement('button');
  cp.className = 'act'; cp.title = 'Copy';
  cp.innerHTML = '<svg class="ic"><use href="#i-copy"/></svg>';
  cp.addEventListener('click', () => {
    try { navigator.clipboard.writeText(String(text || '')); } catch {}
    cp.classList.add('ok');
    setTimeout(() => cp.classList.remove('ok'), 900);
  });
  acts.appendChild(cp);
  if (who === 'bot') {
    const sp = document.createElement('button');
    sp.className = 'act'; sp.title = 'Read aloud';
    sp.innerHTML = '<svg class="ic"><use href="#i-vol"/></svg>';
    sp.addEventListener('click', () => speak(String(text || '')));
    acts.appendChild(sp);
    const tr = document.createElement('button');
    tr.className = 'act'; tr.title = 'Translate';
    tr.innerHTML = '<svg class="ic"><use href="#i-lang"/></svg>';
    tr.addEventListener('click', () => translateNode(d));
    acts.appendChild(tr);
    const de = document.createElement('button');
    de.className = 'act'; de.title = 'More detail';
    de.innerHTML = '<svg class="ic"><use href="#i-expand"/></svg>';
    de.addEventListener('click', detailAsk);
    acts.appendChild(de);
    const rg = document.createElement('button');
    rg.className = 'act regen'; rg.title = 'Regenerate';
    rg.innerHTML = '<svg class="ic"><use href="#i-reload"/></svg>';
    rg.addEventListener('click', regenLast);
    acts.appendChild(rg);
  }
  col.appendChild(acts);
  d.appendChild(col);
  host.appendChild(d);
  scrollBottom();
  refreshRegen();
  return d;
}
function addFilesMsg(files: Attachment[]): void {
  const host = $('#chat-inner');
  if (!host || !files.length) return;
  const d = document.createElement('div');
  d.className = 'msg2 user';
  const col = document.createElement('div');
  col.style.cssText = 'display:flex;flex-direction:column;gap:.375rem;max-width:85%;align-items:flex-end';
  files.slice(0, 4).forEach((f) => {
    const chip = document.createElement('div');
    chip.className = 'filechip2';
    if (f.kind === 'image' && f.dataUrl) {
      const im = document.createElement('img');
      im.src = f.dataUrl; im.alt = f.name || 'image'; im.loading = 'lazy';
      chip.appendChild(im);
    }
    const nm = document.createElement('span');
    nm.textContent = (f.name || 'file') + (f.size ? ' (' + Math.round(f.size / 1024) + ' KB)' : '');
    chip.appendChild(nm);
    col.appendChild(chip);
  });
  d.appendChild(col);
  host.appendChild(d);
  scrollBottom();
}
function clearMsgs(): void {
  const h = $('#chat-inner');
  if (h) h.innerHTML = '';
}

/* ---------- sessions ---------- */
interface Session { id: string; title: string; msgs: Array<{ role: string; content: string; viaText?: string }>; ts: number }
function sessions(): Session[] {
  try {
    const v = JSON.parse(localStorage.getItem('sh.sessions') || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function saveSessions(s: Session[]): void {
  try { localStorage.setItem('sh.sessions', JSON.stringify((s || []).slice(0, 30))); } catch {}
}
function curId(): string { return store.get('sh.cur', ''); }
function setCur(id: string): void { store.set('sh.cur', id); }
function snapshot(): Array<{ role: string; content: string; viaText?: string }> {
  const host = $('#chat-inner');
  if (!host) return [];
  return Array.from(host.querySelectorAll('.msg2')).map((m) => ({
    role: m.classList.contains('user') ? 'user' : 'assistant',
    content: m.querySelector('.bubble')?.textContent || '',
    viaText: m.querySelector('.via')?.textContent || undefined,
  })).filter((m) => m.content && m.content.trim() && m.content.trim() !== '…');
}
function persist(): void {
  const id = curId();
  if (!id) return;
  const msgs = snapshot();
  const f = msgs.find((m) => m.role === 'user');
  const title = (f && f.content) || 'New chat';
  const all = sessions();
  const rec: Session = { id, title: String(title).slice(0, 42), msgs: msgs.slice(-100), ts: Date.now() };
  const i = all.findIndex((s) => s.id === id);
  if (i >= 0) all[i] = rec;
  else all.unshift(rec);
  saveSessions(all);
  renderSessions();
}
function renderSessions(): void {
  const box = $('#sessions');
  if (!box) return;
  box.innerHTML = '';
  const all = sessions();
  const q = sessQuery.trim().toLowerCase();
  const shown = q ? all.filter((s) => (s.title || '').toLowerCase().includes(q)) : all;
  $('#sess-empty')!.style.display = shown.length ? 'none' : 'block';
  shown.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'sb-menu-item';
    const btn = document.createElement('button');
    btn.className = 'sb-menu-button' + (s.id === curId() ? ' active' : '');
    btn.title = s.title || 'Chat';
    const av = document.createElement('span');
    av.className = 'avatar2';
    av.style.cssText = 'width:1.5rem;height:1.5rem;font-size:.625rem';
    av.textContent = (s.title || 'C').slice(0, 1).toUpperCase();
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = s.title || 'Chat';
    btn.append(av, t);
    btn.addEventListener('click', () => openSession(s.id));
    const del = document.createElement('button');
    del.className = 'sb-menu-action';
    del.title = 'Delete';
    del.innerHTML = '<svg class="ic"><use href="#i-trash"/></svg>';
    del.addEventListener('click', (e) => { e.stopPropagation(); delSession(s.id); });
    li.append(btn, del);
    box.appendChild(li);
  });
}
function openSession(id: string): void {
  setCur(id);
  if (!isDesktop()) setSbOpen(false);
  clearMsgs();
  const s = sessions().find((x) => x.id === id);
  ((s && s.msgs) || []).forEach((m) => addMsg(m.content, m.role === 'user' ? 'user' : 'bot', m.viaText));
  greet();
  renderSessions();
}
function newSession(): void {
  const id = 's' + Date.now();
  setCur(id);
  clearMsgs();
  clearPending();
  greet();
  renderSessions();
}
function delSession(id: string): void {
  const rest = sessions().filter((s) => s.id !== id);
  saveSessions(rest);
  if (id === curId()) {
    if (rest.length) openSession(rest[0].id);
    else newSession();
  } else renderSessions();
}
function exportSession(): void {
  const s = sessions().find((x) => x.id === curId());
  const txt = ((s && s.msgs) || snapshot()).map((m) => (m.role === 'user' ? 'YOU: ' : 'AI: ') + m.content).join('\n\n');
  try { navigator.clipboard.writeText(txt || 'empty'); toast('copied'); } catch { toast('copy failed'); }
}

/* ---------- greeting + suggestions ---------- */
const GREETS: Record<string, string[]> = {
  uk: [
    'Привіт, я .sh_ai, чим можу допомогти сьогодні?',
    'Привіт, я .sh_ai, що будемо досліджувати?',
    'Привіт, я .sh_ai, з чого почнемо?',
    'Привіт, я .sh_ai, що створимо разом?',
    'Привіт, я .sh_ai, про що поговоримо?',
    'Привіт, я .sh_ai, який у нас план?',
  ],
  en: [
    'Hi, I\'m .sh_ai, how can I help today?',
    'Hi, I\'m .sh_ai, what shall we explore?',
    'Hi, I\'m .sh_ai, where do we start?',
    'Hi, I\'m .sh_ai, what will we build?',
    'Hi, I\'m .sh_ai, what shall we talk about?',
  ],
  no: [
    'Hei, jeg er .sh_ai, hvordan kan jeg hjelpe i dag?',
    'Hei, jeg er .sh_ai, hva skal vi utforske?',
    'Hei, jeg er .sh_ai, hvor begynner vi?',
    'Hei, jeg er .sh_ai, hva skal vi lage?',
  ],
};
let typeTimer = 0;
let lastGreet = -1;
function stopTyping(): void {
  window.clearInterval(typeTimer);
}
function typeGreet(text: string): void {
  const el = $('#hero-greet');
  const caret = $('#hero-caret');
  if (!el) return;
  stopTyping();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    if (caret) caret.style.display = 'none';
    return;
  }
  if (caret) caret.style.display = '';
  el.textContent = '';
  let i = 0;
  typeTimer = window.setInterval(() => {
    i++;
    el.textContent = text.slice(0, i);
    if (i >= text.length) stopTyping();
  }, 28);
}
function setEmptyMode(on: boolean): void {
  const inset = $('#sb-inset');
  const composer = $('.composer2');
  const hero = $('#hero') as HTMLElement | null;
  if (on) {
    inset?.classList.add('is-empty');
    if (composer && hero) hero.after(composer);
  } else {
    inset?.classList.remove('is-empty');
    if (composer && inset) inset.appendChild(composer);
  }
}
function greet(): void {
  const sk = $('#chat-skel');
  if (sk) sk.style.display = 'none';
  const hero = $('#hero') as HTMLElement | null;
  const inset = $('#sb-inset');
  if (!hero) return;
  if (msgCount() > 0) {
    hero.style.display = 'none';
    stopTyping();
    setEmptyMode(false);
    return;
  }
  hero.classList.remove('leaving');
  hero.style.display = '';
  const list = GREETS[lang] || GREETS.en;
  let idx = Math.floor(Math.random() * list.length);
  if (list.length > 1 && idx === lastGreet) idx = (idx + 1) % list.length;
  lastGreet = idx;
  typeGreet(list[idx]);
  setEmptyMode(true);
}


/* ---------- composer: files + voice ---------- */
function autoresize(): void {
  const ta = $('#chat-input') as HTMLTextAreaElement | null;
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
}
function stopRec(): void {
  try { (recog as { stop?: () => void })?.stop?.(); } catch {}
  recogOn = false;
  $('#mic')?.classList.remove('on');
}
function toggleRec(): void {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  const btn = $('#mic');
  if (!SR) { toast('voice input not supported'); return; }
  if (recogOn) { stopRec(); return; }
  try {
    const R = SR as new () => {
      lang: string; interimResults: boolean; continuous: boolean;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onend: (() => void) | null; onerror: (() => void) | null;
      start(): void; stop(): void;
    };
    recog = new R();
    const r = recog as InstanceType<typeof R>;
    r.lang = lang === 'uk' ? 'uk-UA' : lang === 'no' ? 'nb-NO' : lang === 'ru' ? 'ru-RU'
      : lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES'
      : lang === 'pl' ? 'pl-PL' : lang === 'zh' ? 'zh-CN' : lang === 'ar' ? 'ar-SA' : 'en-US';
    r.interimResults = true;
    r.continuous = false;
    const ta = $('#chat-input') as HTMLTextAreaElement | null;
    const base = ta ? ta.value : '';
    r.onresult = (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (ta) { ta.value = (base ? base + ' ' : '') + txt; autoresize(); }
    };
    r.onend = () => { recogOn = false; btn?.classList.remove('on'); };
    r.onerror = () => { recogOn = false; btn?.classList.remove('on'); };
    r.start();
    recogOn = true;
    btn?.classList.add('on');
  } catch { toast('mic failed'); }
}
function renderPending(): void {
  const bar = $('#cx-files');
  if (!bar) return;
  bar.innerHTML = '';
  pendingFiles.forEach((f, i) => {
    const c = document.createElement('span');
    c.className = 'pfile2';
    const nm = document.createElement('span');
    nm.textContent = (f.name || 'file').slice(0, 24);
    const x = document.createElement('button');
    x.type = 'button'; x.textContent = '×';
    x.setAttribute('aria-label', 'Remove file');
    x.addEventListener('click', () => { pendingFiles.splice(i, 1); renderPending(); });
    c.append(nm, x);
    bar.appendChild(c);
  });
  bar.classList.toggle('show', pendingFiles.length > 0);
}
function clearPending(): void {
  pendingFiles = [];
  renderPending();
  const fi = $('#file') as HTMLInputElement | null;
  if (fi) fi.value = '';
}
async function onFiles(files: FileList | null): Promise<void> {
  const arr = Array.from(files || []).slice(0, 3);
  for (const f of arr) pendingFiles.push(await readFile(f));
  pendingFiles = pendingFiles.slice(0, 3);
  renderPending();
  if (pendingFiles.length) toast(pendingFiles.length + ' file(s) attached');
}

/* ---------- send (provider fixed: auto) ---------- */
function setSendMode(mode: 'send' | 'stop'): void {
  const btn = $('#send');
  if (!btn) return;
  btn.classList.toggle('stop', mode === 'stop');
  btn.innerHTML = mode === 'stop' ? '<svg class="ic"><use href="#i-stop"/></svg>' : '<svg class="ic"><use href="#i-send"/></svg>';
}
function errText(e: unknown): string {
  const m = String((e as Error)?.message || e || 'request failed');
  return (lang === 'uk' ? 'Помилка: ' : lang === 'no' ? 'Feil: ' : 'Error: ') + m;
}
function historyMsgs(limit: number): ChatMessage[] {
  const host = $('#chat-inner');
  if (!host) return [];
  return Array.from(host.querySelectorAll('.msg2'))
    .map((m) => ({
      role: (m.classList.contains('user') ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.querySelector('.bubble')?.textContent || '',
    }))
    .filter((m) => m.content && m.content.trim() && m.content.trim() !== '…')
    .slice(-limit);
}
async function send(): Promise<void> {
  if (sending) return;
  const inp = $('#chat-input') as HTMLTextAreaElement | null;
  if (!inp) return;
  const q = inp.value.trim();
  if (!q && !pendingFiles.length) return;
  const wasEmpty = msgCount() === 0;
  sending = true;
  if (wasEmpty) {
    const hero = $('#hero') as HTMLElement | null;
    hero?.classList.add('leaving');
    await wait(230);
    if (hero) hero.style.display = 'none';
    stopTyping();
    setEmptyMode(false);
  }
  stopRec();
  stopSpeak();
  aborter = new AbortController();
  setSendMode('stop');
  const files = pendingFiles.slice();
  inp.value = '';
  autoresize();
  if (files.length) addFilesMsg(files);
  if (q) addMsg(q, 'user');
  else addMsg('(files attached: ' + files.map((f) => f.name).join(', ') + ')', 'user');
  clearPending();
  $('#typing')?.classList.add('show');
  const msgs = historyMsgs(10);
  const botNode = addMsg('…', 'bot');
  const sysMsgs: ChatMessage[] = [sysMsg()].concat(msgs);
  try { await runLLM(sysMsgs, files, botNode); }
  catch { /* error bubble already set */ }
  sending = false;
  aborter = null;
  setSendMode('send');
  persist();
  inp.focus({ preventScroll: true });
}

/* ---------- shared runner: streams into botNode, sets via:model ---------- */
async function runLLM(sysMsgs: ChatMessage[], files: Attachment[], botNode: HTMLElement): Promise<string> {
  const bubble = botNode.querySelector('.bubble')!;
  const tgt = modeTarget();
  let partial = '';
  let gotFirst = false;
  const onDelta = (d: string): void => {
    partial += d;
    if (!gotFirst) { gotFirst = true; $('#typing')?.classList.remove('show'); }
    bubble.innerHTML = formatMsg(partial);
    const sc = $('#chat-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  };
  try {
    let ans;
    try { ans = await viaProxyStream(tgt.p, tgt.m, sysMsgs, files, onDelta, aborter!.signal); }
    catch { ans = await viaProxy(tgt.p, tgt.m, sysMsgs, files, aborter!.signal); }
    $('#typing')?.classList.remove('show');
    bubble.innerHTML = formatMsg(ans.reply);
    const col = botNode.querySelector('div')!;
    const v = document.createElement('div');
    v.className = 'via';
    v.textContent = 'via:' + curMode();
    col.insertBefore(v, col.querySelector('.acts'));
    scrollBottom();
    return ans.reply;
  } catch (e) {
    $('#typing')?.classList.remove('show');
    if ((e as Error)?.name === 'AbortError') bubble.innerHTML = formatMsg(partial ? partial + '\n\n— stopped' : '— stopped');
    else bubble.innerHTML = formatMsg(errText(e));
    throw e;
  }
}

function langName(): string {
  const m: Record<string, string> = {
    uk: 'Ukrainian', en: 'English', no: 'Norwegian Bokmål', de: 'German', fr: 'French',
    es: 'Spanish', pl: 'Polish', ru: 'Russian', zh: 'Simplified Chinese', ar: 'Arabic',
  };
  return m[lang] || 'English';
}
const DETAIL_Q: Record<string, string> = {
  uk: 'Поясни детальніше, крок за кроком', en: 'Explain in more detail, step by step',
  no: 'Forklar mer detaljert, steg for steg', de: 'Erkläre ausführlicher, Schritt für Schritt',
  fr: 'Explique plus en détail, étape par étape', es: 'Explica con más detalle, paso a paso',
  pl: 'Wyjaśnij dokładniej, krok po kroku', ru: 'Объясни подробнее, шаг за шагом',
  zh: '更详细地解释，一步一步来', ar: 'اشرح بمزيد من التفصيل، خطوة بخطوة',
};

/* ---------- message actions: translate / regenerate / more detail ---------- */
function refreshRegen(): void {
  const bots = Array.from(document.querySelectorAll('#chat-inner .msg2.bot'));
  bots.forEach((b, i) => {
    const btn = b.querySelector('.regen') as HTMLElement | null;
    if (btn) btn.style.display = i === bots.length - 1 ? '' : 'none';
  });
}
async function busy<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (sending) return undefined;
  sending = true;
  stopRec();
  stopSpeak();
  aborter = new AbortController();
  setSendMode('stop');
  $('#typing')?.classList.add('show');
  try { return await fn(); }
  finally {
    sending = false;
    aborter = null;
    setSendMode('send');
  }
}
async function translateNode(botNode: HTMLElement): Promise<void> {
  const src = botNode.querySelector('.bubble')?.textContent?.trim() || '';
  if (!src) return;
  await busy(async () => {
    const node = addMsg('…', 'bot');
    const msgs: ChatMessage[] = [{
      role: 'user',
      content: 'Translate the following text into ' + langName() + '. Reply with ONLY the translation, no explanations:\n\n' + src.slice(0, 3000),
    }];
    try { await runLLM([sysMsg()].concat(msgs), [], node); } catch { /* bubble set */ }
    persist();
  });
}
async function regenLast(): Promise<void> {
  const host = $('#chat-inner');
  if (!host) return;
  const bots = Array.from(host.querySelectorAll('.msg2.bot'));
  const last = bots[bots.length - 1] as HTMLElement | undefined;
  if (!last) return;
  await busy(async () => {
    const msgs = historyMsgs(50);
    while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    last.querySelector('.bubble')!.innerHTML = formatMsg('…');
    try { await runLLM([sysMsg()].concat(msgs), [], last); } catch { /* bubble set */ }
    persist();
  });
}
function detailAsk(): void {
  if (sending) return;
  const ta = $('#chat-input') as HTMLTextAreaElement | null;
  if (!ta) return;
  ta.value = DETAIL_Q[lang] || DETAIL_Q.en;
  autoresize();
  send();
}

async function fetchDeepModel(): Promise<void> {
  try {
    const r = await fetch('/api/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const d = await r.json().catch(() => ({}));
    const models: string[] = (d.providers && d.providers.openrouter && d.providers.openrouter.models) || [];
    if (models.length) {
      store.set('sh.deepModel', models[0]);
      return;
    }
  } catch {}
  store.set('sh.deepModel', 'auto');
}

/* ---------- viewport: pin header + composer, follow mobile keyboard ---------- */
function fitViewport(): void {
  try {
    const vv = window.visualViewport;
    const h = vv ? Math.round(vv.height) : window.innerHeight;
    document.documentElement.style.setProperty('--vv-h', h + 'px');
  } catch {}
}
function viewportFix(): void {
  try {
    fitViewport();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', fitViewport);
      vv.addEventListener('scroll', fitViewport);
    }
    window.addEventListener('resize', fitViewport);
    window.addEventListener('orientationchange', fitViewport);
  } catch {}
}

/* ---------- boot ---------- */
function boot(): void {
  applyLang(lang);
  applyTheme();
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      if (store.get('sh.theme', 'auto') === 'auto') applyTheme();
    });
  } catch {}

  const sendBtn = $('#send')!;
  sendBtn.addEventListener('click', () => {
    if (sending && aborter) { aborter.abort(); return; }
    send();
  });
  $('#mic')?.addEventListener('click', toggleRec);
  const attach = $('#attach');
  const fi = $('#file') as HTMLInputElement | null;
  if (attach && fi) {
    attach.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => { onFiles(fi.files); fi.value = ''; });
  }
  $('#cx-export')?.addEventListener('click', exportSession);
  $('#cx-clear')?.addEventListener('click', () => { clearMsgs(); greet(); persist(); });
  $('#new-chat')?.addEventListener('click', newSession);
  const ta = $('#chat-input') as HTMLTextAreaElement | null;
  ta?.addEventListener('input', autoresize);
  ta?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  $('#sb-trigger')?.addEventListener('click', (e) => { e.stopPropagation(); toggleSb(); });
  $('#sb-overlay')?.addEventListener('click', () => setSbOpen(false));
  document.addEventListener('click', (e) => {
    if (isDesktop()) return;
    if ($('#sb-provider')?.getAttribute('data-open') === 'true'
      && !$('#sb')?.contains(e.target as Node)
      && !$('#sb-trigger')?.contains(e.target as Node)) setSbOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSb(); }
    if (e.key === 'Escape') { setSbOpen(false); $('#mode-dd')?.classList.remove('open'); stopRec(); stopSpeak(); }
  });

  setSbCollapsed(store.get('sh.sbcollapsed', '0') === '1');
  setSbOpen(false);
  renderThemeIcon();
  $('#theme-btn')?.addEventListener('click', () => {
    const cur = store.get('sh.theme', 'auto');
    store.set('sh.theme', cur === 'dark' ? 'light' : cur === 'light' ? 'auto' : 'dark');
    applyTheme();
    renderThemeIcon();
  });

  // mode dropdown
  const dd = $('#mode-dd');
  const menu = $('#mode-menu');
  const mbtn = $('#mode-btn');
  const renderMode = (): void => {
    const m = curMode();
    $('#mode-name')!.textContent = m === 'flash' ? 'Flash' : m === 'deep' ? 'Deep' : 'Uncensored';
    menu?.querySelectorAll('.dd-item').forEach((it) => {
      it.classList.toggle('picked', (it as HTMLElement).getAttribute('data-mode') === m);
    });
    mbtn?.setAttribute('aria-expanded', dd?.classList.contains('open') ? 'true' : 'false');
  };
  const closeMenu = (): void => {
    dd?.classList.remove('open');
    mbtn?.setAttribute('aria-expanded', 'false');
  };
  mbtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dd?.classList.toggle('open');
    mbtn.setAttribute('aria-expanded', dd?.classList.contains('open') ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (dd?.classList.contains('open') && !dd.contains(e.target as Node)) closeMenu();
  });
  menu?.querySelectorAll('.dd-item').forEach((it) => {
    (it as HTMLElement).addEventListener('click', () => {
      const m = (it as HTMLElement).getAttribute('data-mode') || 'flash';
      store.set('sh.mode', m);
      closeMenu();
      renderMode();
      if (m === 'deep') fetchDeepModel();
    });
  });
  renderMode();
  if (curMode() === 'deep') fetchDeepModel();

  const sq = $('#sess-search') as HTMLInputElement | null;
  sq?.addEventListener('input', () => {
    sessQuery = sq.value;
    renderSessions();
  });
  renderSessions();
  newSession();
  autoresize();
  viewportFix();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
