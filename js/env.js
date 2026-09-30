// The real-world environment of Amboseli: clock, season, sun, moon, weather.
import { LOCATION } from './config.js';
import { HOUR, DAY, clamp, lerp, mulberry32 } from './util.js';

// A clock that normally tracks real time but can be sped up or shifted in Dev Mode.
export class Clock {
  constructor() {
    this.anchorReal = Date.now();
    this.anchorVirtual = Date.now();
    this.speed = 1;
  }
  load(o) {
    if (!o) return;
    this.anchorReal = o.ar;
    this.anchorVirtual = o.av;
    this.speed = o.s || 1;
  }
  toJSON() {
    return { ar: this.anchorReal, av: this.anchorVirtual, s: this.speed };
  }
  now() {
    return this.anchorVirtual + (Date.now() - this.anchorReal) * this.speed;
  }
  setSpeed(s) {
    const n = this.now();
    this.anchorReal = Date.now();
    this.anchorVirtual = n;
    this.speed = s;
  }
  jump(ms) {
    const n = this.now();
    this.anchorReal = Date.now();
    this.anchorVirtual = n + ms;
  }
  resync() {
    this.anchorReal = Date.now();
    this.anchorVirtual = Date.now();
    this.speed = 1;
  }
}

// Date shifted into Amboseli local time; read it with getUTC* methods.
export function localDate(ms) {
  return new Date(ms + LOCATION.utcOffset * HOUR);
}

export function dayOfYear(ms) {
  const d = localDate(ms);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / DAY) + 1;
}

// Amboseli is bimodal: long rains Mar–May, short rains Nov–Dec, dry otherwise.
export const SEASONS = {
  'short-dry': {
    name: 'Short Dry Season',
    months: 'January – February',
    blurb: 'Hot days between the rains. The swamps still hold water, but the plains are browning.',
    rain: 0.07,
    water: 1.15,
    forage: 1.0,
    waterhole: -1.0,
  },
  'long-rains': {
    name: 'Long Rains',
    local: 'Masika',
    months: 'March – May',
    blurb: 'The heavy rains. The plains turn green, pools fill, and calves are often born.',
    rain: 0.45,
    water: 0.6,
    forage: 0.6,
    waterhole: 3.0,
  },
  'long-dry': {
    name: 'Long Dry Season',
    months: 'June – October',
    blurb: 'Months without rain. Grass withers to gold and the herd depends on the swamps fed by Kilimanjaro.',
    rain: 0.03,
    water: 1.3,
    forage: 1.25,
    waterhole: -1.6,
  },
  'short-rains': {
    name: 'Short Rains',
    local: 'Vuli',
    months: 'November – December',
    blurb: 'The short rains return. Relief after the long dry, and fresh green shoots everywhere.',
    rain: 0.35,
    water: 0.75,
    forage: 0.75,
    waterhole: 2.0,
  },
};

const MONTH_SEASON = [
  'short-dry', 'short-dry', 'long-rains', 'long-rains', 'long-rains', 'long-dry',
  'long-dry', 'long-dry', 'long-dry', 'long-dry', 'short-rains', 'short-rains',
];

// How green the land looks through the year (0 = dust, 1 = lush).
const MONTH_GREEN = [0.5, 0.38, 0.55, 0.9, 1.0, 0.78, 0.56, 0.36, 0.22, 0.12, 0.45, 0.72];

export class Environment {
  constructor(clock, settings) {
    this.clock = clock;
    this.settings = settings;
  }

  now() {
    return this.clock.now();
  }

  // Local hour, honouring the Dev Mode override.
  hour(ms = this.now()) {
    if (this.settings.hourOverride >= 0) return this.settings.hourOverride;
    const d = localDate(ms);
    return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  }

  seasonKey(ms = this.now()) {
    if (this.settings.seasonOverride !== 'auto') return this.settings.seasonOverride;
    return MONTH_SEASON[localDate(ms).getUTCMonth()];
  }

  season(ms) {
    return SEASONS[this.seasonKey(ms)];
  }

  greenness(ms = this.now()) {
    const key = this.seasonKey(ms);
    if (this.settings.seasonOverride !== 'auto') {
      return { 'short-dry': 0.4, 'long-rains': 0.95, 'long-dry': 0.18, 'short-rains': 0.65 }[key];
    }
    const d = localDate(ms);
    const m = d.getUTCMonth();
    const days = new Date(Date.UTC(d.getUTCFullYear(), m + 1, 0)).getUTCDate();
    const f = (d.getUTCDate() - 1) / days;
    return lerp(MONTH_GREEN[m], MONTH_GREEN[(m + 1) % 12], f);
  }

  // Effective timestamp used for sun position (applies the hour override).
  solarMs(ms = this.now()) {
    if (this.settings.hourOverride < 0) return ms;
    const d = localDate(ms);
    const midnightLocal = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - LOCATION.utcOffset * HOUR;
    return midnightLocal + this.settings.hourOverride * HOUR;
  }

  // NOAA solar position approximation. Returns elevation in degrees.
  sunElevation(ms = this.now()) {
    const t = this.solarMs(ms);
    const { lat, lon } = LOCATION;
    const d = new Date(t);
    const start = Date.UTC(d.getUTCFullYear(), 0, 1);
    const doy = Math.floor((t - start) / DAY) + 1;
    const hr = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    const g = ((2 * Math.PI) / 365) * (doy - 1 + (hr - 12) / 24);
    const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const tst = hr * 60 + eqtime + 4 * lon; // true solar time in minutes (UTC based)
    const ha = ((tst / 4 - 180) * Math.PI) / 180;
    const la = (lat * Math.PI) / 180;
    const cosZ = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
    return 90 - (Math.acos(clamp(cosZ, -1, 1)) * 180) / Math.PI;
  }

  // Sunrise / sunset as local decimal hours.
  sunTimes(ms = this.now()) {
    const { lat, lon, utcOffset } = LOCATION;
    const doy = dayOfYear(ms);
    const g = ((2 * Math.PI) / 365) * (doy - 1);
    const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const la = (lat * Math.PI) / 180;
    const z = (90.833 * Math.PI) / 180;
    const ha = (Math.acos(Math.cos(z) / (Math.cos(la) * Math.cos(decl)) - Math.tan(la) * Math.tan(decl)) * 180) / Math.PI;
    const rise = (720 - 4 * (lon + ha) - eqtime) / 60 + utcOffset;
    const set = (720 - 4 * (lon - ha) - eqtime) / 60 + utcOffset;
    return { rise, set };
  }

  // 0 = new moon, 0.5 = full moon.
  moonPhase(ms = this.now()) {
    const ref = Date.UTC(2000, 0, 6, 18, 14);
    const syn = 29.530588853;
    const days = (ms - ref) / DAY;
    return (((days % syn) + syn) % syn) / syn;
  }

  moonIllumination(ms) {
    return (1 - Math.cos(this.moonPhase(ms) * 2 * Math.PI)) / 2;
  }

  moonName(ms) {
    const p = this.moonPhase(ms);
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    return names[Math.round(p * 8) % 8];
  }

  // Deterministic hourly weather, weighted toward afternoon storms in the rains.
  weather(ms = this.now()) {
    const d = localDate(ms);
    const h = this.hour(ms);
    const hourIndex = Math.floor(d.getTime() / HOUR);
    const r = mulberry32(hourIndex * 2654435761)();
    const r2 = mulberry32(hourIndex * 40503 + 7)();
    const season = this.season(ms);
    const tod = h >= 13 && h < 20 ? 1.6 : h >= 20 || h < 5 ? 0.8 : 0.5;
    const raining = r < season.rain * tod;
    const cloud = clamp(season.rain * 1.4 + (raining ? 0.5 : 0) + (r2 - 0.5) * 0.3, 0.05, 1);
    const key = this.seasonKey(ms);
    const range = { 'short-dry': [16, 32], 'long-rains': [17, 28], 'long-dry': [13, 28], 'short-rains': [16, 29] }[key];
    const curve = Math.cos(((h - 14.5) / 24) * 2 * Math.PI) * 0.5 + 0.5;
    const temp = Math.round(lerp(range[0], range[1], curve) - (raining ? 4 : 0));
    return { raining, cloud, temp };
  }

  period(ms = this.now()) {
    const el = this.sunElevation(ms);
    const h = this.hour(ms);
    if (el < -6) return 'night';
    if (el < 8) return h < 12 ? 'dawn' : 'dusk';
    if (h >= 11 && h < 15.5) return 'midday';
    return h < 12 ? 'morning' : 'afternoon';
  }

  isNight(ms) {
    return this.sunElevation(ms) < -6;
  }
}

export function fmtClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
