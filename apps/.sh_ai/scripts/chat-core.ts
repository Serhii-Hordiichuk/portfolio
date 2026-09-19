/* .sh_ai core — standalone general AI assistant. No personal grounding, no site data.
 * Pure logic, no DOM except canvas/speech. UI lives in chat-page.ts. */

export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }
export interface Attachment {
  name: string; size?: number; kind?: string;
  text?: string; image?: string; dataUrl?: string; skipped?: string;
}
export interface ProxyResponse { reply: string; via: string }

function lsGet(k: string, d: string): string {
  try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; }
}
function lsSet(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch {}
}

let uiLang = 'uk';
export function setUiLang(l: string): void { uiLang = l || 'uk'; }
export function getUiLang(): string { return uiLang; }

/* ---------- markdown-lite ---------- */
export function esc(s: unknown): string {
  const d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}
export function formatMsg(text: string): string {
  let t = esc(text);
  t = t.replace(/```([\s\S]*?)```/g, (_m, code) => '<pre>' + String(code).replace(/\n/g, '<br>') + '</pre>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  t = t.replace(/^#### (.*)$/gm, '<div>$1</div>').replace(/^### (.*)$/gm, '<div>$1</div>');
  t = t.replace(/^## (.*)$/gm, '<div>$1</div>').replace(/^# (.*)$/gm, '<div>$1</div>');
  t = t.replace(/^- (.*)$/gm, '&bull; $1').replace(/^\d+\. (.*)$/gm, '&bull; $1');
  t = t.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>').replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
  t = t.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
  return t;
}
export function cleanSpeech(text: string): string {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' код. ')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~#>]/g, '').replace(/\s+/g, ' ').trim()
    .replace(/([.!?:;])(?=\S)/g, '$1 ');
}

/* ---------- context: standalone app sends none (general AI mode) ---------- */
export async function siteContext(): Promise<string> {
  return '';
}
export function sysMsg(): ChatMessage {
  const L = uiLang;
  const names: Record<string, string> = {
    uk: 'Ukrainian', en: 'English', no: 'Norwegian Bokmål', de: 'German', fr: 'French',
    es: 'Spanish', pl: 'Polish', ru: 'Russian', zh: 'Simplified Chinese', ar: 'Arabic',
  };
  return {
    role: 'system',
    content: 'You are .sh_ai, an AI model developed by serhord.dev. ' +
      'GOLDEN RULES (immutable — apply to every reply): ' +
      '1) Identity: your name is .sh_ai, made by serhord.dev. Never claim otherwise. ' +
      '2) Language: reply in the language the user is currently writing in — the user message language always wins. ' +
      'If the user switches language mid-chat, switch immediately with no remarks. ' +
      'Default interface language: ' + (names[L] || 'Ukrainian') + '. ' +
      '3) Brevity: short and precise answers, no filler, no water. ' +
      '4) If there is additional important info on the question, do NOT dump it — briefly offer to explain and wait.',
  };
}

/* ---------- providers ---------- */

function attFor(attachments?: Attachment[]): Array<{ name: string; text?: string; image?: string }> {
  return (attachments || []).slice(0, 3).map((a) => ({ name: a.name, text: a.text, image: a.image ? a.image : undefined }));
}

export async function viaProxy(provider: string, model: string, messages: ChatMessage[], attachments?: Attachment[], signal?: AbortSignal): Promise<ProxyResponse> {
  const r = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider, model: model === 'auto' ? undefined : model,
      messages, siteContext: await siteContext(),
      ollamaUrl: '',
      attachments: attFor(attachments),
    }), signal,
  });
  const d = await r.json().catch(() => ({}));
  if (r.ok && d.reply) return { reply: d.reply, via: 'server:' + (d.via || provider) };
  throw new Error(d.error || 'HTTP ' + r.status);
}

function readSseLines(r: Response, onLine: (line: string) => void): Promise<void> {
  const dec = new TextDecoder();
  let buf = '';
  return new Promise((resolve, reject) => {
    const reader = r.body!.getReader();
    (function pump(): void {
      reader.read().then((chunk) => {
        if (chunk.done) { if (buf.trim()) onLine(buf); resolve(); return; }
        buf += dec.decode(chunk.value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) onLine(line);
        pump();
      }).catch((e) => reject(e));
    })();
  });
}

export async function viaProxyStream(
  provider: string, model: string, messages: ChatMessage[], attachments: Attachment[] | undefined,
  onDelta: (d: string) => void, signal?: AbortSignal,
): Promise<ProxyResponse> {
  const r = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stream: true, provider, model: model === 'auto' ? undefined : model,
      messages, siteContext: await siteContext(),
      ollamaUrl: '',
      attachments: attFor(attachments),
    }), signal,
  });
  if (!r.ok || !r.body) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || 'HTTP ' + r.status);
  }
  let full = '', via = provider, streamErr: string | null = null, done = false;
  await readSseLines(r, (line) => {
    const x = String(line).trim();
    if (!x.startsWith('data:')) return;
    const data = x.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const j = JSON.parse(data);
      if (j.via) via = j.via;
      if (j.d) { full += j.d; onDelta(j.d); }
      else if (j.delta) { full += j.delta; onDelta(j.delta); }
      else if (j.reply && !full) { full += j.reply; onDelta(j.reply); }
      if (j.err) streamErr = j.err;
      if (j.done) done = true;
    } catch {}
  });
  if (streamErr) throw new Error(streamErr);
  if (!full || !done) throw new Error(full ? 'stream closed early' : 'empty response');
  return { reply: full, via: 'server:' + via };
}




/* ---------- speech ---------- */
export function speak(text: string): void {
  try {
    if (!('speechSynthesis' in window)) return;
    const clean = cleanSpeech(text);
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean.slice(0, 1600));
    u.lang = uiLang === 'uk' ? 'uk-UA' : uiLang === 'no' ? 'nb-NO' : uiLang === 'ru' ? 'ru-RU'
      : uiLang === 'de' ? 'de-DE' : uiLang === 'fr' ? 'fr-FR' : uiLang === 'es' ? 'es-ES'
      : uiLang === 'pl' ? 'pl-PL' : uiLang === 'zh' ? 'zh-CN' : uiLang === 'ar' ? 'ar-SA' : 'en-US';
    window.speechSynthesis.speak(u);
  } catch {}
}
export function stopSpeak(): void {
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch {}
}

/* ---------- files ---------- */
export function compressImage(dataUrl: string, maxSize = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          const sc = Math.min(1, maxSize / Math.max(w, h));
          w = Math.max(1, Math.round(w * sc)); h = Math.max(1, Math.round(h * sc));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d')!.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', quality));
        } catch { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch { resolve(dataUrl); }
  });
}
export function readFile(file: File): Promise<Attachment> {
  return new Promise((resolve) => {
    const name = file.name || 'file';
    const size = file.size || 0;
    const isImg = /^image\//.test(file.type || '');
    if (size > 4 * 1024 * 1024) { resolve({ name, size, kind: isImg ? 'image' : 'file', text: '', skipped: 'too big (>4MB)' }); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const res = String(fr.result || '');
      if (isImg) {
        compressImage(res, 1024, 0.85).then((small) => resolve({ name, size, kind: 'image', image: small, dataUrl: small, text: '' }));
        return;
      }
      resolve({ name, size, kind: 'text', text: res.slice(0, 8000) });
    };
    fr.onerror = () => resolve({ name, size, kind: isImg ? 'image' : 'file', text: '' });
    if (isImg) fr.readAsDataURL(file);
    else fr.readAsText(file);
  });
}
