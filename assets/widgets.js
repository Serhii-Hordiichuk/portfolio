/* SH widgets v3 \u2014 FAB, sheet, three widgets: Radio / TV / News */
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
  /* Radio widget: cover page + start playback */
  var wgRadio = $_('#wg-card-radio');
  if (wgRadio) wgRadio.addEventListener('click', function () {
    closeWidgets();
    if (window.SH && window.SH.show) window.SH.show('cover');
    setTimeout(function () { if (window.SH_RADIO) window.SH_RADIO.toggle(); }, 80);
  });
  /* TV widget: modal player */
  var wgTv = $_('#wg-card-tv');
  if (wgTv) wgTv.addEventListener('click', function () {
    closeWidgets();
    setTimeout(function () { if (window.SH_TV) window.SH_TV.open(); }, 60);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeWidgets(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
window.SH_WIDGETS = { open: openWg, close: closeWidgets };
})();
