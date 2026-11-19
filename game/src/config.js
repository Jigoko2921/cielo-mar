// CIELO MAR's shared art direction, simulation tuning and deterministic random source.
export const GAME_TITLE = 'CIELO MAR';
export const SAVE_VERSION = 3;
export const FIXED_STEP = 1 / 60;
export const METRES_PER_UNIT = 1.8;

export const PALETTE = Object.freeze({
  skyTop: 0x7fb7c9, skyHorizon: 0xf7c98b, haze: 0xe8c9a0,
  sea: 0x2f8f9d, deepSea: 0x1d6b78, sand: 0xe6d3ae,
  terracotta: 0xb4593c, cream: 0xefe2c8, foliage: 0x3f6b4a,
  asphalt: 0x3a3a3c, amber: 0xffb347, turquoise: 0x35d0c0,
  danger: 0xe4572e, ink: 0x101214, white: 0xf8efd9,
  pavement: 0xbfb6a5, shadow: 0x29333a,
});

export const CSS_COLOURS = Object.freeze({
  amber: '#ffb347', turquoise: '#35d0c0', danger: '#e4572e',
  cream: '#efe2c8', charcoal: 'rgba(16,18,20,0.82)',
});

export const WORLD = Object.freeze({
  halfSize: 430, seaStart: 342, seaEnd: 1100, roadWidth: 15,
  roadCoords: Object.freeze([-380, -285, -190, -95, 0, 95, 190, 285, 380]),
  laneOffset: 3.15, sidewalkWidth: 4.4, blockEdge: 8.5,
  gravity: 24, maxTraffic: 30, maxPedestrians: 52,
});

export const PLAYER_CONFIG = Object.freeze({
  walkSpeed: 5.5, sprintSpeed: 10.2, crouchSpeed: 2.8,
  jumpSpeed: 8.2, radius: 0.52, height: 1.82,
  staminaDrain: 22, staminaRecovery: 16, health: 100, armour: 35,
});

export const WEAPONS = Object.freeze([
  { id: 'fists', name: 'Fists', short: 'FST', magazine: Infinity, damage: 18, rate: 0.48, range: 2.2, spread: 0, reload: 0, auto: false },
  { id: 'pistola', name: 'Pistola', short: 'PST', magazine: 12, damage: 34, rate: 0.29, range: 85, spread: 0.014, reload: 1.25, auto: false },
  { id: 'subfusil', name: 'Subfusil', short: 'SMG', magazine: 30, damage: 17, rate: 0.09, range: 72, spread: 0.027, reload: 1.65, auto: true },
  { id: 'escopeta', name: 'Escopeta', short: 'SG', magazine: 8, damage: 17, rate: 0.78, range: 40, spread: 0.075, pellets: 7, reload: 1.8, auto: false },
]);

export const VEHICLES = Object.freeze({
  vela: { name: 'Vela GT', kind: 'coupe', maxSpeed: 35, acceleration: 18, grip: 5.2, steering: 1.85, width: 1.95, length: 4.65, colours: [0xc7552d, 0xe0b143, 0x335f70, 0xede2c9] },
  brisa: { name: 'Brisa 4', kind: 'sedan', maxSpeed: 28, acceleration: 13, grip: 6.5, steering: 1.65, width: 1.9, length: 4.5, colours: [0x668c8d, 0xdbc99f, 0x384f59, 0xa25442] },
  mulo: { name: 'Mulo', kind: 'pickup', maxSpeed: 25, acceleration: 12, grip: 6, steering: 1.55, width: 2.05, length: 5.05, colours: [0x8e5038, 0x617052, 0xd3c4a2] },
  panera: { name: 'Panera', kind: 'van', maxSpeed: 23, acceleration: 10, grip: 6.8, steering: 1.4, width: 2.15, length: 5.25, colours: [0xe3d2ac, 0x4b8c87, 0xc28c3c] },
  amarillo: { name: 'Amarillo', kind: 'taxi', maxSpeed: 28, acceleration: 13, grip: 6.2, steering: 1.65, width: 1.9, length: 4.55, colours: [0xe7ad32] },
  police: { name: 'PCM Unidad', kind: 'police', maxSpeed: 33, acceleration: 17, grip: 6, steering: 1.8, width: 1.98, length: 4.75, colours: [0x1c3947] },
  suv: { name: 'PCM Fuerte', kind: 'suv', maxSpeed: 29, acceleration: 15, grip: 6.5, steering: 1.55, width: 2.12, length: 4.95, colours: [0x14232b] },
  boat: { name: 'Sirena 27', kind: 'boat', maxSpeed: 31, acceleration: 12, grip: 2.8, steering: 1.2, width: 2.45, length: 7.2, colours: [0xede3ca, 0x358b91] },
});

export const DISTRICT_TABLE = Object.freeze([
  { id: 'marina', name: 'MARINA VERDE', minHeight: 10, maxHeight: 31, colours: [0xefe2c8, 0xdca675, 0xc87957, 0xe9cfad] },
  { id: 'centro', name: 'CENTRO VIEJO', minHeight: 8, maxHeight: 16, colours: [0xefe2c8, 0xdbb47e, 0xb96c4f, 0xe7ccaa] },
  { id: 'puerto', name: 'PUERTO AZUL', minHeight: 7, maxHeight: 13, colours: [0xa5aba4, 0xbaac90, 0x7e9591, 0xc3b697] },
  { id: 'palmas', name: 'LAS PALMAS', minHeight: 7, maxHeight: 14, colours: [0xf0ddbd, 0xd59e73, 0xe9c59e] },
  { id: 'norte', name: 'ZONA NORTE', minHeight: 7, maxHeight: 18, colours: [0xa69e87, 0x8b8c7b, 0xb18466] },
  { id: 'cienaga', name: 'LA CIÉNAGA', minHeight: 6, maxHeight: 13, colours: [0xc77b55, 0xe0b466, 0x77a09a, 0xd6936e, 0xb6bd8a] },
]);

export const LOCATIONS = Object.freeze({
  safehouse: { x: -136, z: 88 },
  foodCart: { x: -123, z: 104 },
  marinaHotel: { x: -78, z: 271 },
  garage: { x: 76, z: -70 },
  warehouse: { x: 246, z: 177 },
  pier: { x: -230, z: 408 },
  villa: { x: -274, z: -244 },
  motel: { x: 82, z: -292 },
  airstrip: { x: 286, z: -346 },
  plaza: { x: -42, z: 48 },
  raceStart: { x: -8, z: 278 },
  delivery: { x: 143, z: 84 },
});

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function angleDelta(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
export function distance2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export function createRandom(seed = 1) {
  let state = (Number(seed) || 1) >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function choose(random, values) { return values[Math.floor(random() * values.length) % values.length]; }

export function districtAt(x, z) {
  if (z > 232) return DISTRICT_TABLE[0];
  if (x < -180 && z < -95) return DISTRICT_TABLE[3];
  if (z < -190 && x > -125) return DISTRICT_TABLE[4];
  if (x > 145 && z > 45) return DISTRICT_TABLE[2];
  if (x < -72 && z > 12) return DISTRICT_TABLE[5];
  return DISTRICT_TABLE[1];
}
