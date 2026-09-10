/* SH widgets v2 — FAB toggle, bottom sheet, widget cards */
(function () {
'use strict';
function $_(s) { return document.querySelector(s); }
function openWg() {
  $_('#widgets').classList.add('open');
  $_('#fab').classList.add('on');
}
function closeWidgets() {
  var w = $_('#widgets'); if (w) w.classList.remove('open');
  var f = $_('#fab'); if (f) f.classList.remove('on');
}
function boot() {
  var fab = $_('#fab');
  if (!fab || !$_('#widgets')) return;
  fab.addEventListener('click', function (e) {
    e.stopPropagation();
    var w = $_('#widgets');
    w.classList.contains('open') ? closeWidgets() : openWg();
  });
  $_('#wg-close').addEventListener('click', closeWidgets);
  document.addEventListener('click', function (e) {
    var w = $_('#widgets');
    if (!w.classList.contains('open')) return;
    if (!w.contains(e.target) && !fab.contains(e.target)) closeWidgets();
  });
  var wgRadio = $_('#wg-card-radio');
  if (wgRadio) wgRadio.addEventListener('click', function () {
    closeWidgets();
    if (window.SH && window.SH.show) window.SH.show('cover');
    setTimeout(function () { if (window.SH_RADIO) window.SH_RADIO.toggle(); }, 80);
  });
  /* News card: closed here; news.js opens the feed */
  var wgCv = $_('#wg-card-cv');
  if (wgCv) wgCv.addEventListener('click', function () {
    closeWidgets();
    $_('#panel').classList.remove('open');
    window.SH.show('official');
    setTimeout(function () { window.print(); }, 250);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeWidgets(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
window.SH_WIDGETS = { open: openWg, close: closeWidgets };
})();
