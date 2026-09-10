/* SH tech news v3 — infinite feed with images, summaries and UI-language
   translation (MyMemory API). Two open modes: full page and modal. */
(function () {
'use strict';
var HN = 'https://hn.algolia.com/api/v1/search_by_date?tags=front_page,story&hitsPerPage=12&page=';
var DEV = 'https://dev.to/api/articles?per_page=12&page=';
var MM = 'https://api.mymemory.translated.net/get?q=';
var tr = {
  uk:{loading:'Завантаження…',more:'Ще…',done:'Це все — кінець стрічки',err:'Не вдалося завантажити'},
  en:{loading:'Loading…',more:'More…',done:"You've reached the end",err:'Failed to load'},
  no:{loading:'Laster…',more:'Mer…',done:'Du har nådd slutten',err:'Kunne ikke laste'},
  de:{loading:'Lädt…',more:'Mehr…',done:'Ende erreicht',err:'Laden fehlgeschlagen'},
  fr:{loading:'Chargement…',more:'Plus…',done:'Fin de la liste',err:'Échec du chargement'},
  es:{loading:'Cargando…',more:'Más…',done:'Has llegado al final',err:'Error al cargar'},
  pl:{loading:'Ładowanie…',more:'Więcej…',done:'Koniec listy',err:'Błąd ładowania'},
  ru:{loading:'Загрузка…',more:'Ещё…',done:'Это всё',err:'Не удалось загрузить'},
  zh:{loading:'加载中…',more:'加载更多…',done:'已经到底了',err:'加载失败'},
  ar:{loading:'جارٍ التحميل…',more:'المزيد…',done:'وصلت إلى النهاية',err:'فشل التحميل'}
};
var seen = {}, seenN = 0, pending = [];
var hnPage = 0, devPage = 0, cycle = 0, busy = false, done = false, opened = false, mode = 'page', fills = 0;
var lang = 'en';
var feed, sentinel, statusEl, root;
function T(k){ var m = tr[lang] || tr.en; return m[k] || tr.en[k]; }
function currentLang(){
  try { var s = localStorage.getItem('sh.lang'); if (s && tr[s]) return s; } catch(e){}
  var dl = (document.documentElement.getAttribute('lang') || 'en').slice(0,2).toLowerCase();
  return tr[dl] ? dl : 'en';
}
function ago(iso){
  try {
    var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return Math.max(1, Math.floor(s/60)) + 'm';
    if (s < 86400) return Math.floor(s/3600) + 'h';
    return Math.floor(s/86400) + 'd';
  } catch(e){ return ''; }
}
function host(u){ try { return new URL(u).host.replace('www.',''); } catch(e){ return ''; } }
/* ---------- translation (lazy, cached in sessionStorage) ---------- */
function mmKey(txt){ return 'sh.nw.' + lang + '.' + hash(txt); }
function hash(s){ var h = 0, i; for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return String(h); }
function cacheGet(k){ try { return sessionStorage.getItem(k); } catch(e){ return null; } }
function cacheSet(k, v){ try { sessionStorage.setItem(k, v); } catch(e){} }
function translateText(txt, cb){
  if (lang === 'en' || !txt) { cb(txt); return; }
  var k = mmKey(txt), c = cacheGet(k);
  if (c) { cb(c); return; }
  var ctl = new AbortController();
  var to = setTimeout(function(){ ctl.abort(); }, 9000);
  fetch(MM + encodeURIComponent(txt.slice(0, 480)) + '&langpair=en|' + lang, { signal: ctl.signal })
    .then(function(r){ return r.json(); })
    .then(function(d){
      clearTimeout(to);
      var out = d && d.responseData && d.responseData.translatedText;
      if (out && out.length > 1) { cacheSet(k, out); cb(out); } else cb(txt);
    })
    .catch(function(){ clearTimeout(to); cb(txt); });
}
/* Translate cards that are close to the viewport; runs on scroll */
function processQueue(){
  if (!opened || pending.length === 0) return;
  var batch = pending.splice(0, 3);
  batch.forEach(function (item) {
    if (!document.body.contains(item.a)) return;
    translateText(item.title, function (t1) {
      item.a.textContent = t1;
      if (item.descEl) {
        if (item.desc) translateText(item.desc, function (t2) { if (document.body.contains(item.descEl)) item.descEl.textContent = t2; });
        else item.descEl.textContent = item.fallback;
      }
    });
  });
}
/* ---------- rendering ---------- */
function addCard(o){
  if (!o.title || seen[o.title]) return;
  seen[o.title] = 1; seenN++;
  var it = document.createElement('article'); it.className = 'nw-item';
  var img;
  if (o.image) {
    img = document.createElement('img');
    img.className = 'nw-img'; img.loading = 'lazy'; img.alt = '';
    img.src = o.image;
    img.onerror = function () { img.remove(); };
    it.appendChild(img);
  } else {
    img = document.createElement('div'); img.className = 'nw-img nw-ph';
    img.textContent = o.src;
    it.appendChild(img);
  }
  var a = document.createElement('a');
  a.className = 'nw-title'; a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.textContent = o.title;
  var d = document.createElement('div'); d.className = 'nw-desc';
  it.appendChild(a); it.appendChild(d);
  var m = document.createElement('div'); m.className = 'nw-meta';
  var s = document.createElement('span'); s.className = 'nw-src'; s.textContent = o.src;
  var mt = document.createElement('span'); mt.textContent = o.meta;
  m.appendChild(s); m.appendChild(mt);
  it.appendChild(m);
  feed.insertBefore(it, sentinel);
  pending.push({ a: a, descEl: d, title: o.title, desc: o.desc, fallback: o.fallback || host(o.url) });
}
function getJSON(u){
  var ctl = new AbortController();
  var to = setTimeout(function(){ ctl.abort(); }, 12000);
  return fetch(u, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    .then(function(r){ return r.json(); })
    .finally(function(){ clearTimeout(to); });
}
function loadHN(){
  return getJSON(HN + hnPage).then(function(d){
    if (!d || !Array.isArray(d.hits)) return 0;
    hnPage++; var n = 0;
    d.hits.forEach(function(h){
      var t = h.title || h.story_title;
      if (!t) return;
      var url = h.url || ('https://news.ycombinator.com/item?id=' + h.objectID);
      var desc = (h.story_text || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220);
      addCard({ title: t, url: url, image: null, desc: desc,
        meta: (h.points||0) + ' pts · ' + (h.num_comments||0) + ' c · ' + ago(h.created_at), src: 'HN' });
      n++;
    });
    return n;
  });
}
function loadDev(){
  return getJSON(DEV + devPage).then(function(d){
    if (!Array.isArray(d)) return 0;
    devPage++; var n = 0;
    d.forEach(function(a){
      if (!a.title) return;
      addCard({ title: a.title, url: a.url, image: a.social_image || null,
        desc: (a.description || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220),
        meta: (a.user && a.user.name ? a.user.name + ' · ' : '') + ago(a.published_at), src: 'dev.to' });
      n++;
    });
    return n;
  });
}
function loadMore(){
  if (busy || done) return Promise.resolve();
  busy = true; fills = 0;
  if (statusEl) statusEl.textContent = T('more');
  var first = (cycle % 2 === 0) ? loadHN : loadDev;
  var second = (cycle % 2 === 0) ? loadDev : loadHN;
  cycle++;
  return first().catch(function(){ return 0; })
    .then(function(n){ if (n) return n; return second().catch(function(){ return 0; }); })
    .then(function(n){
      busy = false;
      if (!n) { done = true; if (statusEl) statusEl.textContent = T('done'); }
      else if (statusEl) statusEl.textContent = '';
      maybeFill(); processQueue();
    })
    .catch(function(){ busy = false; if (statusEl) statusEl.textContent = T('err'); });
}
function maybeFill(){
  if (done || busy || !opened || !feed) return;
  if (feed.scrollHeight <= feed.clientHeight + 480 && fills < 5) {
    fills++;
    setTimeout(function(){ if (!busy && !done) loadMore(); }, 150);
  }
}
/* ---------- open / close ---------- */
function openFeed(m){
  mode = m || 'page';
  lang = currentLang();
  opened = true;
  root.classList.toggle('modal', mode === 'modal');
  root.classList.add('open');
  document.body.classList.add('locked');
  if (feed) feed.scrollTop = 0;
  if (seenN === 0) loadMore(); else { maybeFill(); processQueue(); }
}
function closeFeed(){
  opened = false;
  root.classList.remove('open', 'modal');
  var act = document.querySelector('.section.active');
  document.body.classList.toggle('locked', !!(act && act.id === 'chat'));
}
/* ---------- boot ---------- */
function boot(){
  root = document.getElementById('news');
  feed = document.getElementById('nw-feed');
  sentinel = document.getElementById('nw-sentinel');
  statusEl = document.getElementById('nw-status');
  if (!feed) return;
  var openBtn = document.getElementById('news-open');
  if (openBtn) openBtn.addEventListener('click', function(){ openFeed('page'); });
  var closeBtn = document.getElementById('nw-close');
  if (closeBtn) closeBtn.addEventListener('click', closeFeed);
  root.addEventListener('click', function(e){ if (e.target === root && root.classList.contains('modal')) closeFeed(); });
  document.addEventListener('sh:lang', function(e){
  if (!e.detail || !tr[e.detail] || e.detail === lang) return;
  lang = e.detail;
  /* rebuild the feed so already rendered cards get the new language */
  if (seenN > 0) {
    while (feed.firstChild && feed.firstChild !== sentinel) feed.removeChild(feed.firstChild);
    seen = {}; seenN = 0; pending = [];
    hnPage = 0; devPage = 0; cycle = 0; done = false; fills = 0;
    if (statusEl) statusEl.textContent = '';
    if (opened) loadMore();
  }
});
  if (sentinel && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting && opened) loadMore(); });
    }, { root: feed, rootMargin: '500px 0px', threshold: 0 });
    io.observe(sentinel);
  }
  feed.addEventListener('scroll', function(){
    if (!opened || busy || done) return;
    if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 480) loadMore();
    processQueue();
  }, { passive: true });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && opened) closeFeed(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
window.SH_NEWS = {
  loadMore: loadMore, open: openFeed, close: closeFeed,
  count: function(){ return seenN; }, busy: function(){ return busy; }, done: function(){ return done; }
};
})();
