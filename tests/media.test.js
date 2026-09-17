import { describe, it, expect } from 'vitest';
import { SH_STATIONS, SH_TV_CHANNELS, wrapIndex } from '../public/src/stations.js';

describe('media stations', () => {
  it('exports at least 6 radio stations with name/country/https url', () => {
    expect(Array.isArray(SH_STATIONS)).toBe(true);
    expect(SH_STATIONS.length).toBeGreaterThanOrEqual(6);
    for (const s of SH_STATIONS) {
      expect(s.name).toBeTruthy();
      expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('exports at least 4 TV channels with m3u8 urls', () => {
    expect(Array.isArray(SH_TV_CHANNELS)).toBe(true);
    expect(SH_TV_CHANNELS.length).toBeGreaterThanOrEqual(4);
    for (const c of SH_TV_CHANNELS) {
      expect(c.name).toBeTruthy();
      expect(c.url).toContain('m3u8');
    }
  });

  it('wrapIndex wraps prev/next navigation', () => {
    expect(wrapIndex(0, -1, 4)).toBe(3);
    expect(wrapIndex(3, 1, 4)).toBe(0);
    expect(wrapIndex(1, 1, 4)).toBe(2);
  });
});
