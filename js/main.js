// Bootstrap: wires the clock, simulation, renderer, UI and screens together.
import { LOCATION } from './config.js';
import { Clock, Environment, fmtClock } from './env.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Dev } from './dev.js';
import { Audio } from './audio.js';
import { store } from './storage.js';
import { ambientLine, ageOf, traitLine } from './herd.js';
import { DAY, escapeHtml, fmtAge } from './util.js';

const $ = (s) => document.querySelector(s);

class App {
  constructor() {
    this.settings = store.settings();
    this.clock = new Clock();
    this.env = new Environment(this.clock, this.settings);
    this.game = new Game(this.env, this.settings);
    this.audio = new Audio();
    this.audio.enabled = this.settings.sound;
    this.renderer = new Renderer($('#scene'), this.game, this.env);
    this.ui = new UI(this);
    this.dev = new Dev(this);
    this.preview = true;

    if (new URLSearchParams(location.search).has('dev')) store.setDev(true);

    const saved = store.loadGame();
    if (saved && saved.state && !saved.state.over) {
      this.clock.load(saved.clock);
      this.game.load(saved.state);
      this.preview = false;
    } else {
      this.clock.setSpeed(this.settings.timeSpeed);
      if (store.playsLeft() > 0) this.game.newGame(0); // a herd to admire on the title screen
    }

    this.wire();
    this.showTitle();
    this.loop();
  }

  wire() {
    const g = this.game;
    const r = this.renderer;
    const ui = this.ui;
    g.on('log', (e) => {
      if (this.preview) return;
      ui.onLog(e);
      if (e.kind === 'birthday' && e.id) {
        r.sparkle(e.id);
        r.hearts(e.id, 5);
      }
    });
    g.on('threat', (t) => {
      r.showThreat(t);
      this.audio.alarm();
      if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
      ui.update();
    });
    g.on('threatEnd', ({ threat, ok }) => {
      if (ok) r.scare(threat);
    });
    g.on('wander', () => {
      this.audio.rumble(0.8);
      ui.update();
    });
    g.on('returned', (e) => r.hearts(e.id, 3));
    g.on('death', (e) => {
      if (this.preview || g.catchingUp || g.alive().length === 0) return;
      const now = this.env.now();
      ui.moment({
        tone: 'grief',
        kicker: 'In memory',
        title: e.name,
        img: e,
        body: `${e.name}, “${e.meaning}”, ${fmtAge(e.ageAtDeath || ageOf(e, now))}. ${traitLine(e.trait, e.sex)} The herd stands with ${e.sex === 'M' ? 'him' : 'her'} a long while, touching gently with their trunks. Elephants remember.`,
        button: 'We will remember',
      });
    });
    g.on('birth', ({ calf, mother }) => {
      if (this.preview) return;
      this.audio.chime();
      setTimeout(() => {
        r.sparkle(calf.id, '#ffc2d4');
        r.hearts(mother.id, 6);
      }, 300);
      if (g.catchingUp) return;
      ui.moment({
        tone: 'joy',
        kicker: 'A new life',
        title: `Welcome, ${calf.name}`,
        img: calf,
        body: `${mother.name} has given birth to a ${calf.sex === 'F' ? 'daughter' : 'son'}. The whole family crowds around, rumbling and trumpeting, touching the tiny newcomer. ${calf.name} means “${calf.meaning}”.`,
        button: 'Hello, little one',
      });
    });
    g.on('away', (rep) => ui.showAway(rep));
    g.on('gameover', () => this.gameOver());

    r.onTap = (id, how) => {
      this.audio.unlock();
      if (this.preview) return;
      if (how === 'indicator') return ui.callBack(id);
      if (!id) return ui.select(null);
      const e = g.byId(id);
      if (ui.selectedId === id && e.status === 'herd') ui.comfort(id);
      else {
        ui.select(id);
        this.audio.tap();
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.save();
        this.audio.suspend();
      } else if (this.playing) {
        this.audio.unlock();
        this.game.tick();
        this.ui.update();
      }
    });
    window.addEventListener('pagehide', () => this.save());
    document.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
  }

  loop() {
    let last = performance.now();
    const frame = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.renderer.frame(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    let n = 0;
    setInterval(() => {
      n++;
      const now = this.env.now();
      // Hidden tabs are throttled by the browser, so hidden time counts as time away.
      if (this.playing && !document.hidden && this.game.state && !this.game.state.over) {
        this.game.tick();
        this.ui.update();
        if (n % 5 === 0) this.save();
        if (n % 38 === 0) {
          const line = ambientLine(this.game.herd, this.env, now);
          if (line) this.ui.whisper(line);
        }
      } else if (n % 15 === 0) this.refreshTitle();
      this.audio.ambience({ night: this.env.isNight(now), raining: this.env.weather(now).raining });
    }, 1000);
  }

  save() {
    if (this.preview || !this.game.state) return;
    store.saveGame(this.game.state, this.clock.toJSON());
  }

  saveSettings() {
    store.saveSettings(this.settings);
  }

  setSound(on) {
    this.settings.sound = on;
    this.audio.setEnabled(on);
    this.saveSettings();
  }

  // ---------- screens ----------

  showTitle() {
    this.playing = false;
    $('#hud').classList.add('hidden');
    $('#title').classList.remove('hidden');
    this.refreshTitle();
  }

  refreshTitle() {
    const t = $('#title');
    if (t.classList.contains('hidden')) return;
    const meta = store.meta();
    const left = store.playsLeft(meta);
    const max = store.maxPlays(meta);
    const inProgress = !this.preview && this.game.state && !this.game.state.over;
    const now = this.env.now();
    const season = this.env.season(now);
    const dots = Array.from({ length: max }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');

    let actions;
    if (inProgress) {
      const alive = this.game.alive().length;
      const days = Math.floor((now - this.game.state.startedAt) / DAY);
      actions = `<p class="title-status">${alive} elephant${alive === 1 ? '' : 's'} waiting for you · day ${days + 1}</p>
        <button class="btn primary big" id="tContinue">Return to the herd</button>`;
    } else if (left > 0) {
      actions = `<button class="btn primary big" id="tBegin">${meta.playsUsed ? 'Begin a new journey' : 'Begin your journey'}</button>`;
    } else {
      actions = `<div class="finale"><h3>Thank you for playing</h3>
        <p>You have walked all ${max} journeys with the elephants of Amboseli. Somewhere under Kilimanjaro, the real herds walk on.</p></div>`;
    }
    t.querySelector('.title-live').innerHTML = `${LOCATION.name} · ${fmtClock(this.env.hour(now))} · ${season.name}`;
    t.querySelector('.journeys').innerHTML = `<span>Journeys</span><div class="dots">${dots}</div><span>${left} of ${max} left</span>`;
    t.querySelector('.title-actions').innerHTML = actions;
    const b = $('#tBegin');
    if (b) b.onclick = () => this.begin();
    const c = $('#tContinue');
    if (c) c.onclick = () => this.enter();
    // Secret dev unlock: tap the logo 7 times.
    let taps = 0;
    t.querySelector('.logo').onclick = () => {
      if (++taps >= 7) {
        store.setDev(true);
        this.ui.toast('Dev mode unlocked. Open it from the menu.', 'good');
        taps = 0;
        if (this.preview) this.dev.open();
      }
    };
    $('#titleDev').classList.toggle('hidden', !store.devUnlocked());
    $('#titleDev').onclick = () => this.dev.open();
  }

  begin() {
    this.audio.unlock();
    const meta = store.meta();
    if (store.playsLeft(meta) <= 0) return this.refreshTitle();
    meta.playsUsed += 1;
    store.saveMeta(meta);
    this.renderer.vis.clear();
    this.clock.setSpeed(this.settings.timeSpeed);
    this.game.newGame(meta.playsUsed);
    this.preview = false;
    this.save();
    this.showIntro();
  }

  showIntro() {
    $('#title').classList.add('hidden');
    const intro = $('#intro');
    intro.classList.remove('hidden');
    const now = this.env.now();
    const season = this.env.season(now);
    const pages = [
      { h: 'Thirty-seven elephants', p: 'Three families and one big travelling bull, crossing the plains of Amboseli in southern Kenya, under the snows of Kilimanjaro. From today, they are yours to watch over.' },
      { h: 'Meet Bibi', p: 'Bibi is 58, the matriarch. She remembers where the water was in droughts before most of the herd was born. Her daughters, granddaughters and the tiny calf Asali all follow her lead.' },
      { h: 'It is really happening', p: `The sun you’ll see rises and sets on Amboseli’s real clock. Right now it is ${fmtClock(this.env.hour(now))} there, in the ${season.name.toLowerCase()}. Check in through the day. The herd lives on when you’re away.` },
      { h: 'Keep them alive. Keep them happy.', p: 'Lead them to water and grass. Gather them when predators stalk the calves. Call rangers when poachers come. Bring back the wanderers. Comfort them. And get to know every one of them.' },
    ];
    let i = 0;
    const render = () => {
      const pg = pages[i];
      intro.querySelector('.intro-card').innerHTML = `<div class="kicker">Journey ${this.game.state.play} · ${i + 1} / ${pages.length}</div>
        <h2>${escapeHtml(pg.h)}</h2><p>${escapeHtml(pg.p)}</p>
        <div class="dots small">${pages.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <button class="btn primary wide" id="introNext">${i < pages.length - 1 ? 'Next' : 'Meet the herd'}</button>`;
      $('#introNext').onclick = () => {
        this.audio.tap();
        if (++i < pages.length) render();
        else {
          intro.classList.add('hidden');
          this.enter(true);
        }
      };
    };
    render();
  }

  enter(fresh = false) {
    $('#title').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    this.playing = true;
    this.audio.unlock();
    this.game.tick();
    this.ui.update();
    if (fresh) {
      const bibi = this.game.herd.find((e) => e.name === 'Bibi');
      setTimeout(() => {
        this.audio.trumpet(0.85);
        if (bibi) this.renderer.trumpet(bibi.id);
      }, 600);
      this.ui.whisper('Tap an elephant to meet them. Tap again to comfort them.');
    }
  }

  gameOver() {
    const s = this.game.state;
    const now = this.env.now();
    const meta = store.meta();
    const days = Math.max(1, Math.ceil((now - s.startedAt) / DAY));
    meta.history.push({ play: s.play, days, births: s.stats.births, repelled: s.stats.repelled, endedAt: now });
    store.saveMeta(meta);
    store.clearGame();
    this.save = () => {};
    const left = store.playsLeft(meta);
    const fallen = this.game.herd.filter((e) => e.status === 'dead').sort((a, b) => a.deathAt - b.deathAt);
    const favourite = [...this.game.herd].sort((a, b) => b.bond - a.bond)[0];

    this.playing = false;
    $('#hud').classList.add('hidden');
    this.ui.closeSheet();
    this.ui.moments = [];
    this.ui.nextMoment();
    const over = $('#over');
    over.classList.remove('hidden');
    over.querySelector('.over-card').innerHTML = `
      <div class="kicker">Journey ${s.play} of ${store.maxPlays(meta)}</div>
      <h1>Thank you for playing</h1>
      <p class="lede">For ${days} day${days === 1 ? '' : 's'} you watched over the elephants of Amboseli. Every one of them mattered.</p>
      <div class="menu-stats">
        <div><b>${days}</b><span>days together</span></div>
        <div><b>${s.stats.repelled}</b><span>threats stopped</span></div>
        <div><b>${s.stats.births}</b><span>calves born</span></div>
        <div><b>${s.stats.pets}</b><span>moments of comfort</span></div>
      </div>
      ${favourite && favourite.bond > 12 ? `<p class="fav">Your closest bond was with <b>${escapeHtml(favourite.name)}</b>.</p>` : ''}
      <div class="memorial">${fallen.map((e) => `<span>${escapeHtml(e.name)}</span>`).join('')}</div>
      ${left > 0
        ? `<p class="left">${left} journey${left === 1 ? '' : 's'} remaining.</p><button class="btn primary big" id="overAgain">Begin a new journey</button>`
        : `<p class="left">That was your final journey. Thank you for loving them.</p><button class="btn ghost big" id="overDone">Close</button>`}`;
    const again = $('#overAgain');
    if (again) again.onclick = () => location.reload();
    const done = $('#overDone');
    if (done) done.onclick = () => location.reload();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
