// Versioned localStorage saves: three manual slots and one automatic continuation.
import { SAVE_VERSION, PLAYER_CONFIG } from './config.js';
import { MISSION_DEFINITIONS } from './missions.js';
const PREFIX = 'cielo-mar-v3';

function finiteAmmo(values) {
  return values.map((value) => Number.isFinite(value) ? value : -1);
}

function restoreAmmo(values, fallback) {
  return values.map((value, index) => value === -1 ? Infinity : Number.isFinite(value) ? value : fallback[index]);
}

export class SaveSystem {
  constructor() {
    this.available = true;
    try { window.localStorage.getItem(`${PREFIX}:probe`); } catch { this.available = false; }
  }

  key(slot) { return `${PREFIX}:${slot}`; }

  read(slot = 'auto') {
    if (!this.available) return null;
    try {
      const raw = window.localStorage.getItem(this.key(slot));
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data.version === SAVE_VERSION ? data : null;
    } catch { return null; }
  }

  write(slot, game) {
    if (!this.available) return false;
    const position = game.player.vehicle?.position || game.player.position;
    const data = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      missionIndex: game.missions.missionIndex,
      completedCount: game.missions.completedCount,
      cash: Math.round(game.cash), respect: game.respect,
      health: game.player.health, armour: game.player.armour,
      stamina: game.player.stamina,
      ammo: finiteAmmo(game.player.ammo), reserves: finiteAmmo(game.player.reserves),
      currentWeapon: game.player.currentWeapon,
      upgrades: { extendedMags: game.player.extendedMags, improvedSpread: game.player.improvedSpread },
      position: { x: position.x, z: position.z },
      heading: game.player.vehicle?.heading ?? game.player.heading,
      vehicle: game.player.vehicle ? { type: game.player.vehicle.type, heading: game.player.vehicle.heading } : null,
      night: game.night,
    };
    try {
      window.localStorage.setItem(this.key(slot), JSON.stringify(data));
      return true;
    } catch { return false; }
  }

  autosave(game) { return this.write('auto', game); }
  saveSlot(game, slot) { return this.write(`slot-${slot}`, game); }
  hasAutosave() { return !!this.read('auto'); }
  slotSummary(slot) {
    const data = this.read(`slot-${slot}`);
    return data ? { mission: data.completedCount, cash: data.cash, date: data.savedAt, title: MISSION_DEFINITIONS[data.missionIndex]?.title } : null;
  }

  load(data, game) {
    if (!data) return false;
    game.cash = data.cash;
    game.respect = data.respect;
    game.missions.resetProgress(data.missionIndex, data.completedCount);
    game.player.health = data.health ?? PLAYER_CONFIG.health;
    game.player.armour = data.armour ?? 0;
    game.player.stamina = data.stamina ?? 100;
    game.player.ammo = restoreAmmo(data.ammo, [Infinity, 12, 30, 8]);
    game.player.reserves = restoreAmmo(data.reserves, [Infinity, 84, 150, 48]);
    game.player.extendedMags = !!data.upgrades?.extendedMags;
    game.player.improvedSpread = !!data.upgrades?.improvedSpread;
    game.player.currentWeapon = 0;
    game.player.selectWeapon(data.currentWeapon || 0, game);
    if (game.vehicles.playerVehicle) game.vehicles.exitVehicle(game);
    game.player.teleport(data.position.x, data.position.z, data.heading);
    if (data.vehicle) {
      const car = game.vehicles.spawnVehicle(data.vehicle.type, data.position.x, data.position.z, data.vehicle.heading || 0, { colour: data.vehicle.type === 'vela' ? 0xc7552d : undefined });
      game.vehicles.stealVehicle(car, game);
    }
    game.cameraYaw = data.heading + Math.PI;
    game.night = data.night || 0;
    game.renderer.setNight(game.night);
    return true;
  }
}
