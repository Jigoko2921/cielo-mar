// localStorage serialisation: three named slots plus an autosave. A slot holds the mission index,
// cash, respect, weapons and ammo, health and armour, the player's position and the current
// vehicle. Every read is defensive: a corrupt or absent slot returns null rather than throwing.

import { SAVE_PREFIX } from './config.js';

export const SLOT_NAMES = ['autosave', 'slot1', 'slot2', 'slot3'];

export function saveGame(world, slot = 'autosave') {
  const p = world.player;
  const car = world.player.inVehicle ? world.playerCar : null;
  const data = {
    version: 1,
    savedAt: Date.now(),
    missionIndex: world.missions.index,
    cash: world.cash,
    respect: world.respect,
    weapons: p.weapons.map((w) => ({ clip: w.clip, reserve: w.reserve })),
    current: p.current,
    upgrades: { ...p.upgrades },
    health: p.health,
    armour: p.armour,
    position: { x: p.position.x, z: p.position.z, facing: p.facing },
    vehicle: car ? { kind: car.kind, x: car.position.x, z: car.position.z, heading: car.heading } : null,
    district: world.city.districtNameAt(p.position.x, p.position.z),
    playTime: Math.round(world.time),
  };
  try {
    window.localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot = 'autosave') {
  try {
    const raw = window.localStorage.getItem(SAVE_PREFIX + slot);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function slotSummary(slot) {
  const data = loadGame(slot);
  if (!data) return null;
  return {
    slot,
    missionIndex: data.missionIndex ?? 0,
    cash: data.cash ?? 0,
    district: data.district ?? 'Cielo Mar',
    playTime: data.playTime ?? 0,
    savedAt: data.savedAt ?? 0,
  };
}

export function slotSummaries() {
  return SLOT_NAMES.map((slot) => ({ slot, summary: slotSummary(slot) }));
}

export function deleteSave(slot) {
  try {
    window.localStorage.removeItem(SAVE_PREFIX + slot);
    return true;
  } catch {
    return false;
  }
}

export function hasAnySave() {
  return SLOT_NAMES.some((slot) => loadGame(slot) !== null);
}

/** Apply a loaded save onto the world: player position, cash, weapons and the mission index. */
export function applySave(world, data) {
  if (!data) return false;
  world.cash = data.cash ?? 0;
  world.respect = data.respect ?? 0;
  world.missions.setIndex(data.missionIndex ?? 0);
  const p = world.player;
  p.position.set(data.position?.x ?? 0, 0.2, data.position?.z ?? 0);
  p.group.position.copy(p.position);
  p.facing = data.position?.facing ?? 0;
  p.health = data.health ?? 100;
  p.armour = data.armour ?? 0;
  p.current = data.current ?? 1;
  if (Array.isArray(data.weapons)) {
    data.weapons.forEach((w, i) => {
      if (p.weapons[i]) { p.weapons[i].clip = w.clip ?? 0; p.weapons[i].reserve = w.reserve ?? 0; }
    });
  }
  if (data.upgrades) p.upgrades = { ...p.upgrades, ...data.upgrades };
  world.pendingVehicle = data.vehicle ?? null;
  world.hud.setCash(world.cash, true);
  return true;
}

