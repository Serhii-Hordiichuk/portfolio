// SH stations — ESM source of truth for radio + TV.
// Radio: verified HTTPS mp3 streams (classical / celtic / ambient + UA).
// TV: verified live HLS streams (m3u8).
export const SH_STATIONS = [
  { name: 'NRK Klassisk · Norge', country: 'NO', url: 'https://cdn0-47115-liveicecast0.dna.contentdelivery.net/klassisk_mp3_h' },
  { name: 'SR P2 Klassiskt · Sverige', country: 'SE', url: 'https://live1.sr.se/p2-mp3-192' },
  { name: 'Radio NV · Україна', country: 'UA', url: 'https://radio.nv.ua/nv.mp3' },
  { name: 'Hromadske Radio · Україна', country: 'UA', url: 'https://mp3.hromadske.radio/nazhyvo' },
  { name: 'Lux FM · Україна', country: 'UA', url: 'https://icecast.luxnet.ua/lux_mp3' },
  { name: 'ThistleRadio Celtic · World', country: 'WORLD', url: 'https://ice1.somafm.com/thistle-128-mp3' },
  { name: 'Groove Salad Classic · World', country: 'WORLD', url: 'https://ice1.somafm.com/gsclassic-128-mp3' },
  { name: 'Drone Zone Ambient · World', country: 'WORLD', url: 'https://ice1.somafm.com/dronezone-128-mp3' },
  { name: 'Deep Space One · World', country: 'WORLD', url: 'https://ice1.somafm.com/deepspaceone-128-mp3' },
];

export const SH_TV_CHANNELS = [
  { name: 'DW English', tag: 'DOC', url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8' },
  { name: 'TRT World', tag: 'NEWS', url: 'https://tv-trtworld.medya.trt.com.tr/master.m3u8' },
  { name: 'France 24 English', tag: 'NEWS', url: 'https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8' },
  { name: 'Red Bull TV', tag: 'TECH', url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8' },
  { name: 'Suspilne Novyny · UA', tag: 'UA', url: 'https://lattelecom-eu-lb.cdn.enetres.co.uk/etv/suspilne/playlist.m3u8' },
];

/** Wrap prev/next index navigation. */
export function wrapIndex(idx, step, total) {
  if (!total || total <= 0) return 0;
  return ((idx + step) % total + total) % total;
}

// Keep legacy global for any old asset scripts.
try {
  window.SH_STATIONS = SH_STATIONS;
} catch {}
try {
  window.SH_TV_CHANNELS = SH_TV_CHANNELS;
} catch {}
