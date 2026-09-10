/* SH tech news v2 — infinite feed (HN Algolia + Dev.to), CORS-friendly, 10 UI langs */
(function () {
'use strict';
var HN = 'https://hn.algolia.com/api/v1/search_by_date?tags=front_page,story&hitsPerPage=12&page=';
var DEV = 'https://dev.to/api/articles?per_page=12&page=';
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
var seen = {}, seenN = 0;
var hnPage = 0, devPage = 0, cycle = 0, busy = false, done = false, opened = false, fills = 0;
var lang = 'en';
var feed, sentinel, statusEl;
function T(k){ var m = tr[lang] || tr.en; return m[k] || tr.en[k]; }
function detectLang(){
  try { var s = localStorage.getItem('sh.lang'); if (s && tr[s]) { lang = s; return; } } catch(e){}
  var dl = (document.documentElement.getAttribute('lang') || 'en').slice(0,2).toLowerCase();
  lang = tr[dl] ? dl : 'en';
}
function ago(iso){
  try {
    var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return Math.max(1, Math.floor(s/60)) + 'm';
    if (s < 86400) return Math.floor(s/3600) + 'h';
    return Math.floor(s/86400) + 'd';
  } catch(e){ return ''; }
}
function addCard(o){
  if (!o.title || seen[o.title]) return false;
  seen[o.title] = 1; seenN++;
  var it = document.createElement('article'); it.className = 'nw-item';
  var a = document.createElement('a');
  a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = o.title;
  var m = document.createElement('div'); m.className = 'nw-meta';
  var s = document.createElement('span'); s.className = 'nw-src'; s.textContent = o.src;
  var mt = document.createElement('span'); mt.textContent = o.meta;
  m.appendChild(s); m.appendChild(mt);
  it.appendChild(a); it.appendChild(m);
  feed.insertBefore(it, sentinel);
  return true;
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
      if (addCard({ title: h.title, url: h.url || ('https://news.ycombinator.com/item?id=' + h.objectID),
        meta: (h.points||0) + ' pts · ' + (h.num_comments||0) + ' c · ' + ago(h.created_at), src: 'HN' })) n++;
    });
    return n;
  });
}
function loadDev(){
  return getJSON(DEV + devPage).then(function(d){
    if (!Array.isArray(d)) return 0;
    devPage++; var n = 0;
    d.forEach(function(a){
      if (a.title) if (addCard({ title: a.title, url: a.url,
        meta: (a.user && a.user.name ? a.user.name + ' · ' : '') + ago(a.published_at), src: 'dev.to' })) n++;
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
      maybeFill();
    })
    .catch(function(){ busy = false; if (statusEl) statusEl.textContent = T('err'); });
}
function maybeFill(){
  if (done || busy || !opened || !feed) return;
  if (feed.scrollHeight <= feed.clientHeight + 420 && fills < 5) {
    fills++;
    setTimeout(function(){ if (!busy && !done) loadMore(); }, 150);
  }
}
function openFeed(){
  detectLang();
  opened = true;
  document.getElementById('news').classList.add('open');
  document.body.classList.add('locked');
  if (feed) feed.scrollTop = 0;
  if (seenN === 0) loadMore(); else maybeFill();
}
function closeFeed(){
  opened = false;
  document.getElementById('news').classList.remove('open');
  var act = document.querySelector('.section.active');
  document.body.classList.toggle('locked', !!(act && act.id === 'chat'));
}
function boot(){
  feed = document.getElementById('nw-feed');
  sentinel = document.getElementById('nw-sentinel');
  statusEl = document.getElementById('nw-status');
  if (!feed) return;
  var openBtn = document.getElementById('news-open');
  if (openBtn) openBtn.addEventListener('click', openFeed);
  var closeBtn = document.getElementById('nw-close');
  if (closeBtn) closeBtn.addEventListener('click', closeFeed);
  var wgNews = document.getElementById('wg-card-news');
  if (wgNews) wgNews.addEventListener('click', function(){ openFeed(); });
  document.addEventListener('sh:lang', function(e){ if (e.detail && tr[e.detail]) lang = e.detail; });
  if (sentinel && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting && opened) loadMore(); });
    }, { root: feed, rootMargin: '500px 0px', threshold: 0 });
    io.observe(sentinel);
  }
  feed.addEventListener('scroll', function(){
    if (!opened || busy || done) return;
    if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 420) loadMore();
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
