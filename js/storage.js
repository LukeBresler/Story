// Persistence. Everything lives in this device's localStorage.
import { DEFAULT_SETTINGS, MAX_PLAYS } from './config.js';

const K = { meta: 'e37.meta', save: 'e37.save', settings: 'e37.settings', dev: 'e37.dev' };

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the game still runs, it just won't persist */
  }
}

export const store = {
  meta() {
    return { playsUsed: 0, bonusPlays: 0, history: [], ...read(K.meta, {}) };
  },
  saveMeta(m) {
    write(K.meta, m);
  },
  playsLeft(m = this.meta()) {
    return Math.max(0, MAX_PLAYS + m.bonusPlays - m.playsUsed);
  },
  maxPlays(m = this.meta()) {
    return MAX_PLAYS + m.bonusPlays;
  },
  loadGame() {
    return read(K.save, null);
  },
  saveGame(state, clock) {
    write(K.save, { state, clock });
  },
  clearGame() {
    localStorage.removeItem(K.save);
  },
  settings() {
    return { ...DEFAULT_SETTINGS, ...read(K.settings, {}) };
  },
  saveSettings(s) {
    write(K.settings, s);
  },
  devUnlocked() {
    return read(K.dev, false) === true;
  },
  setDev(on) {
    write(K.dev, on);
  },
  wipe() {
    Object.values(K).forEach((k) => localStorage.removeItem(k));
  },
};
