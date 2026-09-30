// Everything on top of the canvas: HUD, alerts, sheets, screens.
import { HERD_SIZE, THREAT_INFO, LOCATION, VERSION } from './config.js';
import { SEASONS, fmtClock, localDate } from './env.js';
import { ageOf, lifeStage, traitLine, pronouns, FAMILY_COLORS } from './herd.js';
import { portrait } from './render.js';
import { ICONS } from './icons.js';
import { store } from './storage.js';
import { clamp, el, escapeHtml, fmtAge, fmtDuration, MIN, DAY } from './util.js';

const $ = (s) => document.querySelector(s);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export class UI {
  constructor(app) {
    this.app = app;
    this.portraits = new Map();
    this.sheetKind = null;
    this.moments = [];
    this.momentOpen = false;
    this.herdFilter = 'all';
    this.bind();
  }

  get game() {
    return this.app.game;
  }
  get env() {
    return this.app.env;
  }

  bind() {
    document.querySelectorAll('[data-icon]').forEach((n) => (n.innerHTML = ICONS[n.dataset.icon] + n.innerHTML));
    $('#btnWater').onclick = () => this.act(() => this.game.lead('drink'));
    $('#btnGraze').onclick = () => this.act(() => this.game.lead('graze'));
    $('#btnGather').onclick = () => this.act(() => {
      this.app.audio.trumpet(0.9);
      return this.game.gather();
    });
    $('#btnRangers').onclick = () => this.act(() => {
      const r = this.game.callRangers();
      if (r.ok) this.app.renderer.sendRangers();
      return r;
    });
    $('#btnHerd').onclick = () => this.openHerd();
    $('#herdPill').onclick = () => this.openHerd();
    $('#menuBtn').onclick = () => this.openMenu();
    $('#journalBtn').onclick = () => this.openJournal();
    $('#sheet').addEventListener('click', (e) => {
      if (e.target.id === 'sheet') this.closeSheet();
    });
    $('#selClose').onclick = () => this.select(null);
    $('#moment').addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) this.nextMoment();
    });
  }

  act(fn) {
    this.app.audio.unlock();
    this.app.audio.tap();
    const r = fn();
    if (r && r.msg) this.toast(r.msg, 'info');
    this.update();
    this.app.save();
  }

  // ---------- HUD ----------

  update() {
    const g = this.game;
    const s = g.state;
    if (!s) return;
    const now = this.env.now();
    const alive = g.alive().length;
    $('#herdCount').textContent = alive;
    $("#herdMax").textContent = `/${HERD_SIZE}`;
    const hour = this.env.hour(now);
    $('#clockTime').textContent = fmtClock(hour);
    const season = this.env.season(now);
    const w = this.env.weather(now);
    $('#clockSub').textContent = season.name;
    $('#clockTemp').textContent = `${w.temp}°C`;
    $('#weatherIcon').innerHTML = w.raining ? ICONS.rain : this.env.isNight(now) ? ICONS.moon : w.cloud > 0.6 ? ICONS.cloud : ICONS.sun;

    this.meter('#mWater', s.water);
    this.meter('#mForage', s.forage);
    this.meter('#mMood', g.avgHappiness());

    // Action states
    const act = s.activity;
    $('#btnWater').classList.toggle('active', !!act && act.type === 'drink');
    $('#btnGraze').classList.toggle('active', !!act && act.type === 'graze');
    $('#btnGather').classList.toggle('active', !!act && act.type === 'gather');
    const ready = g.rangersReady();
    const rb = $('#btnRangers');
    rb.classList.toggle('cooldown', !ready);
    rb.querySelector('small').textContent = ready ? 'Rangers' : fmtShort(s.rangersReadyAt - now);
    $('#btnWater').classList.toggle('urgent', s.water < 30);
    $('#btnGraze').classList.toggle('urgent', s.forage < 30);
    $('#btnGather').classList.toggle('urgent', s.threats.some((t) => THREAT_INFO[t.type].counter === 'gather'));
    rb.classList.toggle('urgent', ready && s.threats.some((t) => t.type === 'poachers'));

    this.renderAlerts();
    this.updateSelCard();
    if (this.sheetKind === 'journal') this.openJournal(true);
  }

  meter(sel, v) {
    const m = $(sel);
    const f = m.querySelector('i');
    f.style.width = `${clamp(v, 0, 100)}%`;
    m.classList.toggle('low', v < 30);
    m.classList.toggle('mid', v >= 30 && v < 60);
  }

  renderAlerts() {
    const s = this.game.state;
    const box = $('#alerts');
    const want = [];
    for (const t of s.threats) want.push({ key: t.id, t });
    for (const e of this.game.herd) if (e.status === 'wandering') want.push({ key: e.id, e });
    const keys = new Set(want.map((w) => w.key));
    [...box.children].forEach((c) => {
      if (!keys.has(c.dataset.key)) {
        c.classList.add('leaving');
        setTimeout(() => c.remove(), 300);
      }
    });
    for (const w of want) {
      let card = box.querySelector(`[data-key="${w.key}"]`);
      if (!card) {
        card = el('div', 'alert glass');
        card.dataset.key = w.key;
        if (w.t) {
          const info = THREAT_INFO[w.t.type];
          const btn = info.counter === 'gather' ? 'Gather herd' : 'Call rangers';
          card.innerHTML = `<div class="alert-icon ${w.t.type}">${w.t.type === 'poachers' ? ICONS.shield : ICONS.eye}</div>
            <div class="alert-body"><b>${info.title}</b><span>${info.counter === 'gather' ? 'Circle the adults around the calves.' : 'Only the rangers can stop them.'}</span><div class="bar"><i></i></div></div>
            <button class="btn small danger">${btn}</button>`;
          card.querySelector('button').onclick = () => (info.counter === 'gather' ? $('#btnGather') : $('#btnRangers')).click();
        } else {
          const e = w.e;
          card.innerHTML = `<div class="alert-icon wander"><img alt="" /></div>
            <div class="alert-body"><b>${escapeHtml(e.name)} is wandering off</b><span>Call ${pronouns(e).obj} back before ${pronouns(e).sub}’s lost.</span><div class="bar"><i></i></div></div>
            <button class="btn small">Call back</button>`;
          this.portraitInto(card.querySelector('img'), e);
          card.querySelector('button').onclick = () => this.callBack(e.id);
        }
        box.appendChild(card);
      }
      const start = w.t ? w.t.start : w.e.wanderStart;
      const end = w.t ? w.t.deadline : w.e.wanderDeadline;
      const f = clamp((end - Date.now()) / (end - start), 0, 1);
      const bar = card.querySelector('.bar i');
      bar.style.width = `${f * 100}%`;
      card.classList.toggle('critical', f < 0.3);
    }
  }

  callBack(id) {
    this.app.audio.unlock();
    this.app.audio.rumble(1.1);
    const r = this.game.callBack(id);
    if (r.ok) {
      this.app.renderer.trumpet(id);
      this.app.renderer.hearts(id, 4);
    }
    this.update();
    this.app.save();
  }

  // ---------- selection ----------

  select(id) {
    this.selectedId = id;
    this.app.renderer.selected = id;
    const card = $('#selCard');
    if (!id) {
      card.classList.add('hidden');
      return;
    }
    const e = this.game.byId(id);
    card.classList.remove('hidden');
    card.dataset.id = id;
    this.portraitInto($('#selImg'), e);
    $('#selName').textContent = e.name;
    const fam = FAMILY_COLORS[e.family] || '#fff';
    $('#selName').style.setProperty('--fam', fam);
    this.updateSelCard();
  }

  updateSelCard() {
    const id = this.selectedId;
    if (!id) return;
    const e = this.game.byId(id);
    if (!e || e.status === 'dead' || e.status === 'lost') return this.select(null);
    const age = ageOf(e, this.env.now());
    $('#selMeta').textContent = `${lifeStage(age, e.sex)} · ${fmtAge(age)}`;
    $('#selHealth').style.width = `${e.health}%`;
    $('#selHappy').style.width = `${e.happiness}%`;
    const actions = $('#selActions');
    const mode = e.status === 'wandering' ? 'wander' : 'herd';
    if (actions.dataset.mode !== mode || actions.dataset.id !== id) {
      actions.dataset.mode = mode;
      actions.dataset.id = id;
      actions.innerHTML = '';
      if (mode === 'wander') {
        const b = el('button', 'btn primary', `${ICONS.call}Call back`);
        b.onclick = () => this.callBack(id);
        actions.appendChild(b);
      } else {
        const b = el('button', 'btn primary', `${ICONS.heart}Comfort`);
        b.onclick = () => this.comfort(id);
        actions.appendChild(b);
      }
      const p = el('button', 'btn ghost', 'Profile');
      p.onclick = () => this.openProfile(id);
      actions.appendChild(p);
    }
  }

  comfort(id) {
    this.app.audio.unlock();
    const e = this.game.byId(id);
    const r = this.game.pet(id);
    if (!r.ok) return;
    const age = ageOf(e, this.env.now());
    this.app.renderer.hearts(id, r.fresh ? 7 : 3);
    if (Math.random() < 0.35 || age < 4) {
      this.app.renderer.trumpet(id);
      this.app.audio.trumpet(age < 5 ? 1.5 : age < 15 ? 1.2 : 0.9);
    } else this.app.audio.rumble(age < 5 ? 1.6 : 1);
    if (navigator.vibrate) navigator.vibrate(12);
    if (r.fresh) {
      const lines = [
        `${e.name} leans into you, rumbling softly.`,
        `${e.name} sniffs you all over with ${pronouns(e).pos} trunk.`,
        `${e.name} flaps ${pronouns(e).pos} ears happily.`,
        `${e.name} gently wraps ${pronouns(e).pos} trunk around your arm.`,
      ];
      if (age < 4) lines.push(`${e.name} tries to climb into your lap. It doesn't work.`, `${e.name} squeaks and wobbles over to you.`);
      this.whisper(lines[Math.floor(Math.random() * lines.length)]);
    }
    this.update();
  }

  // ---------- toasts & moments ----------

  toast(text, kind = 'info') {
    const box = $('#toasts');
    const t = el('div', `toast ${kind}`, escapeHtml(text));
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4700);
  }

  whisper(text) {
    const w = $('#whisper');
    w.classList.remove('show');
    void w.offsetWidth;
    w.textContent = text;
    w.classList.add('show');
  }

  onLog(entry) {
    const map = { alert: 'alert', bad: 'bad', death: 'bad', good: 'good', birth: 'good', birthday: 'good', warn: 'warn' };
    if (entry.kind === 'joy' || entry.kind === 'info') return this.whisper(entry.text);
    if (entry.kind === 'death' || entry.kind === 'birth') return; // shown as moments
    this.toast(entry.text, map[entry.kind] || 'info');
  }

  moment(m) {
    this.moments.push(m);
    if (!this.momentOpen) this.nextMoment();
  }

  nextMoment() {
    const box = $('#moment');
    const m = this.moments.shift();
    if (!m) {
      box.classList.add('hidden');
      this.momentOpen = false;
      return;
    }
    this.momentOpen = true;
    box.classList.remove('hidden');
    box.className = `moment ${m.tone || ''}`;
    box.innerHTML = `<div class="moment-card glass">
      ${m.img ? '<div class="moment-img"><img alt=""/></div>' : ''}
      <div class="kicker">${escapeHtml(m.kicker || '')}</div>
      <h2>${escapeHtml(m.title)}</h2>
      <p>${m.html || escapeHtml(m.body || '')}</p>
      <button class="btn primary wide" data-close>${escapeHtml(m.button || 'Continue')}</button></div>`;
    if (m.img) this.portraitInto(box.querySelector('img'), m.img);
  }

  async portraitInto(img, e) {
    const age = ageOf(e, this.env.now());
    const key = `${e.id}:${age < 1 ? 0 : Math.floor(Math.min(age, 25) / 3)}`;
    if (!this.portraits.has(key)) this.portraits.set(key, await portrait(e, age, 96));
    img.src = this.portraits.get(key);
  }

  // ---------- sheets ----------

  openSheet(kind, html, title) {
    this.sheetKind = kind;
    const sh = $('#sheet');
    sh.classList.remove('hidden');
    requestAnimationFrame(() => sh.classList.add('open'));
    $('#sheetTitle').innerHTML = title;
    $('#sheetBody').innerHTML = html;
    $('#sheetClose').onclick = () => this.closeSheet();
    return $('#sheetBody');
  }

  closeSheet() {
    this.sheetKind = null;
    const sh = $('#sheet');
    sh.classList.remove('open');
    setTimeout(() => {
      if (!this.sheetKind) sh.classList.add('hidden');
    }, 280);
  }

  openHerd() {
    const g = this.game;
    const now = this.env.now();
    const f = this.herdFilter;
    const all = g.herd;
    const filters = [
      ['all', 'Everyone'],
      ['calves', 'Calves'],
      ['care', 'Needs care'],
      ['gone', 'Remembered'],
    ];
    let list = all.filter((e) => e.status !== 'dead');
    if (f === 'calves') list = list.filter((e) => ageOf(e, now) < 5);
    if (f === 'care') list = list.filter((e) => e.health < 70 || e.happiness < 50 || e.status !== 'herd');
    if (f === 'gone') list = all.filter((e) => e.status === 'dead');
    const families = ['Bibi', 'Taji', 'Amani', 'Tembo'];
    list.sort((a, b) => families.indexOf(a.family) - families.indexOf(b.family) || ageOf(b, now) - ageOf(a, now));

    const body = this.openSheet(
      'herd',
      `<div class="chips">${filters.map(([k, l]) => `<button class="chip ${k === f ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
       <div class="herd-grid">${list.length ? '' : `<p class="empty">${f === 'gone' ? 'No one lost. Keep it that way.' : 'Nobody here right now.'}</p>`}</div>`,
      `${ICONS.herd} Your herd <span class="count">${g.alive().length} alive</span>`
    );
    body.querySelectorAll('.chip').forEach((c) => (c.onclick = () => {
      this.herdFilter = c.dataset.f;
      this.openHerd();
    }));
    const grid = body.querySelector('.herd-grid');
    for (const e of list) {
      const age = ageOf(e, now);
      const card = el('button', `ecard ${e.status}`);
      const status = { herd: '', wandering: '<em class="tag warn">Wandering</em>', lost: '<em class="tag bad">Lost</em>', dead: `<em class="tag gone">${causeShort(e.cause)}</em>` }[e.status];
      card.innerHTML = `<img alt=""/><div class="ecard-txt"><b style="--fam:${FAMILY_COLORS[e.family]}">${escapeHtml(e.name)}</b>
        <span>${e.status === 'dead' ? `${fmtAge(e.ageAtDeath || age)}` : `${lifeStage(age, e.sex)} · ${fmtAge(age)}`}</span>${status}
        ${e.status === 'dead' ? '' : `<div class="minibars"><i class="h" style="width:${e.health}%"></i><i class="j" style="width:${e.happiness}%"></i></div>`}</div>`;
      this.portraitInto(card.querySelector('img'), e);
      card.onclick = () => this.openProfile(e.id);
      grid.appendChild(card);
    }
  }

  openProfile(id) {
    const g = this.game;
    const e = g.byId(id);
    if (!e) return;
    const now = this.env.now();
    const age = ageOf(e, now);
    const p = pronouns(e);
    const mother = e.motherId && g.byId(e.motherId);
    const adoptive = e.adoptiveId && g.byId(e.adoptiveId);
    const calves = g.herd.filter((c) => c.motherId === e.id);
    const bd = localDate(e.birth);
    const hearts = Math.round(e.bond / 20);
    const rel = [];
    if (mother) rel.push(`Mother: <a data-id="${mother.id}">${escapeHtml(mother.name)}</a>${mother.status === 'dead' ? ' †' : ''}`);
    if (adoptive) rel.push(`Adopted by <a data-id="${adoptive.id}">${escapeHtml(adoptive.name)}</a>`);
    if (calves.length) rel.push(`Calves: ${calves.map((c) => `<a data-id="${c.id}">${escapeHtml(c.name)}</a>${c.status === 'dead' ? ' †' : ''}`).join(', ')}`);
    let statusLine = '';
    if (e.status === 'wandering') statusLine = `<div class="banner warn">${escapeHtml(e.name)} is wandering away from the herd.</div>`;
    if (e.status === 'lost') statusLine = `<div class="banner bad">Lost for ${fmtDuration(now - e.lostAt)}. Rangers may be able to find ${p.obj}.</div>`;
    if (e.status === 'dead') statusLine = `<div class="banner gone">Remembered. ${escapeHtml(e.name)} ${causeLong(e.cause)} at ${fmtAge(e.ageAtDeath)} old.</div>`;
    if (e.grief > 10 && e.status === 'herd') statusLine = `<div class="banner calm">${escapeHtml(e.name)} is grieving. Comfort helps.</div>`;

    const body = this.openSheet(
      'profile',
      `<div class="profile">
        <div class="profile-hero" style="--fam:${FAMILY_COLORS[e.family]}"><img alt=""/></div>
        <h2>${escapeHtml(e.name)} <small>“${escapeHtml(e.meaning)}”</small></h2>
        <div class="sub">${lifeStage(age, e.sex)} · ${fmtAge(e.status === 'dead' ? e.ageAtDeath : age)} · ${e.family === 'Tembo' ? 'Travelling bull' : `${escapeHtml(e.family)}’s family`}</div>
        ${statusLine}
        <div class="bond" title="Your bond">${Array.from({ length: 5 }, (_, i) => `<span class="${i < hearts ? 'on' : ''}">${ICONS.heart}</span>`).join('')}<label>Bond with you</label></div>
        ${e.status === 'dead' ? '' : `<div class="stat"><label>Health</label><div class="bar h"><i style="width:${e.health}%"></i></div></div>
        <div class="stat"><label>Happiness</label><div class="bar j"><i style="width:${e.happiness}%"></i></div></div>`}
        <p class="trait"><b>${cap(e.trait)}.</b> ${escapeHtml(traitLine(e.trait, e.sex))}</p>
        <p><b>Loves:</b> ${escapeHtml(e.loves)}</p>
        <p class="rel">${rel.join('<br>') || 'No close kin in the herd.'}</p>
        <p class="bday">Birthday: ${bd.getUTCDate()} ${MONTHS[bd.getUTCMonth()]}</p>
        <div class="row">${e.status === 'herd' ? `<button class="btn primary" id="pComfort">${ICONS.heart}Comfort</button><button class="btn ghost" id="pFind">${ICONS.eye}Find</button>` : ''}
        ${e.status === 'wandering' ? `<button class="btn primary" id="pCall">${ICONS.call}Call back</button>` : ''}</div>
      </div>`,
      `${ICONS.elephant} Profile`
    );
    this.portraitInto(body.querySelector('.profile-hero img'), e);
    body.querySelectorAll('a[data-id]').forEach((a) => (a.onclick = () => this.openProfile(a.dataset.id)));
    const c = body.querySelector('#pComfort');
    if (c) c.onclick = () => {
      this.closeSheet();
      this.select(e.id);
      this.app.renderer.focusOn(e.id);
      setTimeout(() => this.comfort(e.id), 350);
    };
    const f = body.querySelector('#pFind');
    if (f) f.onclick = () => {
      this.closeSheet();
      this.select(e.id);
      this.app.renderer.focusOn(e.id);
    };
    const cb = body.querySelector('#pCall');
    if (cb) cb.onclick = () => {
      this.callBack(e.id);
      this.openProfile(e.id);
    };
  }

  openJournal(refresh = false) {
    const log = this.game.state.log.slice(0, 120);
    const html = `<ul class="journal">${log
      .map((l) => {
        const d = localDate(l.t);
        return `<li class="${l.kind}"><time>${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} · ${fmtClock(d.getUTCHours() + d.getUTCMinutes() / 60)}</time>${escapeHtml(l.text)}</li>`;
      })
      .join('')}</ul>`;
    if (refresh) {
      const j = $('#sheetBody .journal');
      if (j && j.children.length !== log.length) $('#sheetBody').innerHTML = html;
      return;
    }
    this.openSheet('journal', html, `${ICONS.book} Journal`);
  }

  openMenu() {
    const env = this.env;
    const now = env.now();
    const key = env.seasonKey(now);
    const season = SEASONS[key];
    const { rise, set } = env.sunTimes(now);
    const w = env.weather(now);
    const meta = store.meta();
    const left = store.playsLeft(meta);
    const d = localDate(now);
    const s = this.game.state;
    const days = s ? Math.floor((now - s.startedAt) / DAY) : 0;
    const body = this.openSheet(
      'menu',
      `<div class="season-card ${key}">
        <div class="kicker">${LOCATION.name} · ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}</div>
        <h3>${season.name}${season.local ? ` <small>${season.local}</small>` : ''}</h3>
        <p>${season.blurb}</p>
        <div class="facts">
          <span>${ICONS.sun} Sunrise ${fmtClock(rise)}</span><span>${ICONS.moon} Sunset ${fmtClock(set)}</span>
          <span>${w.raining ? ICONS.rain : ICONS.cloud} ${w.raining ? 'Raining' : w.cloud > 0.6 ? 'Cloudy' : 'Clear'}, ${w.temp}°C</span>
          <span>${ICONS.moon} ${env.moonName(now)}</span>
        </div>
      </div>
      <div class="menu-stats">
        <div><b>${days}</b><span>days together</span></div>
        <div><b>${s ? s.stats.repelled : 0}</b><span>threats stopped</span></div>
        <div><b>${s ? s.stats.births : 0}</b><span>calves born</span></div>
        <div><b>${left}</b><span>journeys left</span></div>
      </div>
      <div class="menu-list">
        <button class="mitem" id="mJournal">${ICONS.book}<span>Journal</span></button>
        <button class="mitem" id="mHow">${ICONS.info}<span>How to care for your herd</span></button>
        <button class="mitem" id="mSound">${this.app.settings.sound ? ICONS.sound : ICONS.mute}<span>Sound: ${this.app.settings.sound ? 'On' : 'Off'}</span></button>
        <button class="mitem" id="mReal">${ICONS.leaf}<span>The real elephants of Amboseli</span></button>
        ${store.devUnlocked() ? `<button class="mitem dev" id="mDev">${ICONS.wrench}<span>Dev mode</span></button>` : ''}
      </div>
      <p class="version" id="version">37 Elephants v${VERSION} · Time runs in real Amboseli time (${LOCATION.tzLabel}, UTC+${LOCATION.utcOffset})</p>`,
      `${ICONS.menu} Menu`
    );
    body.querySelector('#mJournal').onclick = () => this.openJournal();
    body.querySelector('#mHow').onclick = () => this.openHow();
    body.querySelector('#mReal').onclick = () => this.openReal();
    body.querySelector('#mSound').onclick = () => {
      this.app.setSound(!this.app.settings.sound);
      this.openMenu();
    };
    const dev = body.querySelector('#mDev');
    if (dev) dev.onclick = () => this.app.dev.open();
    // Secret: tap the version line 7 times to unlock Dev Mode.
    let taps = 0;
    body.querySelector('#version').onclick = () => {
      if (++taps >= 7 && !store.devUnlocked()) {
        store.setDev(true);
        this.toast('Dev mode unlocked', 'good');
        this.openMenu();
      }
    };
  }

  openHow() {
    this.openSheet(
      'how',
      `<div class="how">
        <p>The herd lives in <b>real time</b>, on Amboseli’s clock and seasons. Check in through the day; the sun you see is rising and setting over Kilimanjaro right now.</p>
        <h4>${ICONS.water} Water &amp; ${ICONS.grass} Grazing</h4>
        <p>Thirst and hunger build over hours, faster in the heat of midday and the long dry season. Lead the herd to the waterhole or out to graze. In the dry season the waterhole shrinks and the grass is poor, so trips give less.</p>
        <h4>${ICONS.gather} Gather</h4>
        <p>When lions or hyenas stalk the calves, gather the herd. Adults form a circle with the young inside, just as real elephants do.</p>
        <h4>${ICONS.shield} Rangers</h4>
        <p>Only rangers can stop poachers. They can also find lost elephants. After a call they need time to patrol before you can call them again.</p>
        <h4>${ICONS.call} Wanderers</h4>
        <p>Curious youngsters and restless young bulls drift away. Tap them (or the arrow at the edge of the screen) and call them back before they’re lost.</p>
        <h4>${ICONS.heart} Comfort</h4>
        <p>Tap any elephant, then Comfort. It lifts their spirits, eases injuries and grief, and deepens your bond.</p>
        <h4>${ICONS.moon} While you’re away</h4>
        <p>The matriarchs lead the herd to water and food on their own, but they can’t stop everything. Dangers still happen while you’re gone, though the herd defends itself better than you might fear.</p>
        <p class="note">You have ${store.maxPlays()} journeys in total. When the last elephant is gone, that journey ends.</p>
      </div>`,
      `${ICONS.info} How to play`
    );
  }

  openReal() {
    this.openSheet(
      'real',
      `<div class="how">
        <p>Amboseli National Park lies in southern Kenya, just north of Kilimanjaro. Its elephants have been studied continuously since 1972 by the Amboseli Elephant Research Project, which is why so much is known about their families, personalities and memories.</p>
        <p>Many things in this game are drawn from that knowledge. Families are led by an old female, the matriarch, whose memory of water and danger keeps everyone alive. Calves are raised by the whole family, with young females acting as “allomothers”. Young males leave in their teens. When an elephant dies, others often return to touch the body and the bones.</p>
        <p>Real Amboseli has two rainy seasons, the long rains around March to May and the short rains around November and December, with dry months in between. In the long dry season the herds rely on swamps fed by meltwater and springs from Kilimanjaro.</p>
        <p>Poaching for ivory and conflict with people are still real threats to elephants across Africa. If this herd found a place in your heart, consider supporting the people who protect the real ones, such as the <a href="https://www.elephanttrust.org" target="_blank" rel="noopener">Amboseli Trust for Elephants</a>.</p>
      </div>`,
      `${ICONS.leaf} Real elephants`
    );
  }

  showAway({ duration, entries }) {
    const important = entries.filter((e) => e.kind !== 'joy' && e.kind !== 'info');
    const html = `<div class="away">
      <p class="lede">You were away for <b>${fmtDuration(duration)}</b>. Here’s what happened in Amboseli.</p>
      ${important.length ? `<ul class="journal">${important.map((l) => `<li class="${l.kind}">${escapeHtml(l.text)}</li>`).join('')}</ul>` : '<p class="empty">A quiet time. The matriarchs kept everyone safe, fed and watered.</p>'}
      <button class="btn primary wide" id="awayOk">Back to the herd</button></div>`;
    const body = this.openSheet('away', html, `${ICONS.moon} While you were away`);
    body.querySelector('#awayOk').onclick = () => this.closeSheet();
  }
}

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function causeShort(c) {
  return { lions: 'Lions', hyenas: 'Hyenas', poachers: 'Poachers', thirst: 'Thirst', hunger: 'Hunger', lost: 'Lost', 'old age': 'Old age', weakness: 'Weakness' }[c] || 'Gone';
}
function causeLong(c) {
  return { lions: 'was taken by lions', hyenas: 'was taken by hyenas', poachers: 'was killed by poachers', thirst: 'died of thirst', hunger: 'died of hunger', lost: 'was lost on the plains', 'old age': 'died peacefully of old age', weakness: 'grew too weak' }[c] || 'is gone';
}

function fmtShort(ms) {
  const m = Math.ceil(ms / MIN);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}
