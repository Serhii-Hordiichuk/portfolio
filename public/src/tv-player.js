// SH TV player v2 — ESM. Separate drawer sliding from RIGHT with HLS.
// Targets: #tv-modal, #tv-backdrop, #tv-close, #tv-open,
// #tv-video, #tv-name, #tv-tag, #tv-source,
// #tv-prev/toggle/next/fs/pip, #tv-use, #tv-live.
import { SH_TV_CHANNELS, wrapIndex } from './stations.js';

const $ = (id) => document.getElementById(id);

let modal, video, nameEl, tagEl, sel, useEl, liveEl, dialog;
let idx = 0, hls = null, opened = false, wantPlay = false;
let HlsCtor = null; // lazy-loaded (bundled chunk, CDN global, or null)

/** Load HLS engine: Vite chunk → CDN <script> global → null (native only). */
async function ensureHls() {
  if (HlsCtor) return HlsCtor;
  if (window.Hls && typeof window.Hls.isSupported === 'function') { HlsCtor = window.Hls; return HlsCtor; }
  try {
    const mod = await import('hls.js');
    HlsCtor = (mod && mod.default) || mod;
    return HlsCtor;
  } catch {
    if (window.Hls) { HlsCtor = window.Hls; return HlsCtor; }
    return null;
  }
}

function ui(playing) {
  if (useEl) useEl.setAttribute('href', playing ? '#i-pause' : '#i-play');
  if (nameEl) nameEl.textContent = (SH_TV_CHANNELS[idx] && SH_TV_CHANNELS[idx].name) || '';
  if (tagEl) tagEl.textContent = (SH_TV_CHANNELS[idx] && SH_TV_CHANNELS[idx].tag) || '';
  if (sel) sel.value = String(idx);
  if (liveEl) liveEl.classList.toggle('on', !!playing);
  try { localStorage.setItem('sh.tv', String(idx)); } catch {}
  if ('mediaSession' in navigator && SH_TV_CHANNELS[idx]) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: SH_TV_CHANNELS[idx].name, artist: 'SH TV', album: 'Live' });
    } catch {}
  }
}

function destroy() {
  if (hls) { try { hls.destroy(); } catch {} hls = null; }
}

async function attach(url) {
  destroy();
  if (!video) return;
  try { video.pause(); } catch {}
  video.removeAttribute('src');
  try { video.load(); } catch {}
  const H = await ensureHls();
  if (H && typeof H.isSupported === 'function' && H.isSupported()) {
    hls = new H({ maxBufferLength: 20 });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(H.Events.ERROR, (_evt, data) => {
      if (data && data.fatal) next();
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
  } else if (nameEl) {
    nameEl.textContent = 'HLS not supported';
  }
}

async function play(i) {
  if (!video || !SH_TV_CHANNELS.length) return;
  idx = wrapIndex(typeof i === 'number' ? i : idx, 0, SH_TV_CHANNELS.length);
  wantPlay = true;
  await attach(SH_TV_CHANNELS[idx].url);
  if (!opened || !wantPlay) return; // closed while engine was loading
  const p = video.play();
  if (p && p.catch) p.catch(() => {});
  ui(true);
}

function next() { play(idx + 1); }
function prev() { play(idx - 1); }

function toggle() {
  if (!video) return;
  if (!video.src && !hls && !(video.currentSrc)) { play(idx); return; }
  if (video.paused) {
    wantPlay = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
    if (useEl) useEl.setAttribute('href', '#i-pause');
    if (liveEl) liveEl.classList.add('on');
  } else {
    wantPlay = false;
    video.pause();
    if (useEl) useEl.setAttribute('href', '#i-play');
    if (liveEl) liveEl.classList.remove('on');
  }
}

function fsMode() {
  try {
    const win = document.querySelector('.tv-dialog');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (win && win.requestFullscreen) win.requestFullscreen();
    else if (video && video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  } catch {}
}

function pipMode() {
  try {
    if (document.pictureInPictureElement === video) document.exitPictureInPicture();
    else if (video.requestPictureInPicture) video.requestPictureInPicture();
  } catch {}
}

function open() {
  opened = true;
  try { window.SH_NEWS && window.SH_NEWS.close(); } catch {}
  try { window.SH_RADIO && window.SH_RADIO.close(); } catch {}
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  document.body.classList.add('locked');
  if (video && !video.currentSrc && !hls) play(idx);
  else if (video && video.paused && wantPlay !== false) {
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  }
}

function close() {
  opened = false;
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  wantPlay = false;
  if (video) { try { video.pause(); } catch {} }
  if (useEl) useEl.setAttribute('href', '#i-play');
  if (liveEl) liveEl.classList.remove('on');
  const act = document.querySelector('.section.active');
  document.body.classList.toggle('locked', !!(act && act.id === 'chat'));
}

function boot() {
  modal = $('tv-modal');
  video = $('tv-video');
  nameEl = $('tv-name');
  tagEl = $('tv-tag');
  sel = $('tv-source');
  useEl = $('tv-use');
  liveEl = $('tv-live');
  dialog = document.querySelector('.tv-dialog');
  if (!modal || !video) return;
  try { idx = parseInt(localStorage.getItem('sh.tv') || '0', 10) || 0; } catch { idx = 0; }
  if (idx >= SH_TV_CHANNELS.length) idx = 0;
  SH_TV_CHANNELS.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = '[' + c.tag + '] ' + c.name;
    sel.appendChild(o);
  });
  sel.value = String(idx);
  ui(false);
  const openBtn = $('tv-open');
  if (openBtn) openBtn.addEventListener('click', open);
  const closeBtn = $('tv-close');
  if (closeBtn) closeBtn.addEventListener('click', close);
  const backdrop = $('tv-backdrop');
  if (backdrop) backdrop.addEventListener('click', close);
  $('tv-toggle').addEventListener('click', toggle);
  $('tv-prev').addEventListener('click', prev);
  $('tv-next').addEventListener('click', next);
  video.addEventListener('click', toggle);
  const fs = $('tv-fs'), pip = $('tv-pip');
  if (fs) fs.addEventListener('click', fsMode);
  if (pip) {
    pip.addEventListener('click', pipMode);
    try {
      if (!document.pictureInPictureEnabled || !video.requestPictureInPicture) pip.style.display = 'none';
    } catch { pip.style.display = 'none'; }
  }
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    if (fs) {
      const u = fs.querySelector('use');
      if (u) u.setAttribute('href', on ? '#i-fsx' : '#i-fs');
    }
  });
  sel.addEventListener('change', () => play(parseInt(sel.value, 10) || 0));
  video.addEventListener('playing', () => ui(true));
  video.addEventListener('pause', () => { if (useEl) useEl.setAttribute('href', '#i-play'); if (liveEl) liveEl.classList.remove('on'); });
  video.addEventListener('error', () => { if (wantPlay && opened) next(); });
  // Swipe on stage to zap channels.
  const stage = document.querySelector('.tv-stage');
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
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
    }
  } catch {}
  window.SH_TV = {
    open, close, toggle, next, prev,
    isOpen: () => opened,
    state: () => ({ idx, name: (SH_TV_CHANNELS[idx] || {}).name || '', opened }),
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export const SH_TV_API = { open, close, toggle, play, next, prev };
