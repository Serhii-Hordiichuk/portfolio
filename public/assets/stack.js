/* SH stack v1 - Dev page: chips filter + live search + per-group counts */
(function () {
'use strict';
function boot() {
  var q = document.getElementById('st-q');
  var chips = document.getElementById('st-chips');
  var count = document.getElementById('st-count');
  var wrap = document.getElementById('st-groups');
  var empty = document.getElementById('st-empty');
  if (!q || !chips || !count || !wrap) return;
  var groups = [].slice.call(wrap.querySelectorAll('.st-group'));
  var tiles = [].slice.call(wrap.querySelectorAll('.st-tile'));
  var langSel = document.getElementById('lang-select');
  var st = { f: 'all', q: '' };
  function plural(n) {
    var l = document.documentElement.lang || 'uk';
    if (l === 'uk') {
      var a = n % 10, b = n % 100;
      if (a === 1 && b !== 11) return '\u0442\u0435\u0445\u043d\u043e\u043b\u043e\u0433\u0456\u044f';
      if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return '\u0442\u0435\u0445\u043d\u043e\u043b\u043e\u0433\u0456\u0457';
      return '\u0442\u0435\u0445\u043d\u043e\u043b\u043e\u0433\u0456\u0439';
    }
    if (l === 'no') return n === 1 ? 'teknologi' : 'teknologier';
    return n === 1 ? 'technology' : 'technologies';
  }
  function apply() {
    var vis = 0;
    groups.forEach(function (g) {
      var showG = st.f === 'all' || g.getAttribute('data-g') === st.f;
      var gv = 0;
      [].slice.call(g.querySelectorAll('.st-tile')).forEach(function (t) {
        var hay = ((t.getAttribute('data-tags') || '') + ' ' + t.textContent).toLowerCase();
        var ok = showG && (!st.q || hay.indexOf(st.q) > -1);
        t.hidden = !ok;
        if (ok) gv++;
      });
      g.hidden = !showG || (!!st.q && !gv);
      var h = g.querySelector('.st-h');
      if (h) h.setAttribute('data-n', showG ? String(gv) : '');
      vis += gv;
    });
    count.textContent = vis + ' / ' + tiles.length + ' \u2014 ' + plural(vis);
    if (empty) empty.style.display = vis ? 'none' : 'block';
  }
  chips.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.chip') : null;
    if (!b) return;
    [].slice.call(chips.querySelectorAll('.chip')).forEach(function (c) { c.classList.toggle('on', c === b); });
    st.f = b.getAttribute('data-f') || 'all';
    apply();
  });
  q.addEventListener('input', function () { st.q = q.value.trim().toLowerCase(); apply(); });
  if (langSel) langSel.addEventListener('change', function () { setTimeout(apply, 0); });
  apply();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();