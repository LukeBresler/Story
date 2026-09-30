// Game-wide constants and tunable defaults (all editable from Dev Mode).

export const VERSION = '1.0.0';
export const HERD_SIZE = 37;
export const MAX_PLAYS = 3;

// Amboseli National Park, southern Kenya, in the shadow of Kilimanjaro.
export const LOCATION = {
  name: 'Amboseli, Kenya',
  lat: -2.65,
  lon: 37.26,
  utcOffset: 3, // East Africa Time, no daylight saving
  tzLabel: 'EAT',
};

export const DEFAULT_SETTINGS = {
  timeSpeed: 1, // 1 = true real time
  seasonOverride: 'auto', // auto | short-dry | long-rains | long-dry | short-rains
  hourOverride: -1, // -1 = real Amboseli time, otherwise 0..23.99 local hour
  eventRate: 1, // multiplier on how often things happen
  lethality: 1, // multiplier on how dangerous unanswered threats are
  decayRate: 1, // multiplier on thirst / hunger
  threatWindowSec: 120, // real seconds you have to respond to a threat
  wanderGraceMin: 8, // real minutes before a wanderer becomes lost
  rangerCooldownMin: 90, // game minutes before rangers can be called again
  offlineLossCap: 1, // max elephants that can die per absence
  birthsEnabled: true,
  godMode: false, // nobody dies
  sound: true,
};

export const THREAT_INFO = {
  lions: {
    title: 'Lions in the grass',
    body: 'A pride is stalking the calves. Gather the herd so the adults can form a circle around the young.',
    counter: 'gather',
    lethal: 0.55,
  },
  hyenas: {
    title: 'Hyenas circling',
    body: 'A clan of hyenas is testing the edges of the herd. Gather the herd to close ranks.',
    counter: 'gather',
    lethal: 0.35,
  },
  poachers: {
    title: 'Poachers spotted',
    body: 'A vehicle with no lights is moving along the far edge of the park. Call the rangers now.',
    counter: 'rangers',
    lethal: 0.6,
  },
};
