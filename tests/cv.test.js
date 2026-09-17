import { describe, it, expect } from 'vitest';
import { SH_CV } from '../public/src/i18n3.js';
import fs from 'node:fs';

function tail(arr) {
  return arr.slice(-11);
}

describe('CV self-learning block', () => {
  it('renames online-learning to self-learning in all languages', () => {
    const forbidden = [/онлайн/i, /online/i, /en l[ií]nea/i, /nauka online/i, /在线学习/, /عبر الإنترنت/];
    for (const [lang, arr] of Object.entries(SH_CV)) {
      const [ed5s] = tail(arr);
      for (const rx of forbidden) {
        expect(ed5s, `${lang} title should not contain online-learning: ${ed5s}`).not.toMatch(rx);
      }
    }
  });

  it('structures self-learning as list (not single line)', () => {
    for (const [lang, arr] of Object.entries(SH_CV)) {
      const [, ed5f] = tail(arr);
      const items = String(ed5f).split(';').map((s) => s.trim()).filter(Boolean);
      expect(items.length, `${lang} self-learning should have >=3 items, got: ${ed5f}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('renders self-learning as <ul> list in app.js', () => {
    const src = fs.readFileSync(new URL('../public/src/app.js', import.meta.url), 'utf8');
    expect(src).toMatch(/cv-learn/);
    expect(src).toMatch(/<ul/);
  });
});
