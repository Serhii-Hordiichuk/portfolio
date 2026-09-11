/* SH tech news v3 \u2014 infinite feed with images, summaries and UI-language
   translation (MyMemory API). Two open modes: full page and modal. */
(function () {
'use strict';
var HN = 'https://hn.algolia.com/api/v1/search_by_date?tags=front_page,story&hitsPerPage=12&page=';
var DEV = 'https://dev.to/api/articles?per_page=12&page=';
var RED = 'https://www.reddit.com/r/technology/top.json?limit=15&t=day&t=';
var LOB = 'https://lobste.rs/newest.json?page=';
var MM = 'https://api.mymemory.translated.net/get?q=';
var tr = {
  uk:{loading:'\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f\u2026',more:'\u0429\u0435\u2026',done:'\u0426\u0435 \u0432\u0441\u0435 \u2014 \u043a\u0456\u043d\u0435\u0446\u044c \u0441\u0442\u0440\u0456\u0447\u043a\u0438',err:'\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0438\u0442\u0438'},
  en:{loading:'Loading\u2026',more:'More\u2026',done:"You've reached the end",err:'Failed to load'},
  no:{loading:'Laster\u2026',more:'Mer\u2026',done:'Du har n\u00e5dd slutten',err:'Kunne ikke laste'},
  de:{loading:'L\u00e4dt\u2026',more:'Mehr\u2026',done:'Ende erreicht',err:'Laden fehlgeschlagen'},
  fr:{loading:'Chargement\u2026',more:'Plus\u2026',done:'Fin de la liste',err:'\u00c9chec du chargement'},
  es:{loading:'Cargando\u2026',more:'M\u00e1s\u2026',done:'Has llegado al final',err:'Error al cargar'},
  pl:{loading:'\u0141adowanie\u2026',more:'Wi\u0119cej\u2026',done:'Koniec listy',err:'B\u0142\u0105d \u0142adowania'},
  ru:{loading:'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026',more:'\u0415\u0449\u0451\u2026',done:'\u042d\u0442\u043e \u0432\u0441\u0451',err:'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c'},
  zh:{loading:'\u52a0\u8f7d\u4e2d\u2026',more:'\u52a0\u8f7d\u66f4\u591a\u2026',done:'\u5df2\u7ecf\u5230\u5e95\u4e86',err:'\u52a0\u8f7d\u5931\u8d25'},
  ar:{loading:'\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0645\u064a\u0644\u2026',more:'\u0627\u0644\u0645\u0632\u064a\u062f\u2026',done:'\u0648\u0635\u0644\u062a \u0625\u0644\u0649 \u0627\u0644\u0646\u0647\u0627\u064a\u0629',err:'\u0641\u0634\u0644 \u0627\u0644\u062a\u062d\u0645\u064a\u0644'}
};
var seen = {}, seenN = 0, pending = [];
var hnPage = 0, devPage = 0, cycle = 0, busy = false, done = false, opened = false, mode = 'page', fills = 0;
var lang = 'en';
var feed, sentinel, statusEl, root, inlineEl;
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
    if (lang === 'en') {
      if (item.descEl) item.descEl.textContent = (item.desc || item.fallback || '');
      return;
    }
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
  if (o.image) {
    img = document.createElement('img');
    img.className = 'nw-img'; img.loading = 'lazy'; img.alt = '';
    img.src = o.image;
    img.onerror = function () { img.remove(); showPh(it, o.title); };
    it.appendChild(img);
  } else {
    showPh(it, o.title);
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
  if (lang === 'en' && o.desc) d.textContent = o.desc;
  else pending.push({ a: a, descEl: d, title: o.title, desc: o.desc, fallback: o.fallback || host(o.url) });
}
/* deterministic gradient placeholder from title hash */
function showPh(el, title){
  var ph = document.createElement('div'); ph.className = 'nw-img nw-ph';
  var h = 0, i; for (i = 0; i < title.length; i++) { h = (h * 31 + title.charCodeAt(i)) | 0; }
  var hue = Math.abs(h) % 360;
  ph.style.background = 'linear-gradient(135deg, hsl(' + hue + ',12%,22%) 0%, hsl(' + ((hue+40)%360) + ',12%,12%) 100%)';
  ph.textContent = title.charAt(0).toUpperCase();
  el.appendChild(ph);
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
        meta: (h.points||0) + ' pts \u00b7 ' + (h.num_comments||0) + ' c \u00b7 ' + ago(h.created_at), src: 'HN' });
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
        meta: (a.user && a.user.name ? a.user.name + ' \u00b7 ' : '') + ago(a.published_at), src: 'dev.to' });
      n++;
    });
    return n;
  });
}
function loadRed(){
  return getJSON(RED + Date.now()).then(function(d){
    if (!d || !d.data || !Array.isArray(d.data.children)) return 0;
    var n = 0;
    d.data.children.forEach(function(c){
      var r = c.data; if (!r || !r.title) return;
      var url = 'https://www.reddit.com' + (r.permalink || '');
      var desc = (r.selftext || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220);
      addCard({ title: r.title, url: url, image: r.thumbnail && r.thumbnail.startsWith('http') ? r.thumbnail : null,
        desc: desc, meta: (r.ups||0) + ' ups \u00b7 ' + (r.num_comments||0) + ' c \u00b7 ' + ago(r.created_utc*1000), src: 'Reddit' });
      n++;
    });
    return n;
  });
}
function loadLob(){
  return getJSON(LOB + (devPage+1)).then(function(d){
    if (!Array.isArray(d)) return 0;
    devPage++; var n = 0;
    d.forEach(function(s){
      if (!s.title) return;
      var desc = (s.description || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 220);
      addCard({ title: s.title, url: s.url, image: null, desc: desc,
        meta: (s.score||0) + ' pts \u00b7 ' + (s.comments_count||0) + ' c \u00b7 ' + ago(s.created_at), src: 'Lobsters' });
      n++;
    });
    return n;
  });
}
function loadMore(){
  if (busy || done) return Promise.resolve();
  busy = true; fills = 0;
  if (statusEl) statusEl.textContent = T('more');
  var sources = [loadHN, loadDev, loadRed, loadLob];
  var i = cycle % sources.length;
  cycle++;
  return sources[i]().catch(function(){ return 0; })
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
  /* modal: feed scrolls internally; page: whole page scrolls, measure viewport space */
  var space = (mode === 'page')
    ? (document.body.scrollHeight - window.scrollY - window.innerHeight)
    : (feed.scrollHeight - feed.scrollTop - feed.clientHeight);
  if (space < 520 && fills < 6) {
    fills++;
    setTimeout(function(){ if (!busy && !done && opened) loadMore().then(function(){ maybeFill(); }); }, 150);
  }
}
/* ---------- open / close ---------- */
/* move the shared feed between the modal overlay and the inline slot */
function mountInline(){
  if (inlineEl && feed.parentElement !== inlineEl) {
    inlineEl.appendChild(feed);
    if (statusEl) inlineEl.appendChild(statusEl);
  }
}
function unmountInline(){
  if (inlineEl && feed.parentElement === inlineEl) {
    root.appendChild(feed);
    if (statusEl) root.appendChild(statusEl);
  }
}
function openFeed(m){
  mode = m || 'page';
  lang = currentLang();
  opened = true;
  if (mode === 'modal') {
    unmountInline();
    root.classList.add('modal', 'open');
    document.body.classList.add('locked');
    if (feed) feed.scrollTop = 0;
  } else {
    mountInline();
    inlineEl.classList.add('open');
    var act = document.querySelector('.section.active');
    document.body.classList.toggle('locked', !!(act && act.id === 'chat'));
  }
  if (seenN === 0) loadMore(); else { maybeFill(); processQueue(); }
}
function closeFeed(){
  opened = false;
  root.classList.remove('open', 'modal');
  if (inlineEl) inlineEl.classList.remove('open');
  unmountInline();
  var act = document.querySelector('.section.active');
  document.body.classList.toggle('locked', !!(act && act.id === 'chat'));
  if (mode === 'page') window.scrollTo(0, 0); /* back to the home top */
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
  inlineEl = document.getElementById('news-inline');
  var colBtn = document.getElementById('news-collapse');
  if (colBtn) colBtn.addEventListener('click', closeFeed);
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
    }, { rootMargin: '600px 0px', threshold: 0 });
    io.observe(sentinel);
  }
  feed.addEventListener('scroll', function(){
    if (!opened || busy || done) return;
    if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 480) loadMore();
    processQueue();
  }, { passive: true });
  /* page mode: the page itself scrolls to infinity */
  window.addEventListener('scroll', function(){
    if (!opened || mode !== 'page' || busy || done) return;
    var r = sentinel.getBoundingClientRect();
    if (r.top < window.innerHeight + 600) loadMore();
  }, { passive: true });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && opened) closeFeed(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
window.SH_NEWS = {
  loadMore: loadMore, open: openFeed, close: closeFeed,
  count: function(){ return seenN; }, busy: function(){ return busy; }, done: function(){ return done; },
  isOpen: function(){ return opened; }
};
})();
