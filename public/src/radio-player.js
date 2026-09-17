// SH radio player v2 — ESM. Separate drawer sliding from LEFT.
// Targets: #radio-modal, #radio-backdrop, #radio-close, #radio-open,
// #radio-audio, #radio-visual (canvas), #radio-name, #radio-live,
// #radio-source (select), #radio-prev/toggle/next, #radio-hint, #radio-use.
import { SH_STATIONS, wrapIndex } from './stations.js';

const $ = (id) => document.getElementById(id);

let audio, modal, sel, nameEl, hintEl, useEl, liveEl, canvas, dialog;
let list = [];
let idx = 0;
let opened = false;
let actx = null, analyser = null, raf = 0;

function store() {
  return (window.SH && window.SH.store) || {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
}

function all() { return Array.isArray(SH_STATIONS) ? SH_STATIONS.slice() : []; }

function geoCountry() {
  return new Promise((res) => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => { ctl.abort(); res(''); }, 4000);
      fetch('https://ipapi.co/country/', { signal: ctl.signal })
        .then((r) => r.text())
        .then((c) => { clearTimeout(t); res((c || '').trim().toUpperCase().slice(0, 2)); })
        .catch(() => { clearTimeout(t); res(''); });
    } catch { res(''); }
  });
}

function order(cc) {
  const st = all();
  if (!cc) return st;
  return st.filter((s) => s.country === cc).concat(st.filter((s) => s.country !== cc));
}

function fillSelect() {
  if (!sel) return;
  sel.innerHTML = '';
  list.forEach((s, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = s.name;
    sel.appendChild(o);
  });
  sel.value = String(idx);
}

function setIcon(playing) {
  if (useEl) useEl.setAttribute('href', playing ? '#i-pause' : '#i-play');
}

function ui() {
  const playing = !!(audio && !audio.paused && audio.src);
  if (nameEl) nameEl.textContent = (list[idx] && list[idx].name) || '';
  setIcon(playing);
  if (liveEl) liveEl.classList.toggle('on', playing);
  if (hintEl) hintEl.style.display = playing ? 'none' : '';
  try { store().set('sh.station', String(idx)); } catch {}
  if ('mediaSession' in navigator && list[idx]) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: list[idx].name, artist: 'SH Radio', album: 'Live' });
    } catch {}
  }
}

function ensureGraph() {
  try {
    if (actx || !audio || !canvas) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    const src = actx.createMediaElementSource(audio);
    analyser = actx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    analyser.connect(actx.destination);
    draw();
  } catch {}
}

function draw() {
  if (!canvas || !analyser) return;
  const ctx = canvas.getContext('2d');
  const data = new Uint8Array(analyser.frequencyBinCount);
  const render = () => {
    raf = requestAnimationFrame(render);
    analyser.getByteFrequencyData(data);
    const w = (canvas.width = canvas.clientWidth || 300);
    const h = (canvas.height = canvas.clientHeight || 120);
    ctx.clearRect(0, 0, w, h);
    const n = data.length;
    const bw = w / n;
    const dark = document.body.classList.contains('dark');
    for (let i = 0; i < n; i++) {
      const v = data[i] / 255;
      const bh = Math.max(2, v * h);
      ctx.fillStyle = dark ? 'rgba(255,255,255,' + (0.25 + v * 0.65) + ')' : 'rgba(10,10,10,' + (0.25 + v * 0.65) + ')';
      ctx.fillRect(i * bw + 1, h - bh, Math.max(1, bw - 2), bh);
    }
  };
  cancelAnimationFrame(raf);
  render();
}

function play(i) {
  if (!list.length || !audio) return;
  idx = wrapIndex(typeof i === 'number' ? i : idx, 0, list.length);
  if (sel) sel.value = String(idx);
  ensureGraph();
  try { if (actx && actx.state === 'suspended') actx.resume(); } catch {}
  audio.src = list[idx].url;
  audio.play().then(ui).catch(() => ui());
}

function toggle() {
  if (!audio) return;
  if (!audio.src && list.length) { play(idx); return; }
  ensureGraph();
  try { if (actx && actx.state === 'suspended') actx.resume(); } catch {}
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
  ui();
}

function open() {
  opened = true;
  try { window.SH_NEWS && window.SH_NEWS.close(); } catch {}
  try { window.SH_TV && window.SH_TV.close(); } catch {}
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  document.body.classList.add('locked');
}

function close() {
  opened = false;
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  const act = document.querySelector('.section.active');
  document.body.classList.toggle('locked', !!(act && act.id === 'chat'));
}

function boot() {
  audio = $('radio-audio');
  modal = $('radio-modal');
  dialog = document.querySelector('.radio-dialog');
  sel = $('radio-source');
  nameEl = $('radio-name');
  hintEl = $('radio-hint');
  useEl = $('radio-use');
  liveEl = $('radio-live');
  canvas = $('radio-visual');
  if (!audio || !modal) return;
  try { idx = parseInt(store().get('sh.station', '0'), 10) || 0; } catch { idx = 0; }
  list = order('');
  if (idx >= list.length) idx = 0;
  fillSelect(); ui();
  geoCountry().then((cc) => {
    const ordered = order(cc);
    const cur = list[idx];
    list = ordered;
    idx = Math.max(0, list.indexOf(cur));
    fillSelect(); ui();
  });
  const openBtn = $('radio-open');
  if (openBtn) openBtn.addEventListener('click', open);
  const closeBtn = $('radio-close');
  if (closeBtn) closeBtn.addEventListener('click', close);
  const backdrop = $('radio-backdrop');
  if (backdrop) backdrop.addEventListener('click', close);
  const prev = $('radio-prev'), next = $('radio-next'), tg = $('radio-toggle');
  if (prev) prev.addEventListener('click', () => play(idx - 1));
  if (next) next.addEventListener('click', () => play(idx + 1));
  if (tg) tg.addEventListener('click', toggle);
  if (sel) sel.addEventListener('change', () => play(parseInt(sel.value, 10) || 0));
  audio.addEventListener('playing', ui);
  audio.addEventListener('pause', ui);
  let errs = 0;
  audio.addEventListener('playing', () => { errs = 0; });
  audio.addEventListener('error', () => {
    if (++errs >= Math.max(list.length, 3)) { errs = 0; ui(); return; }
    play(idx + 1);
  });
  // Swipe right-to-left on stage to change station.
  const stage = document.querySelector('.radio-stage');
  if (stage) {
    let x0 = 0;
    stage.addEventListener('touchstart', (e) => { x0 = (e.touches[0] || {}).clientX || 0; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      const x1 = (e.changedTouches[0] || {}).clientX || 0;
      const dx = x1 - x0;
      if (Math.abs(dx) > 48) play(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && opened) close(); });
  try {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('previoustrack', () => play(idx - 1));
      navigator.mediaSession.setActionHandler('nexttrack', () => play(idx + 1));
    }
  } catch {}
  window.SH_RADIO = {
    open, close, toggle,
    play: (i) => play(typeof i === 'number' ? i : idx),
    next: () => play(idx + 1), prev: () => play(idx - 1),
    isOpen: () => opened,
    state: () => ({ playing: !!(audio && !audio.paused && audio.src), idx, total: list.length, name: (list[idx] || {}).name || '' }),
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export const SH_RADIO_API = { play, toggle, open, close };
