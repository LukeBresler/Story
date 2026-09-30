// The living savanna: sky, Kilimanjaro, weather, and the herd itself.
import { clamp, lerp, rand, keyed, rgb, mixRgb, hexToRgb, mulberry32 } from './util.js';
import { ageOf } from './herd.js';
import { drawElephant, drawLion, drawHyena, drawTruck, drawEgret, drawTree, sizeFor } from './sprites.js';

const H2 = (h) => hexToRgb(h);

const SKY = [
  [-18, [H2('#05070f'), H2('#0c1128')]],
  [-10, [H2('#0a1030'), H2('#1b2352')]],
  [-4, [H2('#1b2458'), H2('#7a4c78')]],
  [0, [H2('#2f4585'), H2('#f28c5c')]],
  [5, [H2('#4a78bd'), H2('#f8bf8c')]],
  [12, [H2('#4a91da'), H2('#d3e8f4')]],
  [40, [H2('#3a86dc'), H2('#c2e4f7')]],
];

const ANCHORS = {
  home: [0.46, 0.55],
  drink: [0.74, 0.34],
  graze: [0.24, 0.62],
};
const FAMILY_OFF = { Bibi: [-0.07, -0.02], Taji: [0.07, -0.08], Amani: [0.02, 0.12], Tembo: [0.13, 0.06] };

export class Renderer {
  constructor(canvas, game, env) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.env = env;
    this.vis = new Map();
    this.cam = 0;
    this.camTarget = null;
    this.lastDrag = 0;
    this.particles = [];
    this.fleeing = [];
    this.rangers = null;
    this.selected = null;
    this.hotspots = [];
    this.onTap = () => {};
    this.anchor = [...ANCHORS.home];
    this.t = 0;
    this.preview = false; // title-screen mode (no gameplay state)

    const r = mulberry32(37);
    this.stars = Array.from({ length: 160 }, () => [r(), r() * 0.95, r() * 1.4 + 0.3, r() * 6]);
    this.trees = [];
    for (let i = 0; i < 9; i++) this.trees.push({ x: r(), d: -0.02 + r() * 0.1, s: 0.55 + r() * 0.5, kind: 'acacia' });
    this.trees.push({ x: 0.86, d: 0.18, s: 1.05, kind: 'fever' }, { x: 0.63, d: 0.12, s: 0.85, kind: 'fever' }, { x: 0.06, d: 0.4, s: 1.35, kind: 'acacia' }, { x: 0.97, d: 0.55, s: 1.5, kind: 'acacia' });
    this.tufts = Array.from({ length: 90 }, () => ({ x: r(), d: 0.05 + r() * 0.95, h: 4 + r() * 7, ph: r() * 6 }));
    this.clouds = Array.from({ length: 10 }, (_, i) => ({ x: r(), y: 0.05 + r() * 0.35, s: 0.6 + r() * 0.9, sp: 0.002 + r() * 0.004, i }));
    this.rain = Array.from({ length: 140 }, () => [r(), r(), 0.6 + r() * 0.8]);
    this.egrets = Array.from({ length: 7 }, (_, i) => ({ idx: i * 5 + 2, off: r() * 30 - 15, fly: 0, fx: 0, fy: 0 }));

    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.c.width = this.W * dpr;
    this.c.height = this.H * dpr;
    this.c.style.width = this.W + 'px';
    this.c.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const portrait = this.H > this.W;
    this.horizon = this.H * (portrait ? 0.4 : 0.44);
    this.groundBottom = this.H - (portrait ? 128 : 110);
    this.worldW = Math.max(this.W, this.H * 1.25, 760);
    this.base = clamp(Math.min(this.W, this.H) / 520, 0.62, 1.3);
    this.cam = clamp(this.cam, 0, this.worldW - this.W);
  }

  // World helpers: x in 0..1 of world width, d = depth 0 (far) .. 1 (near).
  sy(d) {
    return this.horizon + 10 + d * (this.groundBottom - this.horizon - 10);
  }
  sx(x) {
    return x * this.worldW - this.cam;
  }
  scale(d) {
    return (0.42 + 0.68 * d) * this.base;
  }

  // ---------- input ----------

  bindInput() {
    let down = null;
    this.c.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, cam: this.cam, moved: false, t: performance.now() };
      this.c.setPointerCapture(e.pointerId);
    });
    this.c.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (Math.abs(dx) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true;
      if (down.moved) {
        this.cam = clamp(down.cam - dx, 0, this.worldW - this.W);
        this.lastDrag = performance.now();
      }
    });
    this.c.addEventListener('pointerup', (e) => {
      if (down && !down.moved) this.tap(e.clientX, e.clientY);
      down = null;
    });
    this.c.addEventListener('pointercancel', () => (down = null));
  }

  tap(x, y) {
    for (const h of this.hotspots) {
      if (Math.hypot(x - h.x, y - h.y) < h.r) {
        this.onTap(h.id, 'indicator');
        return;
      }
    }
    const e = this.pick(x, y);
    this.onTap(e ? e.id : null, 'tap');
  }

  pick(x, y) {
    let best = null;
    let bestY = -Infinity;
    for (const e of this.game.state ? this.game.herd : []) {
      const v = this.vis.get(e.id);
      if (!v || v.hidden || e.status === 'dead' || e.status === 'lost') continue;
      const s = this.scale(v.y) * sizeFor(ageOf(e, this.env.now()), e.sex);
      const px = this.sx(v.x);
      const py = this.sy(v.y);
      const w = 46 * s;
      const h = 64 * s;
      if (x > px - w && x < px + w && y > py - h && y < py + 6 && py > bestY) {
        best = e;
        bestY = py;
      }
    }
    return best;
  }

  focusOn(id) {
    const v = this.vis.get(id);
    if (v) this.camTarget = clamp(v.x * this.worldW - this.W / 2, 0, this.worldW - this.W);
  }

  // ---------- effects ----------

  hearts(id, n = 6) {
    const v = this.vis.get(id);
    if (!v) return;
    const s = this.scale(v.y);
    for (let i = 0; i < n; i++) {
      this.particles.push({ type: 'heart', wx: v.x, d: v.y, oy: -60 * s * rand(0.8, 1.2), vx: rand(-14, 14), vy: rand(-40, -24), life: 0, max: rand(1.4, 2.2), size: rand(6, 11) * s + 3, delay: i * 0.08 });
    }
  }

  sparkle(id, color = '#ffd98a') {
    const v = this.vis.get(id);
    if (!v) return;
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      this.particles.push({ type: 'spark', wx: v.x, d: v.y, oy: -40 * this.scale(v.y), vx: Math.cos(a) * rand(30, 80), vy: Math.sin(a) * rand(30, 80) - 20, life: 0, max: rand(0.8, 1.4), color });
    }
  }

  trumpet(id) {
    const v = this.vis.get(id);
    if (v) v.trumpet = 1.4;
  }

  sendRangers() {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.rangers = { x: side < 0 ? -0.1 : 1.1, dir: -side, life: 0 };
  }

  showThreat() {
    this.lastDrag = 0; // hand the camera back to auto-follow
  }

  scare(threat) {
    const preds = this.predatorPositions(threat, performance.now() / 1000);
    preds.forEach((p) => this.fleeing.push({ ...p, type: threat.type, dir: threat.side, life: 0 }));
  }

  // ---------- simulation of visuals ----------

  anchorFor() {
    const s = this.game.state;
    const a = s && s.activity;
    let target = ANCHORS.home;
    if (a && a.type === 'drink') target = ANCHORS.drink;
    else if (a && a.type === 'graze') target = ANCHORS.graze;
    else if (!a) {
      const drift = Math.sin(this.t * 0.01) * 0.06;
      target = [ANCHORS.home[0] + drift, ANCHORS.home[1]];
    }
    this.anchor[0] = lerp(this.anchor[0], target[0], 0.02);
    this.anchor[1] = lerp(this.anchor[1], target[1], 0.02);
    return this.anchor;
  }

  updateHerd(dt) {
    const g = this.game;
    if (!g.state) return;
    const now = this.env.now();
    const [ax, ay] = this.anchorFor();
    const gathering = g.state.activity && g.state.activity.type === 'gather';
    const night = this.env.isNight(now);
    const members = g.herd;
    let ringIdx = 0;
    const adults = members.filter((e) => e.status === 'herd' && ageOf(e, now) >= 8);
    const ringN = Math.max(1, adults.length);

    for (const e of members) {
      let v = this.vis.get(e.id);
      const age = ageOf(e, now);
      if (!v) {
        const off = FAMILY_OFF[e.family] || [0, 0];
        v = { x: ax + off[0] + rand(-0.08, 0.08), y: clamp(ay + off[1] + rand(-0.12, 0.12), 0.05, 0.98), tx: 0, ty: 0, dir: Math.random() < 0.5 ? -1 : 1, phase: rand(0, 6), next: 0, seed: rand(0, 10), moving: false, trumpet: 0, hidden: false };
        v.tx = v.x;
        v.ty = v.y;
        if (e.newborn) {
          const m = this.vis.get(e.motherId);
          if (m) {
            v.x = m.x + 0.01;
            v.y = m.y + 0.01;
          }
        }
        this.vis.set(e.id, v);
      }
      if (e.status === 'dead' || e.status === 'lost') {
        v.hidden = true;
        continue;
      }
      if (v.hidden && e.status === 'herd') {
        // Returning from somewhere off-screen.
        v.hidden = false;
        v.x = Math.random() < 0.5 ? -0.04 : 1.04;
        v.y = 0.4;
        v.next = 0;
      }
      v.hidden = false;
      let speed = (age < 5 ? 26 : 20) * this.base;
      v.next -= dt;

      if (e.status === 'wandering') {
        v.tx = e.wanderSide < 0 ? -0.07 : 1.07;
        v.ty = 0.3;
        speed = 7 * this.base;
      } else if (gathering) {
        if (age >= 8) {
          const a = (ringIdx++ / ringN) * Math.PI * 2;
          v.tx = ax + Math.cos(a) * 0.075;
          v.ty = clamp(ay + Math.sin(a) * 0.16, 0.05, 0.98);
        } else {
          const a = v.seed;
          v.tx = ax + Math.cos(a) * 0.022;
          v.ty = clamp(ay + Math.sin(a) * 0.05, 0.05, 0.98);
        }
        speed *= 2.2;
      } else if (v.next <= 0) {
        v.next = rand(4, 11) * (night ? 2.5 : 1);
        const mother = e.motherId && this.vis.get(e.motherId);
        const motherHere = mother && !mother.hidden;
        if (age < 6 && motherHere) {
          v.tx = mother.x + rand(-0.018, 0.018) + mother.dir * 0.006;
          v.ty = clamp(mother.y + rand(0.005, 0.045), 0.05, 0.99);
          v.next = rand(1.5, 4);
        } else {
          const off = FAMILY_OFF[e.family] || [0, 0];
          const spread = g.state.activity ? 0.6 : 1;
          v.tx = ax + off[0] * spread + rand(-0.075, 0.075) * spread;
          v.ty = clamp(ay + off[1] * spread + rand(-0.13, 0.13) * spread, 0.04, 0.98);
        }
      }
      // Returning wanderers hurry.
      if (e.status === 'herd' && (v.x < 0 || v.x > 1)) speed *= 3;

      const dx = (v.tx - v.x) * this.worldW;
      const dy = (v.ty - v.y) * (this.groundBottom - this.horizon);
      const dist = Math.hypot(dx, dy);
      const step = speed * this.scale(v.y) * dt;
      if (dist > 2) {
        const k = Math.min(1, step / dist);
        v.x += (dx * k) / this.worldW;
        v.y += (dy * k) / (this.groundBottom - this.horizon);
        v.phase += (step / Math.max(0.3, sizeFor(age, e.sex))) * 0.22;
        v.moving = true;
        if (Math.abs(dx) > 1.5) v.dir = dx > 0 ? 1 : -1;
      } else {
        v.moving = false;
      }
      v.trumpet = Math.max(0, v.trumpet - dt);
    }
  }

  predatorPositions(threat, time) {
    const total = threat.deadline - threat.start;
    const f = clamp((Date.now() - threat.start) / total, 0, 1);
    const [ax, ay] = this.anchor;
    const n = threat.type === 'lions' ? 3 : threat.type === 'hyenas' ? 4 : 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      if (threat.type === 'poachers') {
        const x = threat.side < 0 ? lerp(0.12, 0.36, f) : lerp(0.88, 0.62, f);
        out.push({ x, d: -0.04, i });
      } else {
        const startX = ax + threat.side * (0.2 + i * 0.03);
        const endX = ax + threat.side * (0.1 + i * 0.025);
        out.push({ x: lerp(startX, endX, smoothIn(f)) + Math.sin(time + i) * 0.003, d: clamp(ay + 0.12 + (i - 1) * 0.12, 0.05, 0.98), i });
      }
    }
    return out;
  }

  // ---------- drawing ----------

  frame(dt) {
    this.t += dt;
    const ctx = this.ctx;
    const { W, H } = this;
    const now = this.env.now();
    const elev = this.env.sunElevation(now);
    const light = clamp((elev + 6) / 18, 0, 1);
    const weather = this.env.weather(now);
    const green = this.env.greenness(now);
    const [skyTop, skyBot] = keyed(SKY, elev);
    const rainDim = weather.raining ? 0.35 : weather.cloud * 0.15;

    this.updateHerd(dt);

    // Camera: follow the herd unless the player recently dragged.
    if (performance.now() - this.lastDrag > 5000) {
      // Lean toward stalking predators so the player can see them coming.
      const stalk = this.game.state && this.game.state.threats.find((t) => t.type !== 'poachers');
      const focus = stalk ? this.anchor[0] + stalk.side * 0.12 : this.anchor[0];
      const target = this.camTarget != null ? this.camTarget : clamp(focus * this.worldW - W / 2, 0, this.worldW - W);
      this.cam = lerp(this.cam, target, Math.min(1, dt * 1.2));
      if (this.camTarget != null && Math.abs(this.cam - this.camTarget) < 2) this.camTarget = null;
    } else this.camTarget = null;

    // Sky
    const top = mixRgb(skyTop, [90, 98, 110], rainDim);
    const bot = mixRgb(skyBot, [140, 144, 150], rainDim);
    const sg = ctx.createLinearGradient(0, 0, 0, this.horizon);
    sg.addColorStop(0, rgb(top));
    sg.addColorStop(1, rgb(bot));
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, this.horizon + 2);

    this.drawStars(1 - light, weather);
    this.drawSunMoon(now, elev, light);
    this.drawClouds(light, weather, bot);
    this.drawKilimanjaro(light, bot, green, elev);

    // Ground
    const dry = [H2('#d2ad72'), H2('#a67b47')];
    const lush = [H2('#a7c46a'), H2('#5d8a3a')];
    const gFar = mixRgb(dry[0], lush[0], green);
    const gNear = mixRgb(dry[1], lush[1], green);
    const gg = ctx.createLinearGradient(0, this.horizon, 0, H);
    gg.addColorStop(0, rgb(mixRgb(gFar, bot, 0.35)));
    gg.addColorStop(0.25, rgb(gFar));
    gg.addColorStop(1, rgb(gNear));
    ctx.fillStyle = gg;
    ctx.fillRect(0, this.horizon, W, H - this.horizon);

    this.drawTreeLine(green, bot);
    this.drawWaterhole(top, bot, weather);
    this.drawTufts(green, false);

    // Depth-sorted entities
    const items = [];
    for (const tr of this.trees) items.push({ d: tr.d, draw: () => this.drawTreeAt(tr, green) });
    if (this.game.state) {
      for (const e of this.game.herd) {
        const v = this.vis.get(e.id);
        if (!v || v.hidden) continue;
        items.push({ d: v.y, draw: () => this.drawElephantAt(e, v, now) });
      }
      this.collectPredators(items, now);
    }
    this.collectEgrets(items, now);
    if (this.rangers) {
      this.rangers.life += dt;
      this.rangers.x += this.rangers.dir * dt * 0.12;
      const rr = this.rangers;
      items.push({ d: 0.9, draw: () => drawTruck(ctx, this.sx(rr.x), this.sy(0.9), this.scale(0.9) * 1.2, rr.dir, this.t, 'rangers') });
      if (rr.life > 14) this.rangers = null;
    }
    items.sort((a, b) => a.d - b.d).forEach((i) => i.draw());

    this.drawTufts(green, true);
    this.drawParticles(dt);

    // Lighting overlays
    const night = 1 - light;
    if (night > 0) {
      ctx.fillStyle = `rgba(10,18,52,${night * 0.5})`;
      ctx.fillRect(0, this.horizon - 2, W, H);
    }
    const warm = Math.max(0, 1 - Math.abs(elev - 3) / 9);
    if (warm > 0) {
      ctx.fillStyle = `rgba(255,120,40,${warm * 0.12})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (weather.raining) this.drawRain(dt);
    else if (green < 0.35 && light > 0.5) this.drawDust();

    this.drawIndicators();

    // Vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  drawStars(night, weather) {
    if (night < 0.2) return;
    const ctx = this.ctx;
    const a = Math.pow(night, 2) * (1 - weather.cloud * 0.8);
    for (const [x, y, r, ph] of this.stars) {
      const tw = 0.6 + 0.4 * Math.sin(this.t * 2 + ph * 3);
      ctx.fillStyle = `rgba(255,255,240,${a * tw})`;
      ctx.beginPath();
      ctx.arc(((x * this.W * 1.3 - this.cam * 0.05) % (this.W + 20)), y * this.horizon, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Milky way smear
    const g = this.ctx.createLinearGradient(0, 0, this.W, this.horizon);
    g.addColorStop(0.3, 'rgba(200,210,255,0)');
    g.addColorStop(0.5, `rgba(200,210,255,${0.07 * a})`);
    g.addColorStop(0.7, 'rgba(200,210,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.horizon);
  }

  drawSunMoon(now, elev, light) {
    const ctx = this.ctx;
    const { rise, set } = this.env.sunTimes(now);
    const h = this.env.hour(now);
    const frac = (h - rise) / (set - rise);
    if (elev > -8) {
      const x = this.W * (0.08 + 0.84 * clamp(frac, -0.05, 1.05));
      const y = this.horizon - (elev / 75) * this.horizon * 0.95;
      const rad = 16 * this.base;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, rad * 7);
      const warm = elev < 10 ? 1 : 0;
      glow.addColorStop(0, warm ? 'rgba(255,190,120,0.55)' : 'rgba(255,250,220,0.5)');
      glow.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - rad * 7, y - rad * 7, rad * 14, rad * 14);
      ctx.fillStyle = warm ? '#ffd2a0' : '#fffbe8';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    // Moon: transits around noon at new moon, midnight at full moon.
    const p = this.env.moonPhase(now);
    const transit = (12 + p * 24) % 24;
    let dh = h - transit;
    if (dh > 12) dh -= 24;
    if (dh < -12) dh += 24;
    const mElev = 85 * Math.cos((dh / 12.4) * Math.PI);
    if (mElev > 0 && p > 0.03 && p < 0.97) {
      const x = this.W * (0.5 + (dh / 6.2) * 0.42);
      const y = this.horizon - (mElev / 90) * this.horizon * 0.85;
      const r = 11 * this.base;
      const vis = 0.35 + 0.65 * (1 - light);
      ctx.save();
      ctx.globalAlpha = vis;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      glow.addColorStop(0, 'rgba(220,230,255,0.35)');
      glow.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      ctx.fillStyle = 'rgba(40,48,80,0.6)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#eef0ff';
      const k = Math.cos(p * Math.PI * 2);
      const waxing = p < 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
      ctx.ellipse(x, y, Math.max(0.01, r * Math.abs(k)), r, 0, Math.PI / 2, -Math.PI / 2, waxing ? k > 0 : k < 0);
      ctx.fill();
      ctx.restore();
    }
  }

  drawClouds(light, weather, bot) {
    const ctx = this.ctx;
    const n = Math.round(2 + weather.cloud * 8);
    const lit = mixRgb([70, 80, 110], [255, 255, 255], light);
    const col = mixRgb(mixRgb(lit, bot, 0.3), [120, 124, 134], weather.raining ? 0.6 : 0);
    for (let i = 0; i < n && i < this.clouds.length; i++) {
      const c = this.clouds[i];
      const x = (((c.x + this.t * c.sp * 0.3) % 1.4) - 0.2) * this.W - this.cam * 0.04;
      const y = c.y * this.horizon;
      const s = c.s * this.base * (weather.raining ? 1.3 : 1);
      ctx.fillStyle = rgb(col, 0.75 * (0.5 + weather.cloud * 0.5));
      ctx.beginPath();
      ctx.ellipse(x, y, 46 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 22 * s, y + 2 * s, 26 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 14 * s, y - 7 * s, 26 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawKilimanjaro(light, bot, green, elev) {
    const ctx = this.ctx;
    const W = this.W;
    const hz = this.horizon;
    const mw = Math.max(W * 1.05, 520 * this.base);
    const cx = W * 0.56 - (this.cam / Math.max(1, this.worldW - W)) * W * 0.08;
    const mh = hz * 0.46;
    const baseCol = mixRgb([70, 86, 120], bot, 0.45);
    const col = mixRgb(mixRgb(baseCol, [20, 26, 48], 1 - light), bot, 0.15);
    ctx.fillStyle = rgb(col);
    ctx.beginPath();
    ctx.moveTo(cx - mw * 0.75, hz + 1);
    ctx.bezierCurveTo(cx - mw * 0.45, hz - mh * 0.15, cx - mw * 0.33, hz - mh * 0.55, cx - mw * 0.3, hz - mh * 0.6);
    // Mawenzi's jagged peak (left, east)
    ctx.lineTo(cx - mw * 0.27, hz - mh * 0.72);
    ctx.lineTo(cx - mw * 0.25, hz - mh * 0.64);
    ctx.lineTo(cx - mw * 0.23, hz - mh * 0.76);
    ctx.lineTo(cx - mw * 0.2, hz - mh * 0.66);
    ctx.bezierCurveTo(cx - mw * 0.15, hz - mh * 0.72, cx - mw * 0.1, hz - mh * 0.92, cx - mw * 0.06, hz - mh);
    // Kibo's broad flat summit
    ctx.lineTo(cx + mw * 0.07, hz - mh * 1.01);
    ctx.bezierCurveTo(cx + mw * 0.14, hz - mh * 0.9, cx + mw * 0.3, hz - mh * 0.5, cx + mw * 0.55, hz - mh * 0.18);
    ctx.lineTo(cx + mw * 0.8, hz + 1);
    ctx.closePath();
    ctx.fill();

    // Snow cap, a little fuller after the rains.
    const snow = 0.55 + green * 0.45;
    const snowCol = mixRgb(mixRgb([245, 248, 255], [255, 190, 170], Math.max(0, 1 - Math.abs(elev - 3) / 10)), [60, 70, 100], 1 - light);
    ctx.fillStyle = rgb(snowCol, 0.95);
    ctx.beginPath();
    ctx.moveTo(cx - mw * 0.06, hz - mh);
    ctx.lineTo(cx + mw * 0.07, hz - mh * 1.01);
    ctx.lineTo(cx + mw * (0.1 + 0.03 * snow), hz - mh * (0.93 - 0.07 * snow));
    for (let i = 0; i <= 8; i++) {
      const fx = cx + mw * (0.1 + 0.03 * snow) - (i / 8) * mw * (0.2 + 0.05 * snow);
      const fy = hz - mh * (0.88 - 0.1 * snow) + (i % 2 ? 4 : -3) * this.base;
      ctx.lineTo(fx, fy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - mw * 0.235, hz - mh * 0.75);
    ctx.lineTo(cx - mw * 0.225, hz - mh * 0.7);
    ctx.lineTo(cx - mw * 0.24, hz - mh * 0.71);
    ctx.fill();

    // Cloud belt around the mountain's waist
    const belt = mixRgb(mixRgb([255, 255, 255], bot, 0.4), [40, 46, 70], 1 - light);
    ctx.fillStyle = rgb(belt, 0.5);
    for (let i = 0; i < 6; i++) {
      const x = cx - mw * 0.35 + i * mw * 0.13 + Math.sin(this.t * 0.05 + i) * 8;
      ctx.beginPath();
      ctx.ellipse(x, hz - mh * 0.42, mw * 0.09, mh * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Atmospheric haze at the base
    const hg = ctx.createLinearGradient(0, hz - mh * 0.4, 0, hz);
    hg.addColorStop(0, rgb(bot, 0));
    hg.addColorStop(1, rgb(bot, 0.6));
    ctx.fillStyle = hg;
    ctx.fillRect(0, hz - mh * 0.4, W, mh * 0.4 + 1);
  }

  drawTreeLine(green, bot) {
    const ctx = this.ctx;
    const col = mixRgb(mixRgb([120, 110, 70], [70, 100, 60], green), bot, 0.45);
    ctx.fillStyle = rgb(col);
    const off = this.cam * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, this.horizon + 6);
    for (let x = -20; x <= this.W + 20; x += 14) {
      const wx = x + off;
      const hh = 3 + Math.abs(Math.sin(wx * 0.021) * 5 + Math.sin(wx * 0.07) * 2);
      ctx.lineTo(x, this.horizon + 6 - hh * this.base);
    }
    ctx.lineTo(this.W, this.horizon + 8);
    ctx.lineTo(0, this.horizon + 8);
    ctx.fill();
  }

  drawWaterhole(top, bot, weather) {
    const ctx = this.ctx;
    const lvl = this.game.state ? this.game.state.waterhole : 70;
    const d = 0.24;
    const x = this.sx(0.78);
    const y = this.sy(d);
    const rx = (50 + lvl * 1.3) * this.base;
    const ry = rx * 0.2;
    ctx.fillStyle = 'rgba(80,62,40,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 1.12, ry * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    const wg = ctx.createLinearGradient(0, y - ry, 0, y + ry);
    wg.addColorStop(0, rgb(mixRgb(bot, [60, 90, 110], 0.3)));
    wg.addColorStop(1, rgb(mixRgb(top, [40, 70, 90], 0.4)));
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    const drinking = this.game.state && this.game.state.activity && this.game.state.activity.type === 'drink';
    const n = weather.raining ? 7 : drinking ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const f = ((this.t * 0.4 + i / n) % 1);
      const px = x + Math.sin(i * 7.3) * rx * 0.6;
      const py = y + Math.cos(i * 3.1) * ry * 0.5;
      ctx.globalAlpha = 1 - f;
      ctx.beginPath();
      ctx.ellipse(px, py, 3 + f * 18 * this.base, (3 + f * 18 * this.base) * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Reeds of the swamp edge
    ctx.strokeStyle = 'rgba(70,110,50,0.9)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const px = x + Math.cos(a) * rx * 1.05;
      const py = y + Math.sin(a) * ry * 1.1;
      const hh = (6 + (i % 4) * 3) * this.base;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + 2, py - hh * 0.6, px + Math.sin(this.t + i) * 2, py - hh);
      ctx.stroke();
    }
  }

  drawTufts(green, fg) {
    const ctx = this.ctx;
    const col = rgb(mixRgb([176, 140, 80], [86, 130, 52], green));
    const col2 = rgb(mixRgb([150, 112, 60], [64, 104, 40], green));
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    if (fg) {
      // Tall foreground grass along the bottom edge, with slight parallax.
      const off = this.cam * 1.15;
      for (let i = 0; i < 70; i++) {
        const x = ((i * 37.3 - off) % (this.W + 40) + this.W + 40) % (this.W + 40) - 20;
        const y = this.H + 2;
        const hh = (22 + (i * 13) % 26) * this.base;
        const sw = Math.sin(this.t * 1.3 + i * 0.7) * 5;
        ctx.strokeStyle = i % 2 ? col : col2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + sw * 0.4, y - hh * 0.6, x + sw, y - hh);
        ctx.stroke();
      }
      return;
    }
    for (const t of this.tufts) {
      const x = this.sx(t.x);
      if (x < -10 || x > this.W + 10) continue;
      const y = this.sy(t.d);
      const s = this.scale(t.d);
      ctx.strokeStyle = t.ph > 3 ? col : col2;
      for (let k = -2; k <= 2; k++) {
        const sw = Math.sin(this.t * 1.5 + t.ph) * 1.5;
        ctx.beginPath();
        ctx.moveTo(x + k * 1.5 * s, y);
        ctx.lineTo(x + k * 3 * s + sw, y - t.h * s * (1 - Math.abs(k) * 0.15));
        ctx.stroke();
      }
    }
  }

  drawTreeAt(tr, green) {
    const x = this.sx(tr.x);
    if (x < -80 || x > this.W + 80) return;
    const col = tr.kind === 'fever' ? rgb(mixRgb([150, 150, 70], [110, 150, 60], green)) : rgb(mixRgb([88, 90, 50], [52, 88, 40], green));
    const trunk = tr.kind === 'fever' ? '#c9c16a' : '#4a3a2a';
    drawTree(this.ctx, x, this.sy(tr.d), this.scale(Math.max(0, tr.d)) * tr.s * 1.2, tr.kind, col, trunk, this.t);
  }

  drawElephantAt(e, v, now) {
    const x = this.sx(v.x);
    if (x < -120 || x > this.W + 120) return;
    const y = this.sy(v.y);
    const age = ageOf(e, now);
    const night = this.env.isNight(now);
    const act = this.game.state.activity;
    drawElephant(this.ctx, {
      x, y, s: this.scale(v.y), dir: v.dir, t: this.t, phase: v.phase, moving: v.moving,
      age, sex: e.sex, tone: e.tone, tuskless: e.tuskless, seed: v.seed,
      mud: act && act.type === 'drink' ? 0.6 : this.env.greenness(now) < 0.3 ? 0.25 : 0,
      trumpet: v.trumpet > 0, selected: this.selected === e.id, sleep: night && !v.moving && age < 6,
    });
    // Status markers
    const s = this.scale(v.y) * sizeFor(age, e.sex);
    if (e.status === 'wandering') {
      this.marker(x, y - 72 * s - 8, '!', '#ff7a59');
    } else if (e.hurtUntil && e.hurtUntil > now && e.health < 90) {
      this.marker(x, y - 70 * s - 8, '+', '#ff9fb0', 0.8);
    }
    if (e.newborn) this.marker(x, y - 64 * s - 8, '♥', '#ffb4c8', 0.9);
  }

  marker(x, y, glyph, color, scale = 1) {
    const ctx = this.ctx;
    const r = 9 * scale * Math.max(0.9, this.base);
    const bob = Math.sin(this.t * 4) * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y + bob, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${r * 1.3}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x, y + bob + 0.5);
  }

  collectPredators(items, now) {
    const ctx = this.ctx;
    const night = this.env.isNight(now);
    for (const th of this.game.state.threats) {
      const ps = this.predatorPositions(th, this.t);
      for (const p of ps) {
        const d = p.d;
        items.push({
          d,
          draw: () => {
            const x = this.sx(p.x);
            const y = this.sy(Math.max(0, d));
            const s = this.scale(Math.max(0, d)) * 1.1;
            const dir = -th.side;
            if (th.type === 'lions') drawLion(ctx, x, y, s, dir, this.t + p.i, night, 1);
            else if (th.type === 'hyenas') drawHyena(ctx, x, y, s, dir, this.t + p.i, night);
            else {
              drawTruck(ctx, x, this.horizon + 12, this.scale(0) * 0.9, dir, this.t, 'poachers');
              ctx.fillStyle = 'rgba(200,170,120,0.25)';
              for (let k = 1; k < 6; k++) {
                ctx.beginPath();
                ctx.arc(x - dir * k * 10 * this.base, this.horizon + 8 - k * 2, 5 + k * 2, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          },
        });
      }
    }
    this.fleeing = this.fleeing.filter((f) => (f.life += 1 / 60) < 3);
    for (const f of this.fleeing) {
      f.x += f.dir * 0.004;
      items.push({
        d: f.d,
        draw: () => {
          const x = this.sx(f.x);
          const y = this.sy(Math.max(0, f.d));
          const s = this.scale(Math.max(0, f.d)) * 1.1;
          if (f.type === 'lions') drawLion(ctx, x, y, s, f.dir, this.t * 2, night, 0);
          else if (f.type === 'hyenas') drawHyena(ctx, x, y, s, f.dir, this.t * 2, night);
          else drawTruck(ctx, x, this.horizon + 12, this.scale(0) * 0.9, f.dir, this.t, 'poachers');
        },
      });
    }
  }

  collectEgrets(items, now) {
    if (!this.game.state) return;
    const present = this.game.herd.filter((e) => e.status === 'herd');
    if (!present.length) return;
    const night = this.env.isNight(now);
    if (night) return;
    for (const b of this.egrets) {
      const e = present[b.idx % present.length];
      const v = this.vis.get(e.id);
      if (!v || v.hidden) continue;
      const s = this.scale(v.y);
      const x = this.sx(v.x) + b.off * s + v.dir * 20 * s;
      const y = this.sy(v.y) + 3;
      const fly = v.moving && Math.sin(this.t * 0.5 + b.idx) > 0.7;
      items.push({ d: v.y + 0.001, draw: () => drawEgret(this.ctx, x, fly ? y - 30 * s - Math.sin(this.t * 3 + b.idx) * 5 : y, s * 0.9, v.dir, this.t + b.idx, fly) });
    }
  }

  drawParticles(dt) {
    const ctx = this.ctx;
    this.particles = this.particles.filter((p) => (p.life += dt) < p.max + (p.delay || 0));
    for (const p of this.particles) {
      const lt = p.life - (p.delay || 0);
      if (lt < 0) continue;
      const x = this.sx(p.wx) + p.vx * lt;
      const y = this.sy(p.d) + p.oy + p.vy * lt + (p.type === 'spark' ? 40 * lt * lt : 0);
      const a = 1 - lt / p.max;
      if (p.type === 'heart') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(x + Math.sin(lt * 5) * 4, y);
        const s = p.size / 10;
        ctx.scale(s, s);
        ctx.fillStyle = '#ff6b8b';
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.bezierCurveTo(-8, -3, -5, -10, 0, -5);
        ctx.bezierCurveTo(5, -10, 8, -3, 0, 3);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawRain(dt) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(200,215,235,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const r of this.rain) {
      r[1] += dt * r[2] * 1.6;
      if (r[1] > 1) {
        r[1] -= 1;
        r[0] = Math.random();
      }
      const x = r[0] * this.W;
      const y = r[1] * this.H;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 14 * r[2]);
    }
    ctx.stroke();
  }

  drawDust() {
    const ctx = this.ctx;
    for (let i = 0; i < 24; i++) {
      const x = ((i * 97.3 + this.t * (8 + (i % 5) * 3)) % (this.W + 40)) - 20;
      const y = this.horizon + ((i * 53.7) % (this.H - this.horizon)) + Math.sin(this.t + i) * 6;
      ctx.fillStyle = `rgba(255,230,180,${0.12 + 0.08 * Math.sin(this.t * 2 + i)})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Arrows at the screen edge pointing to wanderers who are off-screen.
  drawIndicators() {
    this.hotspots = [];
    if (!this.game.state) return;
    const ctx = this.ctx;
    for (const e of this.game.herd) {
      if (e.status !== 'wandering') continue;
      const v = this.vis.get(e.id);
      if (!v) continue;
      const x = this.sx(v.x);
      if (x > 10 && x < this.W - 10) continue;
      const left = x <= 10;
      const px = left ? 34 : this.W - 34;
      const py = clamp(this.sy(v.y) - 30, this.horizon + 30, this.groundBottom - 20);
      const left01 = clamp((e.wanderDeadline - Date.now()) / (e.wanderDeadline - e.wanderStart), 0, 1);
      ctx.save();
      ctx.fillStyle = 'rgba(20,16,30,0.72)';
      ctx.beginPath();
      ctx.arc(px, py, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = left01 < 0.3 ? '#ff5a5a' : '#ffb35c';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(px, py, 24, -Math.PI / 2, -Math.PI / 2 + left01 * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      const ax = left ? px - 30 : px + 30;
      ctx.moveTo(ax, py);
      ctx.lineTo(ax + (left ? 8 : -8), py - 7);
      ctx.lineTo(ax + (left ? 8 : -8), py + 7);
      ctx.fill();
      ctx.font = '800 11px Nunito, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.name.length > 7 ? e.name.slice(0, 6) + '…' : e.name, px, py - 1);
      ctx.font = '700 9px Nunito, system-ui, sans-serif';
      ctx.fillStyle = '#ffd0a0';
      ctx.fillText('call', px, py + 10);
      ctx.restore();
      this.hotspots.push({ x: px, y: py, r: 30, id: e.id });
    }
  }
}

function smoothIn(t) {
  return t * t * (3 - 2 * t);
}

export async function portrait(e, age, size = 96) {
  const c = document.createElement('canvas');
  const dpr = 2;
  c.width = size * dpr;
  c.height = size * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  // Frame on the face: map the head/shoulder area to the centre of the image.
  const sz = sizeFor(age, e.sex);
  const total = size / 84;
  const cx = age < 4 ? 14 : 10;
  drawElephant(ctx, { x: size * 0.5 - cx * total, y: size * 0.5 + 34 * total, s: total / sz, dir: 1, t: 1, phase: 0, moving: false, age, sex: e.sex, tone: e.tone, tuskless: e.tuskless, seed: 1 });
  return c.toDataURL();
}
