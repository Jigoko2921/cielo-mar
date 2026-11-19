// CIELO MAR boot, deterministic simulation loop, camera, interactions and state wiring.
import { GAME_TITLE, FIXED_STEP, LOCATIONS, clamp, distance2D, angleDelta, createRandom } from './config.js';
import { InputController } from './input.js';
import { WorldRenderer } from './render.js';
import { City } from './city.js';
import { PlayerController } from './player.js';
import { VehicleSystem } from './vehicles.js';
import { PedestrianSystem } from './peds.js';
import { PoliceSystem } from './police.js';
import { GameHUD } from './hud.js';
import { MissionManager } from './missions.js';
import { ScreenManager } from './screens.js';
import { SaveSystem } from './save.js';
import { AudioSystem } from './audio.js';
import { stageShot } from './shots.js';

function reportFailure(message) {
  document.title = `ERR ${message}`;
  document.getElementById('status').textContent = String(message);
}
window.onerror = (message, source, line, column, error) => reportFailure(error?.message || message);
window.onunhandledrejection = (event) => reportFailure(event.reason?.message || event.reason);

function buildGame() {
  const parameters = new URLSearchParams(window.location.search);
  const shotMode = parameters.get('shot');
  const seed = Number(parameters.get('seed')) || 17041;
  const canvas = document.getElementById('game');
  const input = new InputController(canvas);
  const renderer = new WorldRenderer(canvas);
  const city = new City(renderer, seed);
  const audio = new AudioSystem();
  const screens = new ScreenManager();
  const hud = new GameHUD();
  const save = new SaveSystem();
  const vehicles = new VehicleSystem(renderer, city, seed);
  const peds = new PedestrianSystem(renderer, city, seed);
  const player = new PlayerController(renderer, city);
  const police = new PoliceSystem(renderer, city, vehicles);
  const missions = new MissionManager(renderer, city);
  const game = {
    canvas, input, renderer, city, audio, screens, hud, save, vehicles, peds, player, police, missions,
    seed, random: createRandom(seed), shotMode, state: shotMode ? 'shot' : 'title',
    elapsed: 0, cash: 350, respect: 0, night: 0, cameraYaw: Math.PI, cameraPitch: -0.08,
    cameraMouseTimer: 0, lastInteraction: '', activeShot: null,
  };
  vehicles.spawnParkedVehicles(24);
  vehicles.spawnTraffic(30);
  peds.spawnStreetCrowd(52);
  game.handlePlayerDeath = () => handlePlayerDeath(game);
  game.onAction = (action) => handleScreenAction(game, action);
  screens.onAction = game.onAction;
  hud.setVisible(false);
  screens.showTitle(save.hasAutosave());
  renderer.snapCamera(new THREE.Vector3(250, 86, 324), new THREE.Vector3(-30, 15, 40), 57);
  return game;
}

function startPlaying(game) {
  game.screens.hideAll();
  game.hud.setVisible(true);
  game.state = 'playing';
  game.input.enabled = true;
  game.audio.ensureContext();
  game.audio.setVolume(game.screens.volume);
  game.input.requestPointerLock();
}

function startNewGame(game) {
  game.cash = 350;
  game.respect = 0;
  game.night = 0;
  game.renderer.setNight(0);
  game.player.health = 100;
  game.player.armour = 0;
  game.player.stamina = 100;
  game.player.ammo = [Infinity, 12, 30, 8];
  game.player.reserves = [Infinity, 84, 150, 48];
  game.player.selectWeapon(0, game);
  game.police.wanted = 0;
  game.police.displayWanted = 0;
  game.player.teleport(-124, 99, Math.PI);
  game.cameraYaw = Math.PI;
  game.cameraPitch = -0.08;
  game.missions.resetProgress(0, 0);
  startPlaying(game);
  game.missions.startMission(0, game);
  game.renderer.cameraBase.set(-120, 4.5, 105);
}

function continueAutosave(game) {
  const data = game.save.read('auto');
  if (!data) { game.screens.showLoadNotice('NO AUTOSAVE YET · START A NEW GAME'); return; }
  game.save.load(data, game);
  startPlaying(game);
  game.hud.toast('WELCOME BACK', 'Autosave restored');
}

function pauseGame(game) {
  game.state = 'paused';
  game.input.releasePointerLock();
  game.screens.showPause(game);
}

function resumeGame(game) { startPlaying(game); }

function returnToTitle(game) {
  game.state = 'title';
  game.hud.setVisible(false);
  game.input.releasePointerLock();
  game.audio.stopEngine();
  game.screens.showTitle(game.save.hasAutosave());
}

function handlePlayerDeath(game) {
  if (game.state === 'dead') return;
  game.state = 'dead';
  game.missions.active = false;
  game.missions.data = {};
  game.missions.setTarget(null);
  game.input.releasePointerLock();
  game.audio.stopEngine();
  game.screens.showWasted(Math.min(200, game.cash));
}

function respawn(game) {
  const fee = Math.min(200, game.cash);
  game.cash -= fee;
  if (game.vehicles.playerVehicle) game.vehicles.exitVehicle(game);
  game.player.teleport(LOCATIONS.safehouse.x, LOCATIONS.safehouse.z + 8, 0);
  game.player.health = 100;
  game.player.armour = 15;
  game.player.stamina = 100;
  game.police.clearWanted('Hospital discharge');
  startPlaying(game);
}

function handleScreenAction(game, action) {
  game.audio.ensureContext();
  game.audio.uiClick();
  if (action === 'new') startNewGame(game);
  else if (action === 'continue') continueAutosave(game);
  else if (action === 'options-title') game.screens.showOptions('title');
  else if (action === 'options-pause') game.screens.showOptions('pause');
  else if (action === 'close-options') { game.audio.setVolume(game.screens.volume); game.screens.closeOptions(game); }
  else if (action === 'resume' || action === 'result-continue') resumeGame(game);
  else if (action === 'title') returnToTitle(game);
  else if (action === 'respawn') respawn(game);
  else if (action.startsWith('save-')) handleSaveSlot(game, action);
}

function handleSaveSlot(game, action) {
  const position = game.player.vehicle?.position || game.player.position;
  const atSafehouse = distance2D(position, LOCATIONS.safehouse) < 12;
  const slot = action === 'save-slot-3' ? 3 : action === 'save-slot-2' ? 2 : 1;
  if (!atSafehouse) {
    const data = game.save.read(`slot-${slot}`);
    if (data) {
      game.save.load(data, game);
      startPlaying(game);
      game.hud.toast('SLOT RESTORED', `Manual slot ${slot} loaded`);
    } else {
      game.hud.toast('SAVE AT SAFEHOUSE', 'Save manually in Rafa’s courtyard; load a slot away from home');
      game.screens.showPause(game);
    }
    return;
  }
  game.save.saveSlot(game, slot);
  game.save.autosave(game);
  game.hud.toast('SOUL ARCHIVED', `Manual slot ${slot} and autosave updated`);
  game.screens.showPause(game);
}

function buyGarageServices(game, action) {
  const playerPosition = game.player.vehicle?.position || game.player.position;
  if (distance2D(playerPosition, LOCATIONS.garage) > 14) return false;
  const car = game.player.vehicle;
  const charge = (cost) => {
    if (game.cash < cost) { game.hud.toast('GARAGE', `Need $${cost}`); return false; }
    game.cash -= cost;
    return true;
  };
  if (action === 'KeyU' && car && car.damage > 0 && charge(160)) {
    car.damage = 0;
    game.hud.toast('BODYWORK RESTORED', car.name);
  } else if (action === 'KeyB' && game.player.armour < 100 && charge(150)) {
    game.player.armour = 100;
    game.hud.toast('ARMOUR FITTED', 'Protection 100%');
  } else if (action === 'KeyY' && !game.player.extendedMags && charge(600)) {
    game.player.extendedMags = true;
    game.hud.toast('EXTENDED MAGAZINES', '+50% capacity');
  } else if (action === 'KeyN' && !game.player.improvedSpread && charge(450)) {
    game.player.improvedSpread = true;
    game.hud.toast('MATCH BARRELS', 'Tighter weapon spread');
  } else if (action === 'KeyT' && car && charge(100)) {
    car.respray = car.respray === 1 ? 2 : 1;
    car.body.material.color.setHex(car.respray === 1 ? 0x95d8cb : 0xf1b184);
    game.hud.toast('FRESH RESPRAY', car.respray === 1 ? 'Marina enamel' : 'Terracotta pearl');
  }
  return true;
}

function updateInteractions(game) {
  const input = game.input;
  const player = game.player;
  const position = player.vehicle?.position || player.position;
  let prompt = '';
  if (input.consume('KeyF')) {
    if (player.vehicle) game.vehicles.exitVehicle(game);
    else {
      const car = game.vehicles.findNearestVehicle(position, 4.6);
      if (car) game.vehicles.stealVehicle(car, game);
    }
  }
  if (input.consume('KeyR')) {
    if (player.vehicle) game.hud.toast('RADIO', game.audio.cycleRadio());
    else player.beginReload(game);
  }
  if (input.consume('KeyE')) {
    if (distance2D(position, LOCATIONS.safehouse) < 10) {
      game.save.saveSlot(game, 1);
      game.save.autosave(game);
      game.hud.toast('GAME SAVED', 'Rafa’s safehouse / autosave + slot 1');
    } else if (distance2D(position, LOCATIONS.garage) < 14) game.police.payAndSpray(game);
    else if (!game.missions.active && distance2D(position, LOCATIONS.foodCart) < 10) game.missions.startMission(game.missions.completedCount, game);
    else if (!game.missions.active && distance2D(position, LOCATIONS.delivery) < 12) game.missions.startDelivery(game);
    else if (!game.missions.active && distance2D(position, LOCATIONS.raceStart) < 12) game.missions.startRace(game);
  }
  for (const key of ['KeyU', 'KeyB', 'KeyY', 'KeyN', 'KeyT']) if (input.consume(key)) buyGarageServices(game, key);
  if (distance2D(position, LOCATIONS.safehouse) < 10) prompt = '[E] SAVE AT SAFEHOUSE';
  else if (distance2D(position, LOCATIONS.garage) < 14) prompt = '[E] PAY & SPRAY · [U] REPAIR · [B] ARMOUR · [Y/N] UPGRADES · [T] PAINT';
  else if (!game.missions.active && distance2D(position, LOCATIONS.foodCart) < 10) prompt = '[E] TALK TO INÉS / NEXT STORY';
  else if (!game.missions.active && distance2D(position, LOCATIONS.delivery) < 12) prompt = '[E] START COURIER DELIVERY';
  else if (!game.missions.active && distance2D(position, LOCATIONS.raceStart) < 12) prompt = '[E] START NIGHT STREET RACE';
  else if (!player.vehicle) {
    const car = game.vehicles.findNearestVehicle(position, 4.6);
    if (car) prompt = `[F] ${car.occupied ? 'STEAL' : 'ENTER'} ${car.name.toUpperCase()}`;
  } else prompt = '[F] EXIT VEHICLE · [R] RADIO';
  game.hud.setInteraction(prompt);
}

function updateCamera(game, deltaTime) {
  if (game.state === 'title') {
    const angle = game.elapsed * 0.018;
    const position = new THREE.Vector3(180 + Math.sin(angle) * 70, 76 + Math.sin(angle * 0.7) * 9, 318 + Math.cos(angle) * 38);
    game.renderer.snapCamera(position, new THREE.Vector3(-44, 10, 58), 55);
    return;
  }
  if (game.state !== 'playing') return;
  game.cameraMouseTimer -= deltaTime;
  if (game.input.mouseDX || game.input.mouseDY) game.cameraMouseTimer = 2.5;
  game.cameraYaw -= game.input.mouseDX * 0.00215 * game.screens.sensitivity;
  game.cameraPitch = clamp(game.cameraPitch - game.input.mouseDY * 0.0018 * game.screens.sensitivity, -0.62, 0.58);
  const vehicle = game.player.vehicle;
  if (vehicle && game.cameraMouseTimer <= 0) game.cameraYaw += angleDelta(game.cameraYaw, vehicle.heading) * Math.min(1, deltaTime * 1.8);
  const target = vehicle?.position || game.player.position;
  const sprint = !vehicle && game.input.down('ShiftLeft') && game.input.down('KeyW');
  const distance = vehicle ? 9.2 + Math.abs(vehicle.speed) * 0.075 : game.player.aiming ? 2.6 : 5.5;
  game.renderer.followCamera(target, game.cameraYaw, game.cameraPitch, distance, game.player.aiming && !vehicle, deltaTime, game.city.cameraClearance.bind(game.city));
  if (sprint) game.renderer.camera.fov = Math.min(66, game.renderer.camera.fov + deltaTime * 9);
}

function updateGame(game, deltaTime) {
  game.elapsed += deltaTime;
  if (game.state === 'playing') {
    if (game.input.consume('Escape')) { pauseGame(game); return; }
    for (let index = 0; index < 4; index++) if (game.input.consume(`Digit${index + 1}`)) game.player.selectWeapon(index, game);
    if (game.input.wheelDelta && !game.player.vehicle) game.player.selectWeapon((game.player.currentWeapon + (game.input.wheelDelta > 0 ? 1 : 3)) % 4, game);
    game.city.update(deltaTime);
    if (!game.player.vehicle) game.player.updateOnFoot(deltaTime, game);
    else { game.player.aiming = false; game.player.updateCombat(deltaTime, game); }
    game.vehicles.update(deltaTime, game);
    game.peds.update(deltaTime, game);
    game.police.update(deltaTime, game);
    game.missions.update(deltaTime, game);
    updateInteractions(game);
    game.hud.update(deltaTime, game);
    game.audio.update(deltaTime, game);
    game.renderer.updateEffects(deltaTime);
  } else if (game.state === 'title') {
    game.city.update(deltaTime * 0.3);
    if (game.input.consume('Enter')) startNewGame(game);
  }
}

function boot() {
  const game = buildGame();
  window.__game = game;
  window.__shotReady = false;
  if (game.shotMode) {
    game.activeShot = stageShot(game, game.shotMode);
    game.hud.setVisible(game.shotMode !== 'title');
    game.hud.update(1, game);
  }
  game.renderer.render();
  document.title = GAME_TITLE;
  document.getElementById('status').textContent = '';
  let lastTime = performance.now();
  let accumulator = 0;
  let shotFrames = 0;
  let fpsTime = lastTime;
  let fpsFrames = 0;
  window.__metrics = { fps: 0, drawCalls: 0, triangles: 0 };
  function frame(now) {
    try {
      const elapsed = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      if (game.shotMode) {
        game.renderer.render();
        if (++shotFrames === 3) window.__shotReady = true;
      } else {
        accumulator += elapsed;
        let steps = 0;
        while (accumulator >= FIXED_STEP && steps < 6) {
          updateGame(game, FIXED_STEP);
          updateCamera(game, FIXED_STEP);
          accumulator -= FIXED_STEP;
          steps++;
        }
        game.renderer.render();
        game.input.endFrame();
      }
      fpsFrames++;
      if (now - fpsTime > 1000) {
        window.__metrics = { fps: Math.round(fpsFrames * 1000 / (now - fpsTime)), drawCalls: game.renderer.renderer.info.render.calls, triangles: game.renderer.renderer.info.render.triangles };
        fpsTime = now;
        fpsFrames = 0;
      }
      requestAnimationFrame(frame);
    } catch (error) {
      reportFailure(error.message || error);
      console.error(error);
    }
  }
  game.canvas.addEventListener('click', () => {
    if (game.state === 'playing') {
      game.audio.ensureContext();
      game.input.requestPointerLock();
    }
  });
  requestAnimationFrame(frame);
}

try { boot(); } catch (error) {
  reportFailure(error.message || error);
  console.error(error);
}
