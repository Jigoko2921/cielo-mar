// CIELO MAR — the tunables and the tables behind everything: the golden-hour palette, the six
// districts and their heights and colours, cars, weapons, safehouses, garages and mission spots.
// A number lives here when two other files must agree on it.

export const PALETTE = {
  skyTop: 0x7fb7c9,
  skyHorizon: 0xf7c98b,
  haze: 0xe8c9a0,
  sea: 0x2f8f9d,
  seaDeep: 0x1d6b78,
  sand: 0xe6d3ae,
  terracotta: 0xb4593c,
  cream: 0xefe2c8,
  foliage: 0x3f6b4a,
  asphalt: 0x3a3a3c,
  sidewalk: 0xb9ae9a,
  amber: 0xffb347,
  turquoise: 0x35d0c0,
  danger: 0xe4572e,
  sun: 0xfff0d6,
  shadow: 0x2b3646,
  policeNavy: 0x14213f,
  policeWhite: 0xf3f0e6,
  policeStripe: 0x1fb6a6,
};

/** World size in metres: the city spans -CITY..CITY on both axes. Sea lies south of SEA_Z. */
export const CITY = 760;
export const SEA_Z = 600;
export const BLOCK = 80;
export const ROAD = 18;
export const SIDEWALK = 6;
export const PLAYER_HEIGHT = 1.75;
export const STEP = 1 / 60;

/** Six districts, each an axis-aligned rect over the grid with its own height, colour and props. */
export const DISTRICTS = [
  { id: 'marina', name: 'Marina Verde', x0: -760, x1: 60, z0: 300, z1: 600, height: 34, wall: 0xefe2c8, roof: 0xc98a63, kind: 'hotel' },
  { id: 'centro', name: 'Centro Viejo', x0: -320, x1: 120, z0: -40, z1: 300, height: 16, wall: 0xd9a86a, roof: 0x9e4b34, kind: 'colonial' },
  { id: 'puerto', name: 'Puerto Azul', x0: -760, x1: -320, z0: -40, z1: 360, height: 14, wall: 0x8d99a3, roof: 0x5b6a76, kind: 'docks' },
  { id: 'palmas', name: 'Las Palmas', x0: 120, x1: 760, z0: 40, z1: 420, height: 11, wall: 0xf4ead2, roof: 0xb46b4c, kind: 'villa' },
  { id: 'norte', name: 'Zona Norte', x0: -320, x1: 420, z0: -760, z1: -40, height: 24, wall: 0x9a938a, roof: 0x6c665d, kind: 'industrial' },
  { id: 'cienaga', name: 'La Ciénaga', x0: 420, x1: 760, z0: -760, z1: 40, height: 10, wall: 0xe0b07c, roof: 0xc0653f, kind: 'barrio' },
];

/** A few named places used by missions, the garage, the safehouse and the radio. */
export const LOCATIONS = {
  safehouse: { x: 60, z: -120, name: 'Safehouse' },
  garage: { x: -20, z: 210, name: 'Taller Sanchez' },
  hospital: { x: 160, z: 260, name: 'Hospital Costa' },
  marinaHotel: { x: -420, z: 420, name: 'Hotel Marisol' },
  pier: { x: -620, z: 560, name: 'Muelle Viejo' },
  cathedral: { x: -120, z: 60, name: 'Catedral' },
  plaza: { x: -20, z: 20, name: 'Plaza del Sol' },
  warehouse: { x: -600, z: 120, name: 'Almacen 14' },
  villa: { x: 520, z: 300, name: 'Quinta Marquez' },
  motel: { x: 180, z: -520, name: 'Motel Brisa' },
  airstrip: { x: 640, z: -620, name: 'Pista Norte' },
  stadium: { x: -100, z: -420, name: 'Estadio' },
  cienaga: { x: 600, z: -120, name: 'La Ciénaga' },
  docks: { x: -560, z: 220, name: 'Puerto Azul' },
};

/** Eight original cars plus a boat; geometry is built from boxes and wedges in vehicles.js. */
export const VEHICLE_SPECS = {
  vela: { name: 'Vela GT', kind: 'coupe', length: 4.5, width: 2.0, height: 1.15, mass: 1.0, engine: 17, top: 50, grip: 1.15, colors: [0xb53a2a, 0xe8c547, 0x2a2f38, 0xdfe6ea] },
  brisa: { name: 'Brisa 4', kind: 'sedan', length: 4.7, width: 2.0, height: 1.45, mass: 1.1, engine: 14, top: 42, grip: 1.05, colors: [0x6d8f7d, 0xd7cbb0, 0x8a3b34, 0x3d5a73] },
  mulo: { name: 'Mulo', kind: 'pickup', length: 5.2, width: 2.15, height: 1.75, mass: 1.35, engine: 13, top: 40, grip: 0.95, colors: [0x8d5b3f, 0x40484f, 0xb98b52] },
  panera: { name: 'Panera', kind: 'van', length: 5.6, width: 2.2, height: 2.35, mass: 1.5, engine: 11, top: 36, grip: 0.9, colors: [0xd7ccc0, 0x5f7a86, 0xb4a08a] },
  amarillo: { name: 'Amarillo', kind: 'taxi', length: 4.7, width: 2.0, height: 1.5, mass: 1.1, engine: 14, top: 42, grip: 1.05, colors: [0xe8b62c] },
  crucero: { name: 'PCM Unidad', kind: 'cruiser', length: 4.8, width: 2.05, height: 1.5, mass: 1.15, engine: 18, top: 48, grip: 1.1, colors: [0x14213f] },
  fuerte: { name: 'PCM Fuerte', kind: 'suv', length: 5.0, width: 2.2, height: 1.95, mass: 1.5, engine: 17, top: 45, grip: 1.0, colors: [0x14213f] },
  lancha: { name: 'Lancha Cielo', kind: 'boat', length: 6.0, width: 2.4, height: 1.4, mass: 1.2, engine: 20, top: 40, grip: 0.7, colors: [0xf4f1e8, 0x2f8f9d] },
};

export const WEAPONS = [
  { id: 'fists', name: 'Fists', clip: 0, reserve: 0, damage: 22, range: 2.2, spread: 0, rate: 0.32, auto: true, melee: true },
  { id: 'pistol', name: 'Pistola', clip: 12, reserve: 96, damage: 34, range: 90, spread: 0.012, rate: 0.22, auto: false, ammo: 0xf2d16b },
  { id: 'smg', name: 'Subfusil', clip: 30, reserve: 180, damage: 17, range: 70, spread: 0.03, rate: 0.075, auto: true, ammo: 0xcfd3d6 },
  { id: 'shotgun', name: 'Escopeta', clip: 8, reserve: 40, damage: 15, range: 32, spread: 0.09, rate: 0.85, auto: false, ammo: 0x9b6b3a, pellets: 7 },
];

export const GAME = {
  walk: 4.2,
  run: 8.4,
  sprint: 12.5,
  jump: 7.2,
  gravity: 24,
  staminaDrain: 18,
  staminaRegen: 14,
  healthRegenDelay: 8,
  healthMax: 100,
  armourMax: 100,
  hospitalFee: 250,
  resprayCost: 600,
  repairCost: 350,
  armourCost: 400,
  carjackHeat: 1,
  gunfireHeat: 1,
  hitsToKill: 3,
};

export const WANTED = {
  decay: 0.035,
  searchRadius: [0, 70, 95, 130, 170, 220],
  units: [0, 1, 2, 3, 3, 4],
  labels: ['CLEAR', 'WATCH', 'PURSUIT', 'BLOCKADE', 'AIR SUPPORT', 'LOCKDOWN'],
};

export const RADIO = [
  { id: 'costa', name: 'RADIO COSTA · Bolero', color: 0xffb347 },
  { id: 'neon', name: 'CIELO FM · Synthwave', color: 0x35d0c0 },
  { id: 'onda', name: 'ONDA VIEJA · Noticias', color: 0xe4572e },
];

export const RANKS = [
  { at: 0, name: 'NOVATO' },
  { at: 15, name: 'RECLUTA' },
  { at: 35, name: 'SOLDADO' },
  { at: 60, name: 'CAPITAN' },
  { at: 85, name: 'PATRON' },
];

/** Colours for the buildings' window strips, emissive at the ends of the day. */
export const WINDOW_GLOW = 0xffd98a;
export const SAVE_PREFIX = 'cielomar.save.';
export const SHOT_HIDE_CURSOR = true;
