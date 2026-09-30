// Small shared helpers.

export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const YEAR = 365.25 * DAY;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Deterministic PRNG so weather/stars are stable for a given seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mixRgb(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function rgb(c, alpha = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
}

// Interpolate a keyed palette: stops = [[key, value], ...] sorted by key.
export function keyed(stops, k) {
  if (k <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (k <= stops[i][0]) {
      const [k0, v0] = stops[i - 1];
      const [k1, v1] = stops[i];
      const t = (k - k0) / (k1 - k0);
      if (Array.isArray(v0[0])) return v0.map((c, j) => mixRgb(c, v1[j], t));
      return mixRgb(v0, v1, t);
    }
  }
  return stops[stops.length - 1][1];
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function plural(n, word, pl = word + 's') {
  return `${n} ${n === 1 ? word : pl}`;
}

export function fmtDuration(ms) {
  const m = Math.round(ms / MIN);
  if (m < 60) return plural(Math.max(1, m), 'minute');
  const h = Math.round(ms / HOUR);
  if (h < 48) return plural(h, 'hour');
  return plural(Math.round(ms / DAY), 'day');
}

export function fmtAge(years) {
  if (years < 1) {
    const months = Math.max(1, Math.floor(years * 12));
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  const y = Math.floor(years);
  return `${y} year${y === 1 ? '' : 's'}`;
}

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
