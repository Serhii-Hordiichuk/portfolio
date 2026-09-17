/* SH stack v1 - Dev page: chips filter + live search + per-group counts */
export function initStack() {
  const q = document.getElementById('st-q');
  const chips = document.getElementById('st-chips');
  const count = document.getElementById('st-count');
  const wrap = document.getElementById('st-groups');
  const empty = document.getElementById('st-empty');
  if (!q || !chips || !count || !wrap) return;
  const groups = Array.from(wrap.querySelectorAll('.st-group'));
  const tiles = Array.from(wrap.querySelectorAll('.st-tile'));
  const langSel = document.getElementById('lang-select');
  const st = { f: 'all', q: '' };

  function plural(n) {
    const l = document.documentElement.lang || 'uk';
    if (l === 'uk') {
      const a = n % 10, b = n % 100;
      if (a === 1 && b !== 11) return 'технологія';
      if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'технології';
      return 'технологій';
    }
    if (l === 'no') return n === 1 ? 'teknologi' : 'teknologier';
    return n === 1 ? 'technology' : 'technologies';
  }

  function apply() {
    let vis = 0;
    groups.forEach((g) => {
      const showG = st.f === 'all' || g.getAttribute('data-g') === st.f;
      let gv = 0;
      Array.from(g.querySelectorAll('.st-tile')).forEach((t) => {
        const hay = ((t.getAttribute('data-tags') || '') + ' ' + t.textContent).toLowerCase();
        const ok = showG && (!st.q || hay.indexOf(st.q) > -1);
        t.hidden = !ok;
        if (ok) gv++;
      });
      g.hidden = !showG || (!!st.q && !gv);
      const h = g.querySelector('.st-h');
      if (h) h.setAttribute('data-n', showG ? String(gv) : '');
      vis += gv;
    });
    count.textContent = vis + ' / ' + tiles.length + ' — ' + plural(vis);
    if (empty) empty.style.display = vis ? 'none' : 'block';
  }

  chips.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('.chip') : null;
    if (!b) return;
    Array.from(chips.querySelectorAll('.chip')).forEach((c) => { c.classList.toggle('on', c === b); });
    st.f = b.getAttribute('data-f') || 'all';
    apply();
  });

  q.addEventListener('input', () => { st.q = q.value.trim().toLowerCase(); apply(); });
  if (langSel) langSel.addEventListener('change', () => { setTimeout(apply, 0); });
  apply();
}

// Auto-init on DOM ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStack);
else initStack();