/* SH radio v1 \u2014 custom player: prev/play-pause/next + geo-ordered classical stations */
(function () {
'use strict';
var store = function () { return window.SH.store; };
var audio, sel, nameEl, hintEl, useEl, playerEl;
var list = [];
var idx = 0;
function all() { return (window.SH_STATIONS && window.SH_STATIONS.length) ? window.SH_STATIONS.slice() : []; }
function geo() {
  return new Promise(function (res) {
    try {
      var ctl = new AbortController();
      var t = setTimeout(function () { ctl.abort(); res(''); }, 4000);
      fetch('https://ipapi.co/country/', { signal: ctl.signal })
        .then(function (r) { return r.text(); })
        .then(function (c) { clearTimeout(t); res((c || '').trim().toUpperCase().slice(0, 2)); })
        .catch(function () { clearTimeout(t); res(''); });
    } catch (e) { res(''); }
  });
}
function order(cc) {
  var st = all();
  if (!cc) return st;
  var mine = st.filter(function (s) { return s.country === cc; });
  var rest = st.filter(function (s) { return s.country !== cc; });
  return mine.concat(rest);
}
function fillSelect() {
  sel.innerHTML = '';
  list.forEach(function (s, i) {
    var o = document.createElement('option');
    o.value = String(i); o.textContent = s.name;
    sel.appendChild(o);
  });
  sel.value = String(idx);
}
function ui() {
  var playing = audio && !audio.paused && !!audio.src;
  nameEl.textContent = (list[idx] && list[idx].name) || '';
  useEl.setAttribute('href', playing ? '#i-pause' : '#i-play');
  playerEl.classList.toggle('on', !!playing);
  hintEl.style.display = playing ? 'none' : '';
  try { store().set('sh.station', String(idx)); } catch (e) {}
}
function play(i) {
  if (!list.length) return;
  idx = ((i % list.length) + list.length) % list.length;
  sel.value = String(idx);
  audio.src = list[idx].url;
  audio.play().then(ui).catch(function () { ui(); });
}
function toggle() {
  if (!audio.src && list.length) { play(idx); return; }
  if (audio.paused) { audio.play().catch(function () {}); }
  else { audio.pause(); }
  ui();
}
function boot() {
  audio = document.getElementById('radio');
  sel = document.getElementById('pl-station');
  nameEl = document.getElementById('pl-name');
  hintEl = document.getElementById('pl-hint');
  useEl = document.getElementById('pl-use');
  playerEl = document.getElementById('player');
  if (!audio || !sel) return;
  try { idx = parseInt(store().get('sh.station', '0'), 10) || 0; } catch (e) { idx = 0; }
  list = order('');
  if (idx >= list.length) idx = 0;
  fillSelect(); ui();
  geo().then(function (cc) {
    var ordered = order(cc);
    var cur = list[idx];
    list = ordered;
    idx = Math.max(0, list.indexOf(cur));
    fillSelect(); ui();
  });
  document.getElementById('pl-prev').addEventListener('click', function () { play(idx - 1); });
  document.getElementById('pl-next').addEventListener('click', function () { play(idx + 1); });
  document.getElementById('pl-toggle').addEventListener('click', toggle);
  sel.addEventListener('change', function () { play(parseInt(sel.value, 10) || 0); });
  audio.addEventListener('playing', ui);
  audio.addEventListener('pause', ui);
  var errs = 0;
  audio.addEventListener('playing', function () { errs = 0; });
  audio.addEventListener('error', function () {
    if (++errs >= Math.max(list.length, 3)) { errs = 0; ui(); return; }
    play(idx + 1);
  });
  // autoplay attempt (browsers may block until first gesture)
  var started = false;
  function kick() {
    if (started || (audio.src && !audio.paused)) return;
    started = true;
    play(idx);
  }
  setTimeout(kick, 800);
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function h() {
      if (audio && !audio.src) kick();
    }, { once: true, passive: true });
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
window.SH_RADIO = {
  toggle: toggle,
  play: function (i) { play(typeof i === 'number' ? i : idx); },
  next: function () { play(idx + 1); },
  prev: function () { play(idx - 1); },
  state: function () {
    return { playing: !!(audio && !audio.paused && audio.src), idx: idx, total: list.length, name: (list[idx] || {}).name || '' };
  }
};
})();
