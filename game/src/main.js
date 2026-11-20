// Boot, the fixed-step loop and the state machine. Errors are caught at the window so a headless
// dump shows "ERR …" in the title and #status instead of a blank canvas. The world is one object
// wiring the city, renderer, player, cars, pedestrians, police, HUD, missions and audio; the loop
// advances it in 1/60 s steps and the renderer paints. ?shot= stages a deterministic still scene.

import { STEP, SEA_Z, LOCATIONS, VEHICLE_SPECS, GAME, WEAPONS } from './config.js';
import { createInput } from './input.js';
import {
  createRenderer, makeCollisionProbe, render, updateRenderWorld, drawTracer, snapCamera,
  showWaypoint,
} from './render.js';
import { createCity } from './city.js';
import { createPlayer, updatePlayer, resetPlayer, hurtPlayer } from './player.js';
import {
  createVehicle, updateVehicle, spawnTraffic, nearestVehicle, seatPlayerInVehicle,
  removePlayerFromVehicle, stealVehicle,
} from './vehicles.js';
import { createPeds, updatePeds, alertCrowd } from './peds.js';
import { createPolice, updatePolice, reportCrime } from './police.js';
import { createHud, updateHud } from './hud.js';
import { createAudio } from './audio.js';
import {
  createMissions, updateMissions, startMission, handleInteract, garagePurchase, tickWaits,
  setSidebar, missionsOnCarjack, startDelivery, startRace,
} from './missions.js';
import { createScreens, SCREEN } from './screens.js';
import { saveGame, loadGame, applySave } from './save.js';
import { stageShot } from './shots.js';

function reportError(error) {
  const text = typeof error === 'string' ? error : error?.message ?? String(error);
  document.title = `ERR ${text}`;
  const status = document.getElementById('status');
  if (status) status.textContent = `ERR ${text}`;
  const bootEl = document.getElementById('boot');
  if (bootEl) { bootEl.classList.remove('hidden'); bootEl.style.color = '#e4572e'; bootEl.textContent = `ERR ${text}`; }
}

window.onerror = (message) => { reportError(typeof message === 'string' ? message : message?.message ?? String(message)); return false; };
window.addEventListener('unhandledrejection', (event) => reportError(event.reason?.message ?? String(event.reason)));

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

function boot() {
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  const rendererState = createRenderer(canvas);
  const input = createInput(canvas);
  const city = createCity(seed);
  rendererState.scene.add(city.group);
  const audio = createAudio();
  const hud = createHud();
  const police = createPolice();
  const missions = createMissions();
  const start = { x: LOCATIONS.safehouse.x + 4, z: LOCATIONS.safehouse.z + 4 };
  const player = createPlayer(rendererState.scene, start);
  const peds = createPeds(rendererState.scene, 44);

  const world = {
    rendererState,
    camera: rendererState.camera,
    cameraProbe: makeCollisionProbe(city.colliders),
    city,
    colliders: city.colliders,
    input,
    audio,
    hud,
    police,
    missions,
    peds,
    player,
    vehicles: [],
    playerCar: null,
    missionCars: [],
    missionGuards: [],
    time: 0,
    state: 'title',
    cash: 350,
    respect: 0,
    waypoint: null,
    evening: true,
    seaZ: SEA_Z,
    thirdPerson: true,
    settings: { music: 40, sfx: 70, invertY: false, subtitles: true },
    robberyCooldown: 0,
    carjackAlert: null,
    ending: false,
    lastMissionResult: null,
    pendingVehicle: null,
    titleCamera: { free: false },
  };

  wireWorld(world);
  populate(world, seed);

  if (shotMode) {
    document.body.classList.add('playing');
    status.textContent = `shot ${shotMode}`;
    try {
      stageShot(shotMode, world, {
        seed, rendererState, camera: rendererState.camera, hud, input,
        showWaypoint, snapCamera, drawTracer, WEAPONS, startMission,
      });
      updateRenderWorld(rendererState, 0.016, focusOf(world));
      updateHud(hud, world, 0.016);
      render(rendererState);
    } catch (error) {
      reportError(error);
      console.error(error);
    }
    window.__shotReady = true;
    let painted = 0;
    function shotFrame() {
      render(rendererState);
      painted += 1;
      if (painted < 3) requestAnimationFrame(shotFrame);
    }
    requestAnimationFrame(shotFrame);
    return;
  }

  hud.hide();
  world.screens.show(SCREEN.title);
  document.getElementById('boot').classList.add('hidden');
  status.textContent = 'CIELO MAR ready.';

  let last = performance.now();
  let accum = 0;
  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    accum += elapsed;
    let steps = 0;
    while (accum >= STEP && steps < 5) {
      step(world, STEP);
      accum -= STEP;
      steps += 1;
    }
    updateRenderWorld(rendererState, Math.max(dt0(steps), elapsed), focusOf(world));
    if (world.state === 'play') updateHud(hud, world, elapsed);
    render(rendererState);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function dt0(steps) { return steps > 0 ? steps * STEP : 0; }

function focusOf(world) {
  return world.player.inVehicle && world.playerCar ? world.playerCar.position : world.player.position;
}

function wireWorld(world) {
  const hud = world.hud;

  world.onGunfire = (p) => {
    alertCrowd(world.peds, p.position, 5);
    reportCrime(world, GAME.gunfireHeat, 'Gunfire reported');
  };
  world.onCarjack = (car) => {
    world.carjackAlert = car.position.clone();
    reportCrime(world, GAME.carjackHeat, 'Carjacking in progress');
    missionsOnCarjack(world.missions, world, car);
  };
  world.onOfficerDown = () => reportCrime(world, 2, 'Officer down');
  world.onPoliceRam = (car, target) => {
    world.rendererState.sparks.spawn(target.position.x, 1, target.position.z, 0, 3, 0, 0.3, 0.5, 0xffcf87, 8, 0);
  };
  world.onVehicleExploded = (car) => {
    if (car.police) reportCrime(world, 2, 'Cruiser destroyed');
    if (car === world.playerCar) world.onWasted?.('Your car exploded.');
  };
  world.onVehicleImpact = () => {};
  world.resolveVehicleHits = (car) => {
    if (car.speed === 0 || car === world.playerCar) return;
    if (!world.player.inVehicle) {
      const d = car.position.distanceTo(world.player.position);
      if (d < 2.2 && Math.abs(car.speed) > 6) world.hurt(18 * Math.min(2, Math.abs(car.speed) / 20), car);
    }
  };
  world.hurt = (amount, source) => hurtPlayer(world.player, amount, source, world);
  world.tracer = (from, to, color) => drawTracer(world.rendererState, from, to, color);
  world.onWasted = (reason) => {
    if (world.state === 'wasted') return;
    world.state = 'wasted';
    world.player.alive = false;
    for (const g of world.missionGuards) { if (!g.dead) { g.dead = true; g.group.visible = false; } }
    world.missionGuards.length = 0;
    world.screens.wastedReason = typeof reason === 'string' ? reason : 'You were wasted.';
    world.screens.respawn = () => respawnPlayer(world);
    world.audio?.play.impact?.(1);
    setTimeout(() => { if (world.state === 'wasted') world.screens.show(SCREEN.wasted); }, 900);
  };
  world.onMissionComplete = (m, payout) => {
    world.lastMissionResult = { title: m.title, payout };
    saveGame(world, 'autosave');
    world.state = 'complete';
    setTimeout(() => {
      if (world.state === 'complete') {
        world.screens.lastResult = world.lastMissionResult;
        world.screens.show(SCREEN.complete);
      }
    }, 1400);
  };
  world.onMissionFailed = () => {
    world.state = 'failed';
    setTimeout(() => { if (world.state === 'failed') { world.state = 'play'; } }, 2400);
  };
  world.onPedestrianHit = (ped, car) => {
    if (car === world.playerCar) reportCrime(world, 2, 'Hit and run');
  };
  world.onGuardDown = () => {};

  world.startMission = () => {
    world.screens.hide();
    world.state = 'play';
    hud.show();
    hud.setWheel(false, 0);
    startMission(world.missions, world);
    input.requestLock();
  };
  world.garagePurchase = (id) => garagePurchase(world, id);
  world.saveToSlot = (slot) => { hud.showToast(saveGame(world, slot) ? 'Saved' : 'Could not save'); };
  world.loadFromSlot = (slot) => {
    const data = loadGame(slot);
    if (data) { applySave(world, data); world.resume(); hud.showToast('Loaded'); }
  };
  world.loadAutosave = () => {
    const data = loadGame('autosave');
    if (data) { applySave(world, data); startPlaying(world); }
    else world.newGame();
  };
  world.newGame = () => {
    resetPlayer(world.player, { x: LOCATIONS.safehouse.x + 4, z: LOCATIONS.safehouse.z + 4 });
    world.cash = 350;
    world.respect = 0;
    world.missions.setIndex(0);
    world.missions.state = 'idle';
    world.missions.step = 0;
    world.player.current = 1;
    world.player.weapons = [{ clip: 0, reserve: 0 }, { clip: 12, reserve: 96 }, { clip: 0, reserve: 0 }, { clip: 0, reserve: 0 }];
    hud.setCash(world.cash, true);
    startPlaying(world);
    hud.say('Tavo', 'Rafa. My stand is the yellow one by the garage. Come by.', 4);
  };
  world.resume = () => {
    world.screens.hide();
    world.state = 'play';
    hud.show();
    hud.setWheel(false, 0);
    input.requestLock();
  };
  world.toTitle = () => {
    world.state = 'title';
    world.screens.show(SCREEN.title);
    hud.hide();
    input.exitLock();
  };
  world.openBriefing = () => world.screens.show(SCREEN.briefing);
  world.nearWater = () => world.player.position.z > SEA_Z - 30;
  world.screens = createScreens(world);
  setSidebar(hud);
}

function startPlaying(world) {
  world.screens.hide();
  world.state = 'play';
  world.hud.show();
  world.player.alive = true;
  world.police.wanted = 0;
  world.police.heat = 0;
  world.input.requestLock();
}

function respawnPlayer(world) {
  const hospital = LOCATIONS.hospital;
  const pos = { x: LOCATIONS.safehouse.x, z: LOCATIONS.safehouse.z + 10 };
  resetPlayer(world.player, pos);
  world.player.armour = 0;
  world.player.current = 1;
  world.cash = Math.max(0, world.cash - GAME.hospitalFee);
  world.player.health = 100;
  world.player.alive = true;
  world.player.inVehicle = null;
  world.playerCar = null;
  world.police.wanted = 0;
  world.police.heat = 0;
  world.missions.state = 'idle';
  world.missions.step = 0;
  world.missions.active = null;
  world.screens.hide();
  world.state = 'play';
  world.hud.show();
  world.hud.showToast(`Hospital fee $${GAME.hospitalFee}`);
  world.hud.say('Inés', 'You look worse than the cart. Sit down, Rafa.', 3.5);
  world.input.requestLock();
}

function populate(world, seed) {
  const { rendererState } = world;
  const rng = mulberry(seed);
  const kinds = ['brisa', 'mulo', 'panera', 'amarillo', 'vela', 'brisa', 'fuerte'];
  const lots = [
    { x: LOCATIONS.marinaHotel.x + 10, z: LOCATIONS.marinaHotel.z + 12 },
    { x: LOCATIONS.garage.x + 8, z: LOCATIONS.garage.z - 8 },
    { x: -60, z: 150 }, { x: -30, z: 120 }, { x: 100, z: 60 },
    { x: LOCATIONS.cienaga.x, z: LOCATIONS.cienaga.z + 20 }, { x: -600, z: 60 }, { x: 260, z: 320 },
    { x: 420, z: -120 }, { x: -200, z: -240 }, { x: 160, z: -300 },
  ];
  lots.forEach((lot, i) => {
    const kind = kinds[i % kinds.length];
    const car = createVehicle(rendererState.scene, kind, { x: lot.x + (rng() - 0.5) * 4, z: lot.z + (rng() - 0.5) * 4 }, rng() * Math.PI * 2, { parked: true });
    car.parked = true;
    world.vehicles.push(car);
  });
  const boat = createVehicle(rendererState.scene, 'lancha', { x: LOCATIONS.pier.x + 14, z: SEA_Z + 60 }, Math.PI, { parked: true });
  boat.parked = true;
  world.vehicles.push(boat);
  world.vehicles.push(...spawnTraffic(rendererState.scene, world, 24));
  world.peds.spawnAround(world.player.position, 280);
}

function mulberry(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function step(world, dt) {
  const { input, player } = world;
  if (world.state === 'title') {
    world.time += dt;
    cameraOrbitTitle(world, dt);
    updateRenderWorld(world.rendererState, dt, focusOf(world));
    return;
  }
  if (world.state !== 'play') {
    handleMenuInput(world);
    updateRenderWorld(world.rendererState, dt, focusOf(world));
    return;
  }
  world.time += dt;
  world.robberyCooldown = Math.max(0, world.robberyCooldown - dt);

  handlePlayInput(world, dt);

  if (!player.inVehicle) updatePlayer(player, input, dt, world);
  for (const car of world.vehicles) updateVehicle(car, dt, world);
  updatePeds(world.peds, dt, world);
  updatePolice(world.police, dt, world);
  updateMissions(world.missions, world, dt);
  updateGuards(world, dt);
  tickWaits(world, dt);
  world.audio?.tick(dt, world);
  if (world.carjackAlert) world.carjackAlert = null;

  showWaypoint(world.rendererState, world.waypoint ?? { x: 0, z: 0 }, !!world.waypoint);

  if (world.pendingVehicle) {
    const v = world.pendingVehicle;
    world.pendingVehicle = null;
    const car = createVehicle(world.rendererState.scene, v.kind, { x: v.x, z: v.z }, v.heading);
    car.driver = 'player';
    car.parked = false;
    world.vehicles.push(car);
    seatPlayerInVehicle(world, car);
  }

  input.endFrame();
  input.wheelDelta = 0;
}

function handleMenuInput(world) {
  const { input, screens } = world;
  const keyboard = screens.active !== SCREEN.wasted && screens.active !== SCREEN.complete;
  if (input.pressed('pause')) {
    if (screens.active === SCREEN.options || screens.active === SCREEN.slots || screens.active === SCREEN.briefing || screens.active === SCREEN.garage) {
      screens.show(SCREEN.pause);
    } else if (world.state === 'paused') {
      world.resume();
    }
    input.endFrame();
    return;
  }
  if (keyboard) {
    if (input.pressed('forward')) screens.moveSelection(-1);
    if (input.pressed('back')) screens.moveSelection(1);
    if (input.pressedCode('Enter') || input.pressed('jump') || input.pressed('interact')) screens.activate();
    for (let i = 1; i <= 9; i += 1) {
      if (input.pressedCode(`Digit${i}`)) screens.activate(Math.min(i - 1, screens.items.length - 1));
    }
  } else if (input.pressedCode('Enter') || input.pressed('interact')) {
    screens.activate(0);
  }
  input.endFrame();
}

function handlePlayInput(world, dt) {
  const { input, player, hud } = world;
  if (input.pressed('pause')) {
    world.state = 'paused';
    input.exitLock();
    world.screens.show(SCREEN.pause);
    return;
  }
  if (input.pressed('wheel')) {
    player.wheelOpen = !player.wheelOpen;
    hud.setWheel(player.wheelOpen, player.current);
  }
  if (player.wheelOpen) hud.setWheel(true, player.current);

  if (input.pressed('enter')) {
    if (player.inVehicle) {
      if (world.playerCar) removePlayerFromVehicle(world, world.playerCar);
    } else {
      const car = nearestVehicle(player, world.vehicles.filter((c) => !c.police), 5.5);
      if (car) {
        if (car.driver && car.driver !== 'player') {
          const stolen = stealVehicle(player, car, world);
          if (stolen) seatPlayerInVehicle(world, stolen);
        } else {
          seatPlayerInVehicle(world, car);
        }
      }
    }
  }
  if (input.pressed('interact')) {
    const result = handleInteract(world);
    if (result?.open === 'garage') { world.state = 'paused'; world.screens.show(SCREEN.garage); input.exitLock(); }
    else if (result?.save) { if (saveGame(world, 'autosave')) hud.showToast('Autosaved at the safehouse'); }
  }
  if (player.inVehicle && input.pressed('reload')) {
    const car = world.playerCar;
    if (car) {
      car.radioStation = ((car.radioStation ?? 0) + 1) % 3;
      world.audio?.nextStation?.();
      hud.showToast(car.radioStation === 0 ? 'RADIO COSTA' : car.radioStation === 1 ? 'CIELO FM' : 'ONDA VIEJA');
    }
  }
  if (!player.inVehicle && Math.hypot(player.velocity.x, player.velocity.z) > 2) {
    world.footTimer = (world.footTimer ?? 0) - dt;
    if (world.footTimer <= 0) { world.audio?.play.footstep?.(); world.footTimer = player.sprinting ? 0.28 : 0.42; }
  }
}

function updateGuards(world, dt) {
  const playerPos = world.player.inVehicle ? world.playerCar.position : world.player.position;
  for (const guard of world.missionGuards) {
    if (guard.dead) continue;
    const to = new THREE.Vector3().subVectors(playerPos, guard.position);
    const dist = to.length();
    if (dist > 50) continue;
    to.normalize();
    guard.heading = Math.atan2(to.x, to.z);
    guard.group.rotation.y = guard.heading;
    if (dist > 8) {
      guard.position.addScaledVector(to, 2.5 * dt);
      guard.group.position.copy(guard.position);
    }
    guard.fireTimer -= dt;
    if (guard.fireTimer <= 0 && dist < 34) {
      guard.fireTimer = 0.8 + Math.random() * 1.3;
      world.audio?.play.gunshot?.('smg', 0.5);
      const muzzle = new THREE.Vector3(guard.position.x + Math.sin(guard.heading) * 0.5, 1.2, guard.position.z + Math.cos(guard.heading) * 0.5);
      const end = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
      drawTracer(world.rendererState, muzzle, end, 0xffcf87);
      if (Math.random() < 0.35 - dist / 220) world.hurt(7, guard);
    }
  }
}

function cameraOrbitTitle(world, dt) {
  if (world.titleCamera.free) return;
  const cam = world.rendererState.camera;
  const t = world.time * 0.045;
  cam.position.set(Math.sin(t) * 520, 190, 360 + Math.cos(t) * 220);
  cam.lookAt(new THREE.Vector3(0, 30, 120));
  if (cam.fov !== 58) { cam.fov = 58; cam.updateProjectionMatrix(); }
}

try {
  boot();
} catch (error) {
  reportError(error);
  console.error(error);
}
