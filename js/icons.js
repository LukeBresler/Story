// Inline SVG icons (stroke-based, inherit currentColor).
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const ICONS = {
  elephant: `<svg viewBox="0 0 32 24" fill="currentColor"><ellipse cx="12" cy="11" rx="10" ry="7"/><circle cx="23" cy="9" r="5.5"/><path d="M27 10c2 2 2.6 5 2 10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><rect x="4" y="13" width="3.4" height="9" rx="1.2"/><rect x="9" y="13" width="3.4" height="9" rx="1.2"/><rect x="14.5" y="13" width="3.4" height="9" rx="1.2"/><rect x="19" y="12" width="3.4" height="10" rx="1.2"/></svg>`,
  water: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  grass: svg('<path d="M4 21c1-5 3-8 6-10M9 21c0-6 1-10 3-14M14 21c0-5-1-8-3-10M16 21c1-6 3-9 5-11"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  gather: svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>'),
  shield: svg('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>'),
  herd: svg('<path d="M3 18h18M5 18v-4a4 4 0 0 1 8 0v4M13 18v-3a3 3 0 0 1 6 0v3"/><circle cx="9" cy="7" r="2"/><circle cx="16" cy="9" r="1.6"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  book: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M8 7h7"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  rain: svg('<path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6H7z"/><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2"/>'),
  cloud: svg('<path d="M7 18a4 4 0 1 1 1-7.9A5 5 0 0 1 18 12a3 3 0 0 1 0 6H7z"/>'),
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 5M22 9l-5 5"/>'),
  call: svg('<path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M15 8c2 1 2 7 0 8M18 5c4 3 4 11 0 14"/>'),
  eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  wrench: svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5z"/>'),
  star: svg('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7L12 3z"/>'),
  leaf: svg('<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l7-7"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
};
