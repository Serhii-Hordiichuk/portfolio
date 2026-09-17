/* SH contacts — social + freelance buttons.
 * EDIT YOUR LINKS HERE. Replace href "#" / "mailto:you@example.com" with real ones.
 * Rendered into #contacts-content; re-rendered on language change (sh:lang).
 * Monoline SVG icons live in index.html as symbols c-linkedin, c-x, c-fb,
 * c-reddit, c-discord, c-tg, c-gmail, c-finn, c-frilans and inherit .ic theme styles.
 */

export const SH_CONTACTS = [
  // TODO: paste your real profile URLs below
  { id: 'linkedin', label: 'LinkedIn', handle: 'linkedin.com/in/…', href: '#', icon: 'c-linkedin' },
  { id: 'x', label: 'X', handle: '@…', href: '#', icon: 'c-x' },
  { id: 'facebook', label: 'Facebook', handle: 'facebook.com/…', href: '#', icon: 'c-fb' },
  { id: 'reddit', label: 'Reddit', handle: 'u/…', href: '#', icon: 'c-reddit' },
  { id: 'discord', label: 'Discord', handle: '@…', href: '#', icon: 'c-discord' },
  { id: 'telegram', label: 'Telegram', handle: 't.me/…', href: '#', icon: 'c-tg' },
  { id: 'gmail', label: 'Gmail', handle: 'you@example.com', href: 'mailto:you@example.com', icon: 'c-gmail', copy: 'you@example.com' },
  // TODO: replace with your exact profile URLs, e.g. https://www.finn.no/profile/…
  { id: 'finn', label: 'FINN', handle: 'finn.no', href: 'https://www.finn.no', icon: 'c-finn' },
  { id: 'frilansbasen', label: 'Frilansbasen', handle: 'frilansbasen.no', href: 'https://www.frilansbasen.no', icon: 'c-frilans' },
];

const SUB = {
  uk: 'Звʼяжіться зі мною — оберіть зручний канал',
  en: 'Get in touch — pick a channel',
  no: 'Ta kontakt — velg en kanal',
  de: 'Kontakt aufnehmen — Kanal wählen',
  fr: 'Contactez-moi — choisissez un canal',
  es: 'Contáctame — elige un canal',
  pl: 'Skontaktuj się — wybierz kanał',
  ru: 'Свяжитесь со мной — выберите канал',
  zh: '联系我 — 选择一个渠道',
  ar: 'تواصل معي — اختر قناة',
};

function lang() {
  return (document.documentElement.lang || 'uk').toLowerCase().slice(0, 2);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}

export function renderContacts() {
  const host = document.getElementById('contacts-content');
  if (!host) return;
  const l = lang();
  const sub = SUB[l] || SUB.en;

  const cards = SH_CONTACTS.map((c) => {
    const todo = !c.href || c.href === '#';
    const copyBtn = c.copy
      ? `<button class="ct-copy" data-copy="${esc(c.copy)}" title="Copy" aria-label="copy email"><svg class="ic"><use href="#i-copy"/></svg></button>`
      : '';
    return `<a class="ct-card${todo ? ' is-todo' : ''}" href="${esc(c.href)}"${todo ? ' aria-disabled="true" title="TODO: add link"' : ' target="_blank" rel="noopener noreferrer"'}>
      <span class="ct-ic"><svg class="ic ct-svg"><use href="#${esc(c.icon)}"/></svg></span>
      <span class="ct-tx"><b>${esc(c.label)}</b><i>${esc(c.handle || '')}</i></span>
      ${copyBtn}
      <span class="ct-go" aria-hidden="true">↗</span>
    </a>`;
  }).join('');

  host.innerHTML = `<p class="ct-sub">${esc(sub)}</p><div class="ct-grid">${cards}</div>`;

  host.querySelectorAll('[data-copy]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const v = b.getAttribute('data-copy') || '';
      try { navigator.clipboard.writeText(v); } catch (err) {}
      b.classList.add('ok');
      setTimeout(() => b.classList.remove('ok'), 900);
    });
  });
  // TODO links: don't navigate, just shake + hint
  host.querySelectorAll('.ct-card.is-todo').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      a.classList.remove('shake');
      void a.offsetWidth;
      a.classList.add('shake');
    });
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderContacts);
else renderContacts();
document.addEventListener('sh:lang', renderContacts);
