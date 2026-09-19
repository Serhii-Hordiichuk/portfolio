import { SH_I18N } from '../data/i18n';
import { SH_CV } from '../data/cv';

const $ = (s: string) => document.querySelector(s) as HTMLElement | null;
const $$ = (s: string) => Array.from(document.querySelectorAll(s));

const store = {
  get(k: string, d: string) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} },
};

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

let langChoice = store.get('sh.lang', 'auto');
let lang = resolveLang(langChoice);

function resolveLang(c: string): string {
  if (c && c !== 'auto' && SH_I18N[c]) return c;
  return detectLang();
}

function applyLang(choice: string) {
  langChoice = choice || 'auto';
  store.set('sh.lang', langChoice);
  lang = resolveLang(langChoice);
  if (!SH_I18N[lang]) lang = 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const T = SH_I18N[lang];
  $$('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n') || '';
    if (T[k] !== undefined) el.innerHTML = T[k];
  });
  $$('[data-i18n-ph]').forEach((el) => {
    const k = el.getAttribute('data-i18n-ph') || '';
    if (T[k]) (el as HTMLInputElement).placeholder = T[k];
  });
  const ls = $('#lang-select') as HTMLSelectElement | null;
  if (ls) ls.value = langChoice;
  renderCV();
}

function applyTheme() {
  const m = store.get('sh.theme', 'auto');
  const dark = m === 'dark' || (m === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark', dark);
}

function esc(s: unknown): string {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

/* ---------- CV ---------- */
function renderCV() {
  const el = $('#cv-content');
  if (!el) return;
  const key = lang.toUpperCase();
  const T: string[] = (SH_CV as Record<string, string[]>)[key] || SH_CV['EN'] || [];
  // SH_CV rows: [navT, sumT, sumX, aboutT, aboutX, workT, w1t, w1o, w1x, w2t, w2o, w2x, eduT, ed1s, ed1d, ed1f, ed2s, ed2d, ed2f, ed3s, ed3d, ed3f, ..., ed4s?, ed4f?, ..., ed5s, ed5f, langT, lgUk, lgEn, lgNo, lgRu, skillT, skillX, ...]
  const head = T.slice(0, 22);
  const sumT = head[1] || 'Summary';
  const sumX = head[2] || '';
  const aboutT = head[3] || '';
  const aboutX = head[4] || '';
  const workT = head[5] || '';
  const jobs = [
    { t: head[6], o: head[7], x: head[8] },
    { t: head[9], o: head[10], x: head[11] },
  ].filter((j) => j.t || j.x);
  const eduT = head[12] || '';
  const edus = [
    { s: head[13], d: head[14], f: head[15] },
    { s: head[16], d: head[17], f: head[18] },
    { s: head[19], d: head[20], f: head[21] },
  ].filter((e) => e.s || e.f);
  const tail = T.slice(-11);
  const ed5s = tail[0] || '';
  const ed5f = tail[1] || '';
  const langT = tail[2] || '';
  const langItems = tail.slice(3, 7).map((s) => String(s || '').trim()).filter(Boolean);
  const skillT = tail[7] || '';
  const skillX = tail[8] || '';
  const mid = T.slice(22, Math.max(22, T.length - 11)).map((s) => String(s ?? '').trim()).filter(Boolean);
  const mp = (s: string) => esc(s).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  const selfItems = String(ed5f).split(';').map((s) => s.trim()).filter(Boolean);
  el.innerHTML = `
    <div class="cv-block"><h3>${esc(sumT)}</h3><p>${mp(sumX)}</p>
    ${aboutT ? `<h3 style="margin-top:18px">${esc(aboutT)}</h3><p>${mp(aboutX)}</p>` : ''}</div>
    <div class="cv-block"><h3>${esc(workT)}</h3>
      ${jobs.map((j) => `<div class="cv-job"><p><strong>${esc(j.t)}</strong> — ${esc(j.o)}<br>${esc(j.x)}</p></div>`).join('')}
    </div>
    <div class="cv-block"><h3>${esc(eduT)}</h3>
      ${edus.map((e) => `<p><strong>${esc(e.s)}</strong><br>${esc(e.d)} — ${esc(e.f)}</p>`).join('')}
      ${mid.length ? `<p><strong>${esc(mid[0])}</strong>${mid[1] ? `<br>${esc(mid[1])}` : ''}</p>` : ''}
    </div>
    <div class="cv-block"><h3>${esc(ed5s)}</h3>
      ${selfItems.length > 1 ? `<ul class="cv-list">${selfItems.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p>${esc(ed5f)}</p>`}
    </div>
    <div class="cv-block"><h3>${esc(langT)}</h3>
      <ul class="cv-list">${langItems.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
    <div class="cv-block"><h3>${esc(skillT)}</h3><p>${esc(skillX)}</p></div>`;
}

/* ---------- stack filter ---------- */
function initStack() {
  const q = $('#st-q') as HTMLInputElement | null;
  const chips = $('#st-chips');
  const count = $('#st-count');
  const wrap = $('#st-groups');
  const empty = $('#st-empty');
  if (!q || !chips || !count || !wrap) return;
  const groups = Array.from(wrap.querySelectorAll('.st-group'));
  const tiles = Array.from(wrap.querySelectorAll('.st-tile'));
  let f = 'all', query = '';
  function apply() {
    let vis = 0;
    groups.forEach((g) => {
      const showG = f === 'all' || g.getAttribute('data-g') === f;
      let gv = 0;
      Array.from(g.querySelectorAll('.st-tile')).forEach((t) => {
        const el = t as HTMLElement;
        const hay = ((el.getAttribute('data-tags') || '') + ' ' + el.textContent).toLowerCase();
        const ok = showG && (!query || hay.includes(query));
        el.hidden = !ok;
        if (ok) gv++;
      });
      (g as HTMLElement).hidden = !showG || (!!query && !gv);
      const h = g.querySelector('.st-h');
      if (h) h.setAttribute('data-n', showG ? String(gv) : '');
      vis += gv;
    });
    count!.textContent = `${vis} / ${tiles.length}`;
    if (empty) (empty as HTMLElement).style.display = vis ? 'none' : 'block';
  }
  chips.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest?.('.chip') as HTMLElement | null;
    if (!b) return;
    chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
    f = b.getAttribute('data-f') || 'all';
    apply();
  });
  q.addEventListener('input', () => { query = q.value.trim().toLowerCase(); apply(); });
  apply();
}

/* ---------- copy buttons ---------- */
function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const v = (b as HTMLElement).getAttribute('data-copy') || '';
      try { navigator.clipboard.writeText(v); } catch {}
    });
  });
}

function boot() {
  applyLang(store.get('sh.lang', 'auto'));
  applyTheme();
  renderCV();
  initStack();
  initCopy();
  const ls = $('#lang-select') as HTMLSelectElement | null;
  ls?.addEventListener('change', (e) => applyLang((e.target as HTMLSelectElement).value));
  $('#theme-btn')?.addEventListener('click', () => {
    const cur = store.get('sh.theme', 'auto');
    store.set('sh.theme', cur === 'dark' ? 'light' : cur === 'light' ? 'auto' : 'dark');
    applyTheme();
  });
  try {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', () => { if (store.get('sh.theme', 'auto') === 'auto') applyTheme(); });
  } catch {}
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
