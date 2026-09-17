/* SH TV v1 \u2014 custom HLS player, tech / documentary / news channels.
   All code and comments in English. */
(function () {
'use strict';
/* Verified live HLS streams (HTTP 200, m3u8) */
var CHANNELS = [
  { name: 'DW English', tag: 'DOC', url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8' },
  { name: 'TRT World', tag: 'NEWS', url: 'https://tv-trtworld.medya.trt.com.tr/master.m3u8' },
  { name: 'France 24 English', tag: 'NEWS', url: 'https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8' },
  { name: 'Red Bull TV', tag: 'TECH', url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8' }
];
var idx = 0, hls = null, opened = false, wantPlay = false;
var el = {};
function pick(id) { return document.getElementById(id); }
function setUse(playing) {
  var href = playing ? '#i-pause' : '#i-play';
  if (el.use) el.use.setAttribute('href', href);
  if (el.use2) el.use2.setAttribute('href', href);
}
function ui(playing) {
  setUse(playing);
  if (el.name) el.name.textContent = (CHANNELS[idx] && CHANNELS[idx].name) || '';
  if (el.tag) el.tag.textContent = (CHANNELS[idx] && CHANNELS[idx].tag) || '';
  if (el.sel) el.sel.value = String(idx);
}
function destroy() {
  if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
}
function attach(streamUrl) {
  destroy();
  if (window.Hls && window.Hls.isSupported()) {
    hls = new window.Hls({ lowLatencyMode: false, maxBufferLength: 20 });
    hls.loadSource(streamUrl);
    hls.attachMedia(el.video);
 hls.on(window.Hls.Events.ERROR, function (evt, data) {
      if (data && data.fatal) { next(); }
    });
  } else if (el.video.canPlayType('application/vnd.apple.mpegurl')) {
    el.video.src = streamUrl; /* Safari native HLS */
  } else {
    if (el.name) el.name.textContent = 'HLS not supported';
  }
}
function play(i) {
  if (!el.video) return;
  idx = ((i % CHANNELS.length) + CHANNELS.length) % CHANNELS.length;
  wantPlay = true;
  attach(CHANNELS[idx].url);
  var p = el.video.play();
  if (p && p.catch) p.catch(function () {});
  ui(true);
}
function next() { play(idx + 1); }
function prev() { play(idx - 1); }
function toggle() {
  if (!el.video) return;
  if (!el.video.src && !hls) { play(idx); return; }
  if (el.video.paused) {
    wantPlay = true;
    var p = el.video.play(); if (p && p.catch) p.catch(function () {});
    setUse(true);
  } else {
    wantPlay = false;
    el.video.pause();
    setUse(false);
  }
}
function fsMode() {
  try {
    if (document.fullscreenElement) { document.exitFullscreen(); }
    else if (el.win && el.win.requestFullscreen) { el.win.requestFullscreen(); } /* whole window so the control bar stays visible */
    else if (el.video && el.video.webkitEnterFullscreen) { el.video.webkitEnterFullscreen(); } /* iOS Safari */
  } catch (e) {}
}
function pipMode() {
  try {
    if (document.pictureInPictureElement === el.video) { document.exitPictureInPicture(); }
    else if (el.video.requestPictureInPicture) { el.video.requestPictureInPicture(); }
  } catch (e) {}
}
function open() {
  opened = true;
  el.root.classList.add('open');
  document.body.classList.add('locked');
  if (!el.video.src && !hls) { play(idx); } /* autoplay attempt */
}
function close() {
  opened = false;
  el.root.classList.remove('open');
  wantPlay = false;
  if (el.video) { el.video.pause(); }
  var act = document.querySelector('.section.active');
  document.body.classList.toggle('locked', !!(act && act.id === 'chat'));
}
function boot() {
  el.root = pick('tv'); el.video = pick('tv-video'); el.name = pick('tv-name');
  el.tag = pick('tv-tag'); el.sel = pick('tv-channel');
  el.use = pick('tv-use'); el.use2 = pick('tv-use2');
  if (!el.root || !el.video) return;
  CHANNELS.forEach(function (c, i) {
    var o = document.createElement('option');
    o.value = String(i);
    o.textContent = '[' + c.tag + '] ' + c.name;
    el.sel.appendChild(o);
  });
  el.sel.value = '0';
  el.stage = document.querySelector('.tv-stage');
  el.win = document.querySelector('.tv-win');
  el.fs = pick('tv-fs'); el.pip = pick('tv-pip');
  pick('tv-close').addEventListener('click', close);
  pick('tv-toggle').addEventListener('click', toggle);
  pick('tv-prev').addEventListener('click', prev);
  pick('tv-next').addEventListener('click', next);
  el.video.addEventListener('click', toggle); /* click video = play/pause, no center overlay */
  if (el.fs) el.fs.addEventListener('click', fsMode);
  if (el.pip) {
    el.pip.addEventListener('click', pipMode);
    try {
      if (!document.pictureInPictureEnabled || !el.video.requestPictureInPicture) el.pip.style.display = 'none';
    } catch (e) { el.pip.style.display = 'none'; }
  }
  document.addEventListener('fullscreenchange', function () {
    var on = document.fullscreenElement === el.win;
    if (el.fs) { var u = el.fs.querySelector('use'); if (u) u.setAttribute('href', on ? '#i-fsx' : '#i-fs'); }
  });
  el.sel.addEventListener('change', function () { play(parseInt(el.sel.value, 10) || 0); });
  el.video.addEventListener('playing', function () { ui(true); });
  el.video.addEventListener('pause', function () { setUse(false); });
  el.video.addEventListener('error', function () { if (wantPlay && opened) next(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && opened) close(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
window.SH_TV = { open: open, close: close, toggle: toggle, next: next, prev: prev,
  state: function () { return { idx: idx, name: (CHANNELS[idx] || {}).name || '', opened: opened }; } };
})();
