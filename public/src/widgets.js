// SH widgets v4 — ESM. Wires cover buttons to the three separate drawers:
// News (bottom), Radio (left), TV (right). Keeps legacy #media-open working.
function boot() {
  const newsOpen = document.getElementById('news-open');
  const radioOpen = document.getElementById('radio-open');
  const tvOpen = document.getElementById('tv-open');
  const legacyMedia = document.getElementById('media-open');

  if (newsOpen && !newsOpen.dataset.wired) {
    newsOpen.dataset.wired = '1';
    // news.js wires its own button; this is a fallback noop guard.
  }
  if (radioOpen && !radioOpen.dataset.wired) {
    radioOpen.dataset.wired = '1';
  }
  if (tvOpen && !tvOpen.dataset.wired) {
    tvOpen.dataset.wired = '1';
  }
  // Legacy compat: old "Media Player" button opens TV drawer.
  if (legacyMedia) {
    legacyMedia.addEventListener('click', () => {
      try { window.SH_TV && window.SH_TV.open(); } catch {}
    });
  }
  // Global Escape closes everything (each module also handles it).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    try { window.SH_NEWS && window.SH_NEWS.isOpen() && window.SH_NEWS.close(); } catch {}
    try { window.SH_RADIO && window.SH_RADIO.isOpen() && window.SH_RADIO.close(); } catch {}
    try { window.SH_TV && window.SH_TV.isOpen() && window.SH_TV.close(); } catch {}
  });
  window.SH_WIDGETS = {
    openNews: () => { try { window.SH_NEWS.open('modal'); } catch {} },
    openRadio: () => { try { window.SH_RADIO.open(); } catch {} },
    openTv: () => { try { window.SH_TV.open(); } catch {} },
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export const SH_WIDGETS_API = {};
