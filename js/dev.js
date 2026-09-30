// Dev Mode: add lives (journeys), edit settings, trigger events, bend time.
import { DEFAULT_SETTINGS, HERD_SIZE } from './config.js';
import { SEASONS, fmtClock } from './env.js';
import { store } from './storage.js';
import { ICONS } from './icons.js';
import { HOUR, DAY, pick } from './util.js';

const SLIDERS = [
  ['eventRate', 'Event frequency', 0, 10, 0.1, 'x'],
  ['lethality', 'Threat lethality', 0, 3, 0.05, 'x'],
  ['decayRate', 'Thirst & hunger speed', 0, 10, 0.1, 'x'],
  ['threatWindowSec', 'Time to answer threats', 10, 600, 5, 's'],
  ['wanderGraceMin', 'Wanderer grace period', 0.5, 60, 0.5, 'min'],
  ['rangerCooldownMin', 'Ranger cooldown', 0, 600, 5, 'min'],
  ['offlineLossCap', 'Max deaths per absence', 0, 37, 1, ''],
];

export class Dev {
  constructor(app) {
    this.app = app;
  }

  open() {
    const app = this.app;
    const s = app.settings;
    const meta = store.meta();
    const g = app.game;
    const hasGame = !!g.state && !app.preview;
    const seasonOpts = ['auto', ...Object.keys(SEASONS)].map((k) => `<option value="${k}" ${s.seasonOverride === k ? 'selected' : ''}>${k === 'auto' ? 'Real (auto)' : SEASONS[k].name}</option>`).join('');
    const speeds = [1, 10, 60, 600, 3600].map((v) => `<option value="${v}" ${s.timeSpeed === v ? 'selected' : ''}>${v === 1 ? 'Real time' : `${v}× (1s = ${v >= 3600 ? '1h' : v >= 60 ? v / 60 + 'm' : v + 's'})`}</option>`).join('');

    const body = app.ui.openSheet(
      'dev',
      `<div class="dev">
        <section>
          <h4>Journeys (lives)</h4>
          <div class="devrow"><span>Used <b>${meta.playsUsed}</b> of <b>${store.maxPlays(meta)}</b> · <b>${store.playsLeft(meta)}</b> left</span></div>
          <div class="btns">
            <button data-a="playPlus">+1 journey</button>
            <button data-a="playPlus3">+3 journeys</button>
            <button data-a="playMinus">−1 journey</button>
            <button data-a="playReset">Reset to 3</button>
          </div>
        </section>
        ${hasGame ? `<section>
          <h4>Herd (${g.alive().length} alive)</h4>
          <div class="btns">
            <button data-a="add1">+1 elephant</button>
            <button data-a="add5">+5 elephants</button>
            <button data-a="restore">Restore to ${HERD_SIZE}</button>
            <button data-a="heal">Heal &amp; feed all</button>
            <button data-a="killOne" class="warn">Kill one</button>
            <button data-a="killAll" class="warn">End game (kill all)</button>
          </div>
        </section>
        <section>
          <h4>Trigger event</h4>
          <div class="btns">
            <button data-a="ev:wander">Wanderer</button>
            <button data-a="ev:lions">Lions</button>
            <button data-a="ev:hyenas">Hyenas</button>
            <button data-a="ev:poachers">Poachers</button>
            <button data-a="ev:birth">Birth</button>
            <button data-a="ev:drought">Drought</button>
            <button data-a="ev:thorn">Injury</button>
            <button data-a="ev:joy">Happy moment</button>
            <button data-a="rangersReady">Rangers ready</button>
          </div>
        </section>` : '<section><p class="muted">Start or continue a journey to edit the herd and trigger events.</p></section>'}
        <section>
          <h4>Time &amp; season</h4>
          <label class="field">Clock speed<select id="dSpeed">${speeds}</select></label>
          <label class="field">Season<select id="dSeason">${seasonOpts}</select></label>
          <label class="field">Time of day <output id="oHour">${s.hourOverride < 0 ? 'Real' : fmtClock(s.hourOverride)}</output>
            <input type="range" id="dHour" min="-0.5" max="23.75" step="0.25" value="${s.hourOverride < 0 ? -0.5 : s.hourOverride}"></label>
          <div class="btns">
            <button data-a="jump1h">Skip 1 hour</button>
            <button data-a="jump1d">Skip 1 day</button>
            <button data-a="resync">Back to real time</button>
          </div>
        </section>
        <section>
          <h4>Game settings</h4>
          ${SLIDERS.map(([k, label, min, max, step, unit]) => `<label class="field">${label} <output id="o_${k}">${s[k]}${unit}</output>
            <input type="range" data-k="${k}" data-u="${unit}" min="${min}" max="${max}" step="${step}" value="${s[k]}"></label>`).join('')}
          <label class="toggle"><input type="checkbox" id="dBirths" ${s.birthsEnabled ? 'checked' : ''}> Births enabled</label>
          <label class="toggle"><input type="checkbox" id="dGod" ${s.godMode ? 'checked' : ''}> God mode (no one dies)</label>
          <div class="btns"><button data-a="defaults">Restore default settings</button></div>
        </section>
        <section>
          <h4>Danger zone</h4>
          <div class="btns">
            <button data-a="wipe" class="warn">Wipe all data</button>
            <button data-a="lock">Hide dev mode</button>
          </div>
        </section>
      </div>`,
      `${ICONS.wrench} Dev mode`
    );

    body.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => this.action(b.dataset.a)));
    body.querySelectorAll('input[data-k]').forEach((inp) => {
      inp.oninput = () => {
        const k = inp.dataset.k;
        s[k] = Number(inp.value);
        body.querySelector(`#o_${k}`).textContent = `${s[k]}${inp.dataset.u}`;
        app.saveSettings();
      };
    });
    body.querySelector('#dSpeed').onchange = (e) => {
      s.timeSpeed = Number(e.target.value);
      app.clock.setSpeed(s.timeSpeed);
      app.saveSettings();
    };
    body.querySelector('#dSeason').onchange = (e) => {
      s.seasonOverride = e.target.value;
      app.saveSettings();
    };
    const hr = body.querySelector('#dHour');
    hr.oninput = () => {
      const v = Number(hr.value);
      s.hourOverride = v < 0 ? -1 : v;
      body.querySelector('#oHour').textContent = v < 0 ? 'Real' : fmtClock(v);
      app.saveSettings();
    };
    body.querySelector('#dBirths').onchange = (e) => {
      s.birthsEnabled = e.target.checked;
      app.saveSettings();
    };
    body.querySelector('#dGod').onchange = (e) => {
      s.godMode = e.target.checked;
      app.saveSettings();
    };
  }

  action(a) {
    const app = this.app;
    const g = app.game;
    const meta = store.meta();
    const toast = (m) => app.ui.toast(m, 'good');
    switch (a) {
      case 'playPlus':
        meta.bonusPlays += 1;
        break;
      case 'playPlus3':
        meta.bonusPlays += 3;
        break;
      case 'playMinus':
        meta.bonusPlays -= 1;
        break;
      case 'playReset':
        meta.bonusPlays = 0;
        meta.playsUsed = app.game.state && !app.preview ? 1 : 0;
        break;
      case 'add1':
        g.devAddElephant();
        break;
      case 'add5':
        for (let i = 0; i < 5; i++) g.devAddElephant();
        break;
      case 'restore': {
        g.herd.filter((e) => e.status === 'dead').forEach((e) => g.alive().length < HERD_SIZE && g.devRevive(e.id));
        while (g.alive().length < HERD_SIZE) g.devAddElephant();
        break;
      }
      case 'heal':
        g.devHealAll();
        break;
      case 'killOne': {
        const e = pick(g.alive());
        if (e) {
          const god = app.settings.godMode;
          app.settings.godMode = false;
          g.kill(e, 'removed');
          app.settings.godMode = god;
        }
        break;
      }
      case 'killAll': {
        if (!confirm('End this journey now? All elephants will be marked as gone.')) return;
        const god = app.settings.godMode;
        app.settings.godMode = false;
        g.alive().forEach((e) => g.kill(e, 'removed'));
        app.settings.godMode = god;
        app.ui.closeSheet();
        return;
      }
      case 'rangersReady':
        g.state.rangersReadyAt = 0;
        break;
      case 'jump1h':
        app.clock.jump(HOUR);
        app.game.tick();
        break;
      case 'jump1d':
        app.clock.jump(DAY);
        app.game.tick();
        break;
      case 'resync':
        app.clock.resync();
        app.settings.timeSpeed = 1;
        app.settings.hourOverride = -1;
        app.settings.seasonOverride = 'auto';
        if (g.state) g.state.lastTick = Math.min(g.state.lastTick, app.clock.now());
        app.saveSettings();
        break;
      case 'defaults': {
        const keep = { sound: app.settings.sound };
        Object.assign(app.settings, DEFAULT_SETTINGS, keep);
        app.clock.setSpeed(1);
        app.saveSettings();
        break;
      }
      case 'wipe':
        if (!confirm('Wipe ALL saved data, including journeys used? This cannot be undone.')) return;
        store.wipe();
        location.reload();
        return;
      case 'lock':
        store.setDev(false);
        app.ui.closeSheet();
        return;
      default:
        if (a.startsWith('ev:')) {
          const kind = a.slice(3);
          if (kind === 'birth') {
            if (!g.birth()) app.ui.toast('No eligible mother right now (each needs no calf under 3½).', 'warn');
          } else g.runEvent(kind, app.clock.now(), false);
          app.ui.closeSheet();
          app.save();
          app.ui.update();
          return;
        }
    }
    store.saveMeta(meta);
    app.save();
    app.ui.update();
    app.refreshTitle();
    toast('Done');
    this.open();
  }
}
