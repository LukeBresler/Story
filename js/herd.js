// The 37 elephants: who they are, how they're related, what they love.
import { YEAR, uid, pick, rand } from './util.js';

// [name, meaning (Swahili), sex, age, family, mother, trait, loves]
const ROSTER = [
  // Bibi's family — the matriarch's line
  ['Bibi', 'grandmother', 'F', 58, 'Bibi', null, 'wise', 'leading the herd to the Enkongo Narok swamp'],
  ['Machweo', 'sunset', 'F', 55, 'Bibi', null, 'gentle', 'resting in the last warm light of the day'],
  ['Neema', 'grace', 'F', 38, 'Bibi', 'Bibi', 'gentle', 'dust baths at dusk'],
  ['Imani', 'faith', 'F', 34, 'Bibi', 'Bibi', 'protective', 'standing guard while the others sleep'],
  ['Mosi', 'firstborn', 'F', 22, 'Bibi', 'Bibi', 'steady', 'sweet acacia pods'],
  ['Zawadi', 'gift', 'F', 16, 'Bibi', 'Neema', 'playful', 'splashing in the shallows'],
  ['Jasiri', 'brave', 'M', 13, 'Bibi', 'Imani', 'bold', 'sparring with the other young bulls'],
  ['Mawingu', 'clouds', 'F', 10, 'Bibi', null, 'shy', 'staying close to Machweo, who adopted her'],
  ['Nuru', 'light', 'F', 7, 'Bibi', 'Imani', 'dreamy', 'gazing at the snow on Kilimanjaro'],
  ['Hazina', 'treasure', 'M', 7, 'Bibi', 'Mosi', 'curious', 'poking his trunk into everything'],
  ['Tamu', 'sweet', 'F', 4, 'Bibi', 'Neema', 'curious', 'chasing the white egrets'],
  ['Pili', 'second-born', 'F', 3, 'Bibi', 'Mosi', 'cheeky', 'stealing grass from her mother’s mouth'],
  ['Kito', 'jewel', 'M', 1.5, 'Bibi', 'Imani', 'clumsy', 'trying (and failing) to use his trunk'],
  ['Asali', 'honey', 'F', 0.4, 'Bibi', 'Zawadi', 'sleepy', 'napping in her mother’s shade'],

  // Taji's family
  ['Taji', 'crown', 'F', 51, 'Taji', null, 'wise', 'the shade of the yellow fever trees'],
  ['Faraja', 'comfort', 'F', 44, 'Taji', null, 'gentle', 'calming frightened calves'],
  ['Upendo', 'love', 'F', 29, 'Taji', 'Taji', 'affectionate', 'twining trunks with her sisters'],
  ['Subira', 'patience', 'F', 26, 'Taji', 'Taji', 'steady', 'long, slow mornings of grazing'],
  ['Nyota', 'star', 'F', 19, 'Taji', 'Faraja', 'graceful', 'moonlit walks'],
  ['Shujaa', 'hero', 'M', 16, 'Taji', 'Taji', 'restless', 'wandering toward the bull areas'],
  ['Moyo', 'heart', 'F', 12, 'Taji', 'Subira', 'caring', 'babysitting the youngest calves'],
  ['Furaha', 'joy', 'F', 9, 'Taji', 'Upendo', 'playful', 'running circles around the herd, ears out'],
  ['Jua', 'sun', 'M', 5, 'Taji', 'Faraja', 'sunny', 'tossing grass over his head'],
  ['Baraka', 'blessing', 'M', 2, 'Taji', 'Upendo', 'cuddly', 'sleeping curled against Furaha'],
  ['Mvua', 'rain', 'M', 0.8, 'Taji', 'Subira', 'curious', 'puddles — the muddier the better'],

  // Amani's family
  ['Amani', 'peace', 'F', 47, 'Amani', null, 'wise', 'quiet waterholes at dawn'],
  ['Tumaini', 'hope', 'F', 31, 'Amani', 'Amani', 'hopeful', 'the smell of the first rains'],
  ['Pendo', 'love', 'F', 25, 'Amani', 'Amani', 'nurturing', 'deep, cool mud wallows'],
  ['Upepo', 'wind', 'F', 18, 'Amani', 'Amani', 'restless', 'feeling the wind in her ears'],
  ['Hodari', 'strong', 'M', 14, 'Amani', 'Amani', 'bold', 'pushing over small trees'],
  ['Kesho', 'tomorrow', 'F', 11, 'Amani', 'Tumaini', 'dreamy', 'lagging behind to watch the birds'],
  ['Alfajiri', 'dawn', 'F', 8, 'Amani', 'Pendo', 'cheeky', 'waking everyone up first'],
  ['Tulivu', 'calm', 'M', 6, 'Amani', 'Tumaini', 'shy', 'hiding behind his mother’s legs'],
  ['Rafiki', 'friend', 'M', 3, 'Amani', 'Pendo', 'friendly', 'greeting everyone with a trunk-touch'],
  ['Bahati', 'luck', 'M', 0.6, 'Amani', 'Upepo', 'clumsy', 'tripping over his own trunk'],
  ['Zuri', 'beautiful', 'F', 0.2, 'Amani', 'Tumaini', 'sleepy', 'milk, and her mother’s legs'],

  // A big bull travelling with the families this season
  ['Tembo', 'elephant', 'M', 34, 'Tembo', null, 'gentle giant', 'scratching his back on acacia trunks'],
];

export const CALF_NAMES = [
  ['Safari', 'journey'], ['Jioni', 'evening'], ['Mwezi', 'moon'], ['Tabasamu', 'smile'],
  ['Wema', 'kindness'], ['Hekima', 'wisdom'], ['Umoja', 'unity'], ['Uhuru', 'freedom'],
  ['Ziwa', 'lake'], ['Sifa', 'praise'], ['Kipenzi', 'darling'], ['Tatu', 'third'],
  ['Shwari', 'calm'], ['Kilima', 'hill'], ['Dafina', 'treasure'], ['Nyati', 'buffalo'],
];

export const FAMILY_COLORS = { Bibi: '#f4a261', Taji: '#8ecae6', Amani: '#b5e48c', Tembo: '#cdb4db' };

const TRAIT_LINES = {
  wise: 'She remembers droughts from before most of the herd was born, and where the water was.',
  gentle: 'Soft-footed and patient; the calves drift toward her without thinking.',
  protective: 'The first to turn and face anything that moves in the grass.',
  steady: 'Unhurried, reliable, always exactly where she should be.',
  playful: 'Never walks where she could bounce instead.',
  bold: 'Tests everyone and everything, including his own mother’s patience.',
  shy: 'Watches everything from just behind someone bigger.',
  dreamy: 'Often found standing still, looking at something only she can see.',
  curious: 'Has to touch, smell and taste everything new.',
  cheeky: 'Knows exactly which rules can be bent.',
  clumsy: 'Still working out which leg goes where.',
  sleepy: 'Spends most of the day asleep, and all of it adorable.',
  affectionate: 'Greets family with rumbles, ear-flaps and a trunk in the mouth.',
  graceful: 'Moves so quietly you forget something that big is walking.',
  restless: 'Always looking at the horizon.',
  caring: 'An allomother in training: she mothers every calf that will let her.',
  sunny: 'Treats every morning as the best morning yet.',
  cuddly: 'Will lean on anyone who stands still long enough.',
  hopeful: 'The first to lift her trunk and smell rain coming.',
  nurturing: 'Her calves are always the cleanest, and the muddiest.',
  friendly: 'Has never met an elephant, bird or warthog he didn’t like.',
  'gentle giant': 'Six tonnes of calm. The calves climb on him when he lies down.',
};

export function traitLine(trait, sex) {
  const s = TRAIT_LINES[trait] || '';
  if (sex === 'M') return s.replace(/\bShe\b/g, 'He').replace(/\bshe\b/g, 'he').replace(/\bher\b/g, 'his');
  return s;
}

export function toneFor(seed) {
  // Warm, slightly reddish greys (Amboseli dust).
  const n = (seed * 9301 + 49297) % 233280 / 233280;
  return { h: 18 + n * 14, s: 6 + n * 7, l: 40 + n * 12 };
}

export function createHerd(now) {
  const byName = {};
  const herd = ROSTER.map((r, i) => {
    const [name, meaning, sex, age, family, , trait, loves] = r;
    const e = {
      id: uid(),
      name,
      meaning,
      sex,
      birth: now - age * YEAR - rand(0, 0.9) * YEAR * (age >= 1 ? 1 : 0),
      family,
      motherId: null,
      trait,
      loves,
      health: 90 + rand(0, 10),
      happiness: 70 + rand(0, 20),
      bond: 10,
      status: 'herd',
      tone: toneFor(i + 3),
      tuskless: name === 'Upendo',
      lastPet: 0,
    };
    byName[name] = e;
    return e;
  });
  ROSTER.forEach((r, i) => {
    if (r[5]) herd[i].motherId = byName[r[5]].id;
  });
  byName.Mawingu.adoptiveId = byName.Machweo.id;
  return herd;
}

export function makeCalf(mother, now, usedNames) {
  const free = CALF_NAMES.filter(([n]) => !usedNames.has(n));
  const [name, meaning] = free.length ? pick(free) : [`Little ${mother.name}`, `${mother.name}’s calf`];
  const sex = Math.random() < 0.5 ? 'F' : 'M';
  return {
    id: uid(),
    name,
    meaning,
    sex,
    birth: now,
    family: mother.family,
    motherId: mother.id,
    trait: pick(['sleepy', 'curious', 'clumsy', 'cuddly', 'playful']),
    loves: 'milk, and the shade under her mother',
    health: 100,
    happiness: 95,
    bond: 20,
    status: 'herd',
    tone: toneFor(Math.floor(Math.random() * 1000)),
    tuskless: false,
    lastPet: 0,
    newborn: true,
  };
}

export function ageOf(e, now) {
  return Math.max(0, (now - e.birth) / YEAR);
}

export function lifeStage(age, sex) {
  if (age < 1) return 'Newborn calf';
  if (age < 5) return 'Calf';
  if (age < 10) return 'Juvenile';
  if (age < 16) return sex === 'M' ? 'Young bull' : 'Young female';
  if (age < 45) return sex === 'M' ? 'Bull' : 'Adult female';
  return sex === 'M' ? 'Old bull' : 'Elder';
}

export function pronouns(e) {
  return e.sex === 'M' ? { sub: 'he', obj: 'him', pos: 'his' } : { sub: 'she', obj: 'her', pos: 'her' };
}

// Little glimpses of life, shown as the "herd whisper".
const AMBIENT = {
  any: [
    '{n} is tossing red dust over {pos} back.',
    '{n} rumbles softly to the others.',
    '{n} is scratching against an acacia trunk.',
    '{n} flaps {pos} ears to cool down.',
    'An egret rides on {n}’s back for a while.',
    '{n} rests {pos} trunk over a tusk.',
    '{n} greets {f} with a trunk-touch.',
  ],
  calf: [
    '{n} tried to charge a warthog, then ran back to mum.',
    '{n} is sucking {pos} trunk, like a thumb.',
    '{n} fell asleep mid-step. {f} waits for {obj}.',
    '{n} is attempting to drink with {pos} trunk. Mostly failing.',
    '{n} is chasing the egrets again.',
  ],
  night: [
    '{n} sleeps standing, leaning on {f}.',
    'The calves lie down in a heap. {n} is at the bottom.',
    '{n} lifts {pos} trunk to test the night air.',
  ],
  rain: ['{n} lifts {pos} trunk into the rain.', '{n} is rolling in a fresh puddle.'],
};

export function ambientLine(herd, env, now) {
  const alive = herd.filter((e) => e.status === 'herd');
  if (!alive.length) return null;
  const e = pick(alive);
  const f = pick(alive.filter((x) => x !== e && x.family === e.family)) || pick(alive);
  const age = ageOf(e, now);
  let pool = AMBIENT.any;
  if (env.isNight(now)) pool = AMBIENT.night;
  else if (env.weather(now).raining && Math.random() < 0.6) pool = AMBIENT.rain;
  else if (age < 5 && Math.random() < 0.7) pool = AMBIENT.calf;
  const p = pronouns(e);
  return pick(pool)
    .replace(/\{n\}/g, e.name)
    .replace(/\{f\}/g, f ? f.name : 'the herd')
    .replace(/\{pos\}/g, p.pos)
    .replace(/\{obj\}/g, p.obj);
}
