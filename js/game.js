// Core simulation: resources, wellbeing, events, threats, births and deaths.
import { HERD_SIZE, THREAT_INFO } from './config.js';
import { MIN, HOUR, DAY, YEAR, clamp, rand, pick, uid, fmtDuration } from './util.js';
import { createHerd, makeCalf, ageOf, pronouns } from './herd.js';

const STEP = 10 * MIN; // simulation sub-step for large time jumps

export class Game {
  constructor(env, settings) {
    this.env = env;
    this.settings = settings;
    this.state = null;
    this.listeners = {};
    this.awayReport = [];
    this.awayLosses = 0;
  }

  on(name, fn) {
    (this.listeners[name] ||= []).push(fn);
  }
  emit(name, data) {
    (this.listeners[name] || []).forEach((fn) => fn(data));
  }

  // ---------- lifecycle ----------

  newGame(playNumber) {
    const now = this.env.now();
    this.state = {
      id: uid(),
      play: playNumber,
      startedAt: now,
      startedReal: Date.now(),
      lastTick: now,
      herd: createHerd(now),
      water: 82,
      forage: 78,
      waterhole: 70,
      activity: null,
      threats: [],
      rangersReadyAt: 0,
      droughtUntil: 0,
      nextEventAt: now + rand(4, 9) * MIN / this.settings.eventRate,
      log: [],
      stats: { repelled: 0, returned: 0, births: 0, pets: 0, lost: 0 },
      over: false,
    };
    this.log('Your journey begins. 37 elephants are in your care.', 'good');
    return this.state;
  }

  load(state) {
    this.state = state;
  }

  get herd() {
    return this.state.herd;
  }

  alive() {
    return this.herd.filter((e) => e.status !== 'dead');
  }
  present() {
    return this.herd.filter((e) => e.status === 'herd');
  }
  byId(id) {
    return this.herd.find((e) => e.id === id);
  }

  log(text, kind = 'info', data) {
    const entry = { t: this.env.now(), text, kind, ...data };
    this.state.log.unshift(entry);
    if (this.state.log.length > 250) this.state.log.length = 250;
    if (!this.catchingUp) this.emit('log', entry);
    else this.awayReport.push(entry);
    return entry;
  }

  avgHappiness() {
    const a = this.present();
    return a.length ? a.reduce((s, e) => s + e.happiness, 0) / a.length : 0;
  }

  // ---------- time ----------

  // Called every second while the game is open.
  tick() {
    const s = this.state;
    if (!s || s.over) return;
    const now = this.env.now();
    let dt = now - s.lastTick;
    if (dt <= 0) return;

    // Long gaps (app closed, or a big Dev Mode jump) are simulated in steps.
    const offline = dt > 3 * MIN && this.settings.timeSpeed <= 1;
    if (dt > 3 * MIN) {
      this.catchUp(now, offline);
    } else {
      this.advance(dt, now, false);
    }
    s.lastTick = now;
    this.tickRealtime();
  }

  catchUp(now, offline) {
    const s = this.state;
    this.catchingUp = true;
    this.awayReport = [];
    this.awayLosses = 0;
    this.awayOffline = offline;
    const from = s.lastTick;
    let t = s.lastTick;
    // Resolve anything that was pending when the player left.
    if (offline) this.resolvePendingAsAbsent();
    while (t < now && !s.over) {
      const dt = Math.min(STEP, now - t);
      t += dt;
      this.advance(dt, t, offline);
    }
    this.catchingUp = false;
    if (offline && now - from > 20 * MIN) {
      this.emit('away', { duration: now - from, entries: this.awayReport.slice() });
    } else {
      this.awayReport.forEach((e) => this.emit('log', e));
    }
    this.awayReport = [];
  }

  // Advance the world by dt (game ms), ending at time `now`.
  advance(dt, now, offline) {
    const s = this.state;
    const env = this.env;
    const h = dt / HOUR;
    const season = env.season(now);
    const weather = env.weather(now);
    const hour = env.hour(now);
    const night = env.isNight(now);
    const heat = hour >= 11 && hour < 16 ? 1.5 : night ? 0.5 : 1;
    const drought = now < s.droughtUntil ? 1.6 : 1;
    const k = this.settings.decayRate;

    // Herd-wide thirst and hunger.
    s.water -= 5 * season.water * heat * drought * k * h;
    s.forage -= 3.5 * season.forage * (night ? 0.6 : 1) * k * h;
    s.waterhole += (season.waterhole * (drought > 1 ? 1.5 : 1)) * h;
    if (weather.raining) {
      s.water += 8 * h;
      s.waterhole += 6 * h;
    }
    if (offline) {
      // While you're away the matriarchs lead the herd to water and food themselves.
      const leader = this.present().some((e) => ageOf(e, now) > 40 && e.sex === 'F');
      const floor = leader ? 40 : 25;
      s.water = Math.max(s.water, floor);
      s.forage = Math.max(s.forage, floor);
    }
    s.water = clamp(s.water, 0, 100);
    s.forage = clamp(s.forage, 0, 100);
    s.waterhole = clamp(s.waterhole, 12, 100);

    const safety = s.threats.length ? -18 : 6;
    const green = env.greenness(now);

    for (const e of this.herd) {
      if (e.status === 'dead') continue;
      const age = ageOf(e, now);
      const prevAge = ageOf(e, now - dt);
      if (Math.floor(age) > Math.floor(prevAge) && Math.floor(age) >= 1) {
        e.happiness = clamp(e.happiness + 10, 0, 100);
        this.log(`Happy birthday, ${e.name}! ${pronouns(e).sub[0].toUpperCase() + pronouns(e).sub.slice(1)} is ${Math.floor(age)} today.`, 'birthday', { id: e.id });
      }
      if (e.newborn && age > 0.1) delete e.newborn;

      const maxHealth = age > 55 ? clamp(100 - (age - 55) * 4, 30, 100) : 100;
      if (e.status === 'herd') {
        let dh = 2.5;
        if (s.water < 15) dh -= 6;
        if (s.forage < 15) dh -= 4;
        e.health = clamp(e.health + dh * h, 0, maxHealth);
        const bondBoost = e.bond * 0.08;
        const target = clamp(18 + s.water * 0.28 + s.forage * 0.22 + safety + bondBoost + green * 8 + (weather.raining ? 4 : 0), 0, 100);
        e.happiness += (target - e.happiness) * Math.min(1, 0.12 * h);
        if (e.grief) {
          e.grief = Math.max(0, e.grief - 3 * h);
          e.happiness = Math.min(e.happiness, 100 - e.grief);
        }
      } else if (e.status === 'wandering' || e.status === 'lost') {
        e.health = clamp(e.health - (age < 5 ? 3 : 1.2) * h, 0, maxHealth);
        e.happiness = clamp(e.happiness - 4 * h, 0, 100);
      }
      e.happiness = clamp(e.happiness, 0, 100);

      if (e.health <= 0) {
        this.kill(e, s.water < 15 ? 'thirst' : s.forage < 15 ? 'hunger' : 'weakness');
        continue;
      }
      // Very old elephants may pass peacefully.
      if (age > 62 && Math.random() < 0.02 * (dt / DAY)) {
        this.kill(e, 'old age');
        continue;
      }
      if (e.status === 'lost') this.updateLost(e, now, dt);
    }

    // Scheduled events.
    let guard = 0;
    while (now >= s.nextEventAt && !s.over && guard++ < 20) {
      this.randomEvent(s.nextEventAt, offline);
      const base = rand(20, 50) * MIN;
      s.nextEventAt += base / Math.max(0.05, this.settings.eventRate);
    }
    if (s.nextEventAt < now - DAY) s.nextEventAt = now + 10 * MIN;
  }

  // Real-time mechanics: threat countdowns, wanderers, activities.
  tickRealtime() {
    const s = this.state;
    const real = Date.now();
    for (const t of [...s.threats]) {
      if (real >= t.deadline) this.threatFails(t, false);
    }
    for (const e of this.herd) {
      if (e.status === 'wandering' && real >= e.wanderDeadline) {
        e.status = 'lost';
        e.lostAt = this.env.now();
        s.stats.lost++;
        this.log(`${e.name} has wandered out of sight. ${pronouns(e).sub[0].toUpperCase() + pronouns(e).sub.slice(1)} is lost somewhere on the plains.`, 'bad', { id: e.id });
        this.emit('lost', e);
      }
    }
    if (s.activity) {
      const a = s.activity;
      const f = clamp((real - a.start) / (a.until - a.start), 0, 1);
      if (a.type === 'drink') s.water = Math.max(s.water, a.from + (a.to - a.from) * f);
      if (a.type === 'graze') s.forage = Math.max(s.forage, a.from + (a.to - a.from) * f);
      if (a.type === 'gather' && f > 0.08 && !a.resolved) {
        a.resolved = true;
        this.resolveByGather();
      }
      if (real >= a.until) {
        if (a.type === 'drink') this.log(a.to < 95 ? 'The herd drank what the low waterhole could give.' : 'The herd has drunk its fill.', 'good');
        if (a.type === 'graze') this.log(a.to < 90 ? 'Slim pickings, but the herd has grazed.' : 'Bellies full of sweet grass.', 'good');
        s.activity = null;
        this.emit('activity', null);
      }
    }
  }

  // ---------- events ----------

  randomEvent(at, offline) {
    const s = this.state;
    const env = this.env;
    const night = env.isNight(at);
    const period = env.period(at);
    const key = env.seasonKey(at);
    const dry = key === 'long-dry' || key === 'short-dry';
    const alive = this.present();
    if (!alive.length) return;
    const young = alive.filter((e) => ageOf(e, at) < 8);

    // Relative weights. While you're away the matriarchs steer clear of most danger.
    const away = offline ? 0.2 : 1;
    const w = {
      wander: 2.4 * (night ? 0.4 : 1) * away,
      lions: young.length ? 0.55 * (night ? 2.4 : period === 'dusk' || period === 'dawn' ? 1.5 : 0.3) * away : 0,
      hyenas: young.length ? 0.4 * (night ? 2 : 0.3) * away : 0,
      poachers: 0.18 * (dry ? 1.3 : 1) * away,
      drought: dry && at > s.droughtUntil ? 0.25 : 0,
      thorn: 0.5,
      birth: this.settings.birthsEnabled && this.alive().length < HERD_SIZE && this.avgHappiness() > 60 ? 0.03 : 0,
      joy: 3.2,
    };
    // Don't stack the same kind of threat.
    for (const t of s.threats) w[t.type] = 0;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let kind = 'joy';
    for (const [k, v] of Object.entries(w)) {
      if ((r -= v) <= 0) {
        kind = k;
        break;
      }
    }

    return this.runEvent(kind, at, offline);
  }

  runEvent(kind, at, offline) {
    const s = this.state;
    const alive = this.present();
    if (!alive.length) return;
    switch (kind) {
      case 'wander':
        return this.startWander(null, offline);
      case 'lions':
      case 'hyenas':
      case 'poachers':
        return this.startThreat(kind, offline);
      case 'drought':
        s.droughtUntil = at + rand(1, 2.5) * DAY;
        s.waterhole = Math.max(12, s.waterhole - 15);
        return this.log('A hot, dry wind has set in. The waterhole is shrinking and the herd will be thirstier.', 'warn');
      case 'thorn': {
        const e = pick(alive);
        e.health = clamp(e.health - 25, 1, 100);
        e.happiness = clamp(e.happiness - 15, 0, 100);
        e.hurtUntil = at + 6 * HOUR;
        return this.log(`${e.name} is limping — a thorn in ${pronouns(e).pos} foot. A little comfort will help.`, 'warn', { id: e.id });
      }
      case 'birth':
        return this.birth(at);
      default: {
        const lines = [
          'The calves have invented a game: charge the egrets, then flee from them.',
          'The whole herd rumbles in greeting as two families meet again.',
          'A long mud bath. Everyone comes out the same colour.',
          'The adults stand in a loose circle, dozing in the heat.',
          'A family of warthogs trots past, tails up. The calves are fascinated.',
          'Kilimanjaro shows its snowy head above the clouds.',
        ];
        alive.forEach((e) => (e.happiness = clamp(e.happiness + 3, 0, 100)));
        return this.log(pick(lines), 'joy');
      }
    }
  }

  startWander(id, offline) {
    const s = this.state;
    const now = this.env.now();
    const candidates = this.present().filter((e) => {
      const a = ageOf(e, now);
      return a > 2 && !(a > 40 && e.sex === 'F');
    });
    if (!candidates.length) return;
    // Curious, restless and young bulls are more likely to wander.
    const e = id ? this.byId(id) : weightedPick(candidates, (c) => (['curious', 'restless', 'bold', 'dreamy'].includes(c.trait) ? 3 : 1) * (c.sex === 'M' && ageOf(c, now) > 10 ? 2 : 1));
    if (!e || e.status !== 'herd') return;
    if (offline) {
      if (Math.random() < 0.6) {
        this.log(`${e.name} wandered off for a while, then found ${pronouns(e).pos} way back.`, 'info', { id: e.id });
      } else {
        e.status = 'lost';
        e.lostAt = now;
        s.stats.lost++;
        this.log(`${e.name} wandered off and hasn’t come back. Rangers could help find ${pronouns(e).obj}.`, 'bad', { id: e.id });
      }
      return;
    }
    e.status = 'wandering';
    e.wanderStart = Date.now();
    e.wanderDeadline = Date.now() + this.settings.wanderGraceMin * MIN;
    e.wanderSide = Math.random() < 0.5 ? -1 : 1;
    this.log(`${e.name} is wandering away from the herd! Tap ${pronouns(e).obj} and call ${pronouns(e).obj} back.`, 'alert', { id: e.id });
    this.emit('wander', e);
  }

  startThreat(type, offline) {
    const s = this.state;
    const now = this.env.now();
    const alive = this.present();
    let targets;
    if (type === 'poachers') {
      targets = alive.filter((e) => ageOf(e, now) > 12 && !e.tuskless);
      targets.sort((a, b) => tuskScore(b, now) - tuskScore(a, now));
      targets = targets.slice(0, 5);
    } else {
      targets = alive.filter((e) => ageOf(e, now) < 8);
    }
    if (!targets.length) return;
    const threat = {
      id: uid(),
      type,
      start: Date.now(),
      deadline: Date.now() + this.settings.threatWindowSec * 1000,
      side: Math.random() < 0.5 ? -1 : 1,
      targetId: pick(targets).id,
      at: now,
    };
    if (offline) {
      this.threatFails(threat, true);
      return;
    }
    s.threats.push(threat);
    this.log(`${THREAT_INFO[type].title}! ${THREAT_INFO[type].body}`, 'alert', { threat: type });
    this.emit('threat', threat);
  }

  threatFails(threat, offline) {
    const s = this.state;
    s.threats = s.threats.filter((t) => t.id !== threat.id);
    const info = THREAT_INFO[threat.type];
    const now = this.env.now();
    let e = this.byId(threat.targetId);
    if (!e || e.status !== 'herd') e = this.present()[0];
    if (!e) return;
    const matriarch = this.present().some((x) => ageOf(x, now) > 45 && x.sex === 'F');
    let lethal = info.lethal * this.settings.lethality * (matriarch ? 0.8 : 1);
    if (offline) {
      // The herd defends itself while you're away, and losses are capped.
      lethal *= 0.25;
      if (this.awayLosses >= this.settings.offlineLossCap) lethal = 0;
    }
    if (this.settings.godMode) lethal = 0;
    if (Math.random() < lethal) {
      if (offline) this.awayLosses = (this.awayLosses || 0) + 1;
      const cause = { lions: 'lions', hyenas: 'hyenas', poachers: 'poachers' }[threat.type];
      this.kill(e, cause);
    } else {
      e.health = clamp(e.health - 30, 5, 100);
      e.hurtUntil = now + 8 * HOUR;
      this.present().forEach((x) => (x.happiness = clamp(x.happiness - 8, 0, 100)));
      const what = {
        lions: `The lions struck, but the herd drove them off. ${e.name} is hurt.`,
        hyenas: `The hyenas got close before the adults charged. ${e.name} is shaken and bitten.`,
        poachers: `Shots in the dark. ${e.name} escaped, wounded. The herd is terrified.`,
      }[threat.type];
      this.log(what, 'bad', { id: e.id });
    }
    this.emit('threatEnd', { threat, ok: false });
  }

  resolveByGather() {
    const s = this.state;
    for (const t of [...s.threats]) {
      if (THREAT_INFO[t.type].counter === 'gather') {
        s.threats = s.threats.filter((x) => x.id !== t.id);
        s.stats.repelled++;
        this.log(t.type === 'lions' ? 'The adults closed ranks around the calves, ears spread and trumpeting. The lions slink away.' : 'The herd bunched together and charged. The hyenas scatter, whooping.', 'good');
        this.present().forEach((e) => (e.bond = clamp(e.bond + 1, 0, 100)));
        this.emit('threatEnd', { threat: t, ok: true });
      }
    }
  }

  resolvePendingAsAbsent() {
    const s = this.state;
    for (const t of [...s.threats]) this.threatFails(t, true);
    for (const e of this.herd) {
      if (e.status === 'wandering') {
        if (Math.random() < 0.5) {
          e.status = 'herd';
          this.log(`${e.name} found ${pronouns(e).pos} way back to the herd on ${pronouns(e).pos} own.`, 'good', { id: e.id });
        } else {
          e.status = 'lost';
          e.lostAt = s.lastTick;
          s.stats.lost++;
          this.log(`${e.name} never came back from wandering. ${pronouns(e).sub[0].toUpperCase() + pronouns(e).sub.slice(1)} is lost.`, 'bad', { id: e.id });
        }
      }
    }
    if (s.activity) s.activity = null;
  }

  updateLost(e, now, dt) {
    const hours = dt / HOUR;
    if (Math.random() < 0.08 * hours) {
      e.status = 'herd';
      e.happiness = clamp(e.happiness + 20, 0, 100);
      this.state.stats.returned++;
      this.log(`${e.name} is back! ${pronouns(e).sub[0].toUpperCase() + pronouns(e).sub.slice(1)} walked in rumbling, and the whole family rushed to greet ${pronouns(e).obj}.`, 'good', { id: e.id });
      this.emit('returned', e);
      return;
    }
    if (now - e.lostAt > 36 * HOUR && Math.random() < 0.5 * hours / 12 && !this.settings.godMode) {
      this.kill(e, 'lost');
    }
  }

  birth(at) {
    const s = this.state;
    const now = at || this.env.now();
    const mothers = this.present().filter((e) => {
      const a = ageOf(e, now);
      if (e.sex !== 'F' || a < 14 || a > 50) return false;
      return !this.herd.some((c) => c.motherId === e.id && c.status !== 'dead' && ageOf(c, now) < 3.5);
    });
    if (!mothers.length) return null;
    const mother = pick(mothers);
    const calf = makeCalf(mother, now, new Set(this.herd.map((e) => e.name)));
    if (calf.sex === 'M') calf.loves = 'milk, and the shade under his mother';
    s.herd.push(calf);
    s.stats.births++;
    this.present().forEach((e) => (e.happiness = clamp(e.happiness + 12, 0, 100)));
    this.log(`A calf is born! ${mother.name} has a ${calf.sex === 'F' ? 'daughter' : 'son'}. Welcome, ${calf.name} (“${calf.meaning}”).`, 'birth', { id: calf.id });
    this.emit('birth', { calf, mother });
    return calf;
  }

  kill(e, cause) {
    if (e.status === 'dead') return;
    if (this.settings.godMode) {
      e.health = Math.max(e.health, 20);
      return;
    }
    const s = this.state;
    const now = this.env.now();
    e.status = 'dead';
    e.deathAt = now;
    e.cause = cause;
    e.ageAtDeath = ageOf(e, now);
    const how = {
      lions: 'was taken by lions',
      hyenas: 'was taken by hyenas',
      poachers: 'was killed by poachers',
      thirst: 'died of thirst',
      hunger: 'died of hunger',
      weakness: 'grew too weak to go on',
      lost: 'was lost on the plains and never seen again',
      'old age': 'passed away peacefully of old age',
      removed: 'is gone',
    }[cause] || 'has died';
    this.log(`${e.name} ${how}. The herd gathers around, touching ${pronouns(e).obj} gently with their trunks.`, 'death', { id: e.id });
    // Elephants grieve: family members are hit hardest.
    for (const x of this.herd) {
      if (x.status === 'dead') continue;
      const close = x.family === e.family || x.motherId === e.id || e.motherId === x.id;
      x.grief = Math.max(x.grief || 0, close ? 40 : 12);
      x.happiness = clamp(x.happiness - (close ? 30 : 8), 0, 100);
    }
    this.emit('death', e);
    if (this.alive().length === 0) this.endGame();
  }

  endGame() {
    const s = this.state;
    if (s.over) return;
    s.over = true;
    s.endedAt = this.env.now();
    s.threats = [];
    s.activity = null;
    this.emit('gameover', s);
  }

  // ---------- player actions ----------

  lead(type) {
    const s = this.state;
    if (s.activity && s.activity.type === type) return { ok: false, msg: 'Already on the way.' };
    const now = Date.now();
    const green = this.env.greenness();
    let to;
    if (type === 'drink') to = clamp(55 + s.waterhole * 0.45, 0, 100);
    else to = clamp(40 + green * 60, 0, 100);
    const from = type === 'drink' ? s.water : s.forage;
    s.activity = { type, start: now, until: now + (type === 'drink' ? 45 : 60) * 1000, from, to: Math.max(from, to) };
    this.present().forEach((e) => (e.happiness = clamp(e.happiness + 2, 0, 100)));
    this.log(type === 'drink' ? 'You lead the herd to the waterhole.' : 'You lead the herd out to graze.', 'info');
    this.emit('activity', s.activity);
    return { ok: true };
  }

  gather() {
    const s = this.state;
    const now = Date.now();
    s.activity = { type: 'gather', start: now, until: now + 40 * 1000 };
    if (!s.threats.length) {
      this.present().forEach((e) => (e.happiness = clamp(e.happiness + 1, 0, 100)));
      this.log('You call the herd together. They bunch up, rumbling and touching trunks.', 'info');
    }
    this.emit('activity', s.activity);
    return { ok: true };
  }

  rangersReady() {
    return this.env.now() >= this.state.rangersReadyAt;
  }

  callRangers() {
    const s = this.state;
    const now = this.env.now();
    if (!this.rangersReady()) return { ok: false, msg: `Rangers are out on patrol. Back in ${fmtDuration(s.rangersReadyAt - now)}.` };
    s.rangersReadyAt = now + this.settings.rangerCooldownMin * MIN;
    let did = false;
    for (const t of [...s.threats]) {
      s.threats = s.threats.filter((x) => x.id !== t.id);
      s.stats.repelled++;
      did = true;
      this.log(t.type === 'poachers' ? 'The rangers arrive fast. The poachers’ vehicle flees into the night, and the herd is safe.' : `The rangers’ truck scatters the ${t.type}.`, 'good');
      this.emit('threatEnd', { threat: t, ok: true });
    }
    const lost = this.herd.filter((e) => e.status === 'lost' || e.status === 'wandering').sort((a, b) => a.health - b.health);
    if (lost.length) {
      const e = lost[0];
      e.status = 'herd';
      e.happiness = clamp(e.happiness + 15, 0, 100);
      s.stats.returned++;
      did = true;
      this.log(`The rangers found ${e.name} and gently guided ${pronouns(e).obj} home.`, 'good', { id: e.id });
      this.emit('returned', e);
    }
    if (!did) this.log('The rangers sweep the area. All quiet — for now.', 'info');
    this.emit('rangers', null);
    return { ok: true };
  }

  callBack(id) {
    const e = this.byId(id);
    if (!e || e.status !== 'wandering') return { ok: false };
    e.status = 'herd';
    e.bond = clamp(e.bond + 4, 0, 100);
    e.happiness = clamp(e.happiness + 5, 0, 100);
    this.state.stats.returned++;
    this.log(`${e.name} heard your call and turns for home, ears flapping.`, 'good', { id: e.id });
    this.emit('returned', e);
    return { ok: true };
  }

  pet(id) {
    const e = this.byId(id);
    if (!e || e.status !== 'herd') return { ok: false };
    const now = Date.now();
    const fresh = now - (e.lastPet || 0) > 20 * 1000;
    e.lastPet = now;
    if (fresh) {
      e.happiness = clamp(e.happiness + 6, 0, 100);
      e.bond = clamp(e.bond + 2, 0, 100);
      if (e.hurtUntil && e.health < 100) e.health = clamp(e.health + 5, 0, 100);
      if (e.grief) e.grief = Math.max(0, e.grief - 8);
      this.state.stats.pets++;
    }
    return { ok: true, fresh };
  }

  // ---------- dev helpers ----------

  devAddElephant() {
    const s = this.state;
    const now = this.env.now();
    const mothers = this.present().filter((e) => e.sex === 'F' && ageOf(e, now) > 14);
    const mother = mothers.length ? pick(mothers) : { id: null, family: 'Bibi', name: 'the herd' };
    const calf = makeCalf(mother, now, new Set(this.herd.map((e) => e.name)));
    calf.birth = now - rand(1, 20) * YEAR;
    delete calf.newborn;
    s.herd.push(calf);
    this.log(`${calf.name} joins the herd.`, 'good', { id: calf.id });
    return calf;
  }

  devRevive(id) {
    const e = this.byId(id);
    if (!e) return;
    e.status = 'herd';
    e.health = 100;
    e.happiness = 80;
    delete e.cause;
    this.log(`${e.name} is back with the herd.`, 'good', { id: e.id });
  }

  devHealAll() {
    const s = this.state;
    s.water = 100;
    s.forage = 100;
    s.waterhole = 100;
    this.herd.forEach((e) => {
      if (e.status === 'dead') return;
      e.health = 100;
      e.happiness = 100;
      e.grief = 0;
      if (e.status !== 'herd') e.status = 'herd';
    });
    s.threats = [];
    this.log('Dev: everyone healed, fed, watered and home.', 'info');
  }
}

function tuskScore(e, now) {
  return (e.sex === 'M' ? 2 : 1) * ageOf(e, now);
}

function weightedPick(arr, wf) {
  const ws = arr.map(wf);
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < arr.length; i++) if ((r -= ws[i]) <= 0) return arr[i];
  return arr[arr.length - 1];
}
