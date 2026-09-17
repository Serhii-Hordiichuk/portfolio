// SH news v4 — ESM. Separate tech-news feed, slides from bottom.
// Targets: #news-modal (bottom sheet), #nw-feed, #nw-sentinel, #nw-status,
// #news-open (cover button), #news-inline (inline expansion), #news-collapse.
const HN = 'https://hn.algolia.com/api/v1/search_by_date?tags=front_page,story&hitsPerPage=12&page=';
const DEV = 'https://dev.to/api/articles?per_page=12&page=';
const RED = 'https://www.reddit.com/r/technology/top.json?limit=15&t=day&t=';
const LOB = 'https://lobste.rs/newest.json?page=';
const HNW = 'https://api.hackernoon.com/v1/bookmarks?range=published&limit=12&';
const SMR = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.smashingmagazine.com/feed/');
const MM = 'https://api.mymemory.translated.net/get?q=';

const tr = {
  uk: { loading: 'Завантаження…', more: 'Ще…', done: 'Це все — кінець стрічки', err: 'Не вдалося завантажити' },
  en: { loading: 'Loading…', more: 'More…', done: "You've reached the end", err: 'Failed to load' },
  no: { loading: 'Laster…', more: 'Mer…', done: 'Du har nådd slutten', err: 'Kunne ikke laste' },
  de: { loading: 'Lädt…', more: 'Mehr…', done: 'Ende erreicht', err: 'Laden fehlgeschlagen' },
  fr: { loading: 'Chargement…', more: 'Plus…', done: 'Fin de la liste', err: 'Échec du chargement' },
  es: { loading: 'Cargando…', more: 'Más…', done: 'Has llegado al final', err: 'Error al cargar' },
  pl: { loading: 'Ładowanie…', more: 'Więcej…', done: 'Koniec listy', err: 'Błąd ładowania' },
  ru: { loading: 'Загрузка…', more: 'Ещё…', done: 'Это всё', err: 'Не удалось загрузить' },
  zh: { loading: '加载中…', more: '加载更多…', done: '已经到底了', err: '加载失败' },
  ar: { loading: 'جارٍ التحميل…', more: 'المزيد…', done: 'وصلت إلى النهاية', err: 'فشل التحميل' },
};

let seen = {}, seenN = 0, pending = [];
let hnPage = 0, devPage = 0, lobPage = 1, cycle = 0, busy = false, done = false, opened = false, fills = 0;
let lang = 'en';
let modal, feed, sentinel, statusEl, inlineEl;

function T(k) {
  const m = tr[lang] || tr.en;
  return m[k] || tr.en[k];
}

function currentLang() {
  try {
    const s = localStorage.getItem('sh.lang');
    if (s && tr[s]) return s;
  } catch {}
  const dl = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2).toLowerCase();
  return tr[dl] ? dl : 'en';
}

function ago(iso) {
  try {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  } catch { return ''; }
}

function host(u) {
  try { return new URL(u).host.replace('www.', ''); } catch { return ''; }
}

function mmKey(txt) {
  let h = 0;
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) | 0;
  return 'sh.nw.' + lang + '.' + String(h);
}
function cacheGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function cacheSet(k, v) { try { sessionStorage.setItem(k, v); } catch {} }

function translateText(txt, cb) {
  if (lang === 'en' || !txt) { cb(txt); return; }
  const k = mmKey(txt), c = cacheGet(k);
  if (c) { cb(c); return; }
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 9000);
  fetch(MM + encodeURIComponent(txt.slice(0, 480)) + '&langpair=en|' + lang, { signal: ctl.signal })
    .then((r) => r.json())
    .then((d) => {
      clearTimeout(to);
      const out = d && d.responseData && d.responseData.translatedText;
      if (out && out.length > 1) { cacheSet(k, out); cb(out); } else cb(txt);
    })
    .catch(() => { clearTimeout(to); cb(txt); });
}

function processQueue() {
  if (!opened || pending.length === 0) return;
  const batch = pending.splice(0, 3);
  batch.forEach((item) => {
    if (!document.body.contains(item.a)) return;
    if (lang === 'en') {
      if (item.descEl) item.descEl.textContent = item.desc || item.fallback || '';
      return;
    }
    translateText(item.title, (t1) => {
      if (document.body.contains(item.a)) item.a.textContent = t1;
      if (item.descEl) {
        if (item.desc) translateText(item.desc, (t2) => { if (document.body.contains(item.descEl)) item.descEl.textContent = t2; });
        else item.descEl.textContent = item.fallback;
      }
    });
  });
}

function showPh(el, o) {
  const ph = document.createElement('div');
  ph.className = 'nw-img nw-ph';
  let h = 0;
  for (let i = 0; i < o.title.length; i++) h = (h * 31 + o.title.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  ph.style.background = 'linear-gradient(135deg,hsl(' + hue + ',12%,18%) 0%,hsl(' + ((hue + 40) % 360) + ',12%,10%) 100%)';
  const tt = document.createElement('span');
  tt.className = 'nw-ph-title';
  tt.textContent = o.title;
  const dd = document.createElement('span');
  dd.className = 'nw-ph-desc';
  dd.textContent = o.desc || o.src || 'News';
  ph.appendChild(tt); ph.appendChild(dd);
  el.appendChild(ph);
}

function addCard(o) {
  if (!o.title || seen[o.title] || !feed || !sentinel) return;
  seen[o.title] = 1; seenN++;
  const it = document.createElement('article');
  it.className = 'nw-item';
  if (o.image) {
    const img = document.createElement('img');
    img.className = 'nw-img'; img.loading = 'lazy'; img.alt = '';
    img.src = o.image;
    img.onerror = () => { img.remove(); showPh(it, o); };
    it.appendChild(img);
  } else {
    showPh(it, o);
  }
  const a = document.createElement('a');
  a.className = 'nw-title'; a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.textContent = o.title;
  const d = document.createElement('div');
  d.className = 'nw-desc';
  it.appendChild(a); it.appendChild(d);
  const m = document.createElement('div');
  m.className = 'nw-meta';
  const s = document.createElement('span');
  s.className = 'nw-src'; s.textContent = o.src;
  const mt = document.createElement('span');
  mt.textContent = o.meta;
  m.appendChild(s); m.appendChild(mt);
  it.appendChild(m);
  feed.insertBefore(it, sentinel);
  if (lang === 'en' && o.desc) d.textContent = o.desc;
  else pending.push({ a, descEl: d, title: o.title, desc: o.desc, fallback: o.fallback || host(o.url) });
}

function getJSON(u) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 12000);
  return fetch(u, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    .then((r) => r.json())
    .finally(() => clearTimeout(to));
}

function loadHN() {
  return getJSON(HN + hnPage).then((d) => {
    if (!d || !Array.isArray(d.hits)) return 0;
    hnPage++;
    let n = 0;
    d.hits.forEach((h) => {
      const t = h.title || h.story_title;
      if (!t) return;
      const url = h.url || ('https://news.ycombinator.com/item?id=' + h.objectID);
      const desc = String(h.story_text || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220);
      addCard({ title: t, url, image: null, desc, meta: (h.points || 0) + ' pts · ' + (h.num_comments || 0) + ' c · ' + ago(h.created_at), src: 'HN' });
      n++;
    });
    return n;
  });
}

function loadDev() {
  return getJSON(DEV + devPage).then((d) => {
    if (!Array.isArray(d)) return 0;
    devPage++;
    let n = 0;
    d.forEach((a) => {
      if (!a.title) return;
      addCard({
        title: a.title, url: a.url, image: a.social_image || a.cover_image || null,
        desc: String(a.description || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220),
        meta: ((a.user && a.user.name) ? a.user.name + ' · ' : '') + ago(a.published_at), src: 'dev.to',
      });
      n++;
    });
    return n;
  });
}

function loadRed() {
  return getJSON(RED + Date.now()).then((d) => {
    if (!d || !d.data || !Array.isArray(d.data.children)) return 0;
    let n = 0;
    d.data.children.forEach((c) => {
      const r = c.data;
      if (!r || !r.title) return;
      const url = 'https://www.reddit.com' + (r.permalink || '');
      const desc = String(r.selftext || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220);
      addCard({
        title: r.title, url, image: r.thumbnail && String(r.thumbnail).startsWith('http') ? r.thumbnail : null,
        desc, meta: (r.ups || 0) + ' ups · ' + (r.num_comments || 0) + ' c · ' + ago(r.created_utc * 1000), src: 'Reddit',
      });
      n++;
    });
    return n;
  });
}

function loadLob() {
  return getJSON(LOB + lobPage).then((d) => {
    if (!Array.isArray(d)) return 0;
    lobPage++;
    let n = 0;
    d.forEach((s) => {
      if (!s.title) return;
      const desc = String(s.description || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220);
      addCard({ title: s.title, url: s.url, image: null, desc, meta: (s.score || 0) + ' pts · ' + (s.comment_count || 0) + ' c · ' + ago(s.created_at), src: 'Lobsters' });
      n++;
    });
    return n;
  });
}

function loadHN2() {
  return getJSON(HNW).then((d) => {
    if (!d || !Array.isArray(d.bookmarks || d.stories || d.posts)) {
      const arr = (d && (d.bookmarks || d.stories || d.posts)) || [];
      if (!Array.isArray(arr)) return 0;
    }
    const arr = d.bookmarks || d.stories || d.posts || [];
    let n = 0;
    arr.slice(0, 12).forEach((a) => {
      if (!a.title) return;
      const desc = String(a.summary || a.excerpt || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220);
      addCard({ title: a.title, url: a.url || a.link, image: a.cover_image || a.image || null, desc, meta: (a.author || a.user || '') + ' · ' + ago(a.published_at || a.created_at), src: 'HN' });
      n++;
    });
    return n;
  });
}

function loadSmr() {
  return getJSON(SMR).then((d) => {
    if (!d || !d.contents) return 0;
    const html = d.contents;
    const m = html.match(/<item[^>]*>([\s\S]*?)<\/item>/g);
    if (!m) return 0;
    let n = 0;
    m.slice(0, 12).forEach((b) => {
      let t = ((b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      let u = ((b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      let c = ((b.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220);
      if (!t) return;
      addCard({ title: t, url: u, image: null, desc: c, meta: 'recent · Smashing', src: 'Smashing' });
      n++;
    });
    return n;
  });
}

function loadMore() {
  if (busy || done) return Promise.resolve();
  busy = true; fills = 0;
  if (statusEl) statusEl.textContent = T('more');
  const sources = [loadHN, loadDev, loadRed, loadLob, loadHN2, loadSmr];
  const i = cycle % sources.length;
  cycle++;
  return sources[i]()
    .catch(() => 0)
    .then((n) => {
      busy = false;
      if (!n) { done = true; if (statusEl) statusEl.textContent = T('done'); }
      else if (statusEl) statusEl.textContent = '';
      maybeFill(); processQueue();
    })
    .catch(() => { busy = false; if (statusEl) statusEl.textContent = T('err'); });
}

function maybeFill() {
  if (done || busy || !opened || !feed) return;
  const space = feed.scrollHeight - feed.scrollTop - feed.clientHeight;
  if (space < 520 && fills < 6) {
    fills++;
    setTimeout(() => { if (!busy && !done && opened) loadMore().then(() => maybeFill()); }, 150);
  }
}

function mountInline() {
  if (inlineEl && feed && feed.parentElement !== inlineEl) {
    inlineEl.appendChild(feed);
    if (statusEl) inlineEl.appendChild(statusEl);
  }
}
function unmountInline() {
  if (modal && inlineEl && feed && feed.parentElement === inlineEl) {
    const dlg = modal.querySelector('.news-dialog');
    if (dlg && feed) { dlg.appendChild(feed); if (statusEl) dlg.appendChild(statusEl); }
  }
}

let glideRaf = null;
function glide(to) {
  if (glideRaf) cancelAnimationFrame(glideRaf);
  const from = window.scrollY || window.pageYOffset || 0, t0 = { v: null }, D = 700;
  function step(ts) {
    if (t0.v === null) t0.v = ts;
    let k = Math.min(1, (ts - t0.v) / D);
    k = 1 - Math.pow(1 - k, 3);
    window.scrollTo(0, Math.round(from + (to - from) * k));
    if (k < 1) glideRaf = requestAnimationFrame(step); else glideRaf = null;
  }
  glideRaf = requestAnimationFrame(step);
}

function openFeed(mode) {
  lang = currentLang();
  opened = true;
  // Close other drawers so only one panel is visible.
  try { window.SH_RADIO && window.SH_RADIO.close(); } catch {}
  try { window.SH_TV && window.SH_TV.close(); } catch {}
  if (mode === 'inline') {
    mountInline();
    if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
    if (inlineEl) {
      inlineEl.classList.add('open');
      requestAnimationFrame(() => {
        let top = 0, el = inlineEl;
        while (el) { top += el.offsetTop; el = el.offsetParent; }
        glide(Math.max(0, top - 60));
      });
    }
  } else {
    unmountInline();
    if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
    if (inlineEl) inlineEl.classList.remove('open');
    if (feed) feed.scrollTop = 0;
    document.body.classList.add('locked');
  }
  if (seenN === 0) loadMore(); else { maybeFill(); processQueue(); }
}

function closeFeed() {
  opened = false;
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  if (inlineEl) inlineEl.classList.remove('open');
  const act = document.querySelector('.section.active');
  document.body.classList.toggle('locked', !!(act && act.id === 'chat'));
}

function boot() {
  modal = document.getElementById('news-modal');
  feed = document.getElementById('nw-feed');
  sentinel = document.getElementById('nw-sentinel');
  statusEl = document.getElementById('nw-status');
  inlineEl = document.getElementById('news-inline');
  if (!feed || !modal) return;
  const openBtn = document.getElementById('news-open');
  if (openBtn) openBtn.addEventListener('click', () => openFeed('modal'));
  const inlineBtn = document.getElementById('news-inline-open');
  if (inlineBtn) inlineBtn.addEventListener('click', () => openFeed('inline'));
  const closeBtn = document.getElementById('nw-close');
  if (closeBtn) closeBtn.addEventListener('click', closeFeed);
  const backdrop = document.getElementById('news-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeFeed);
  const colBtn = document.getElementById('news-collapse');
  if (colBtn) colBtn.addEventListener('click', closeFeed);
  document.addEventListener('sh:lang', (e) => {
    if (!e.detail || !tr[e.detail] || e.detail === lang) return;
    lang = e.detail;
    if (seenN > 0) {
      while (feed.firstChild && feed.firstChild !== sentinel) feed.removeChild(feed.firstChild);
      seen = {}; seenN = 0; pending = [];
      hnPage = 0; devPage = 0; lobPage = 1; cycle = 0; done = false; fills = 0;
      if (statusEl) statusEl.textContent = '';
      if (opened) loadMore();
    }
  });
  if (sentinel && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting && opened) loadMore(); });
    }, { rootMargin: '600px 0px', threshold: 0 });
    io.observe(sentinel);
  }
  feed.addEventListener('scroll', () => {
    if (!opened || busy || done) return;
    if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 480) loadMore();
    processQueue();
  }, { passive: true });
  window.addEventListener('scroll', () => {
    if (!opened || busy || done) return;
    if (!inlineEl || !inlineEl.classList.contains('open') || !sentinel) return;
    const r = sentinel.getBoundingClientRect();
    if (r.top < window.innerHeight + 600) loadMore();
  }, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && opened) closeFeed(); });
  window.SH_NEWS = { loadMore, open: openFeed, close: closeFeed, count: () => seenN, busy: () => busy, done: () => done, isOpen: () => opened };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export const SH_NEWS_API = { openFeed, closeFeed, loadMore };
