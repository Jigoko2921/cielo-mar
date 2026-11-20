// Deterministic ?shot= staging. Each mode assembles the real systems into a still scene, moves the
// cars, peds and police into frame by hand (setting both a car's position AND its mesh x/z, which
// is the pitfall the brief warns of), then places the camera with snapCamera and freezes. Nothing
// here is a mock-up: it drives the actual player, vehicle, police and mission code.

import { LOCATIONS, SEA_Z, PALETTE, VEHICLE_SPECS, WEAPONS } from './config.js';
import { createVehicle } from './vehicles.js';
import { createPeds } from './peds.js';
import { startMission } from './missions.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Move a car and its mesh together, so a staged frame renders it where we say. */
function placeCar(car, x, z, heading, speed = 0) {
  car.position.set(x, 0, z);
  car.heading = heading;
  car.speed = speed;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.set(0, heading, 0);
  car.mesh.visible = true;
}

function placePed(ped, x, z, heading) {
  ped.position.set(x, 0.2, z);
  ped.heading = heading;
  ped.group.position.set(x, 0.2, z);
  ped.group.rotation.set(0, heading, 0);
  ped.group.visible = true;
}

function makeMuzzle(world, from, to, color = 0xffd27a) {
  // Draw a tracer and a spark burst without running the physics.
  const rs = world.rendererState;
  const dist = from.distanceTo(to);
  const dir = to.clone().sub(from).normalize();
  for (let i = 0; i < 10; i += 1) {
    const t = (i / 10) * dist;
    const p = from.clone().addScaledVector(dir, t);
    rs.tracers.spawn(p.x, p.y, p.z, 0, 0, 0, 0.6, 0.26, color, 0, 0, 0.85);
  }
  rs.sparks.spawn(from.x, from.y, from.z, dir.x * 2, dir.y * 2, dir.z * 2, 0.5, 1.4, color, 0, 0.8, 1);
  rs.sparks.spawn(from.x, from.y, from.z, 0, 0, 0, 0.4, 2.6, 0xffffff, 0, 0.6, 0.9);
}

function makeStar(world, at) {
  // Add an imperial star to the sky for the title card.
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? 1 : 0.42;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffc45a, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  const star = new THREE.Mesh(geo, mat);
  star.position.copy(at);
  star.scale.setScalar(4);
  star.lookAt(world.rendererState.camera.position);
  world.rendererState.scene.add(star);
  return star;
}

export function stageShot(mode, world, kit) {
  const { rendererState, camera, snapCamera, showWaypoint, hud } = kit;
  const player = world.player;
  world.state = 'shot';
  world.titleCamera.free = true;

  if (mode === 'cover') return stageCover(world, kit);
  if (mode === 'chase') return stageChase(world, kit);
  if (mode === 'shootout') return stageShootout(world, kit);
  if (mode === 'title') return stageTitle(world, kit);
  // Default: cover.
  return stageCover(world, kit);
}

function stageCover(world, kit) {
  const { rendererState, snapCamera, hud, camera, showWaypoint } = kit;
  const px = -360;
  const pz = SEA_Z - 22;
  world.player.position.set(px, 0.2, pz);
  world.player.group.position.copy(world.player.position);
  world.player.facing = Math.PI * 0.1;
  world.player.aiming = false;
  world.player.current = 1;
  world.player.health = 78;
  world.player.armour = 42;
  world.player.stamina = 66;
  world.police.wanted = 3;
  world.police.heat = 3;
  world.police.response = [
    { cs: 'UNIDAD 12', tactic: 'PURSUIT', dist: 38 },
    { cs: 'UNIDAD 14', tactic: 'PURSUIT', dist: 54 },
    { cs: 'UNIDAD 19', tactic: 'ROADBLOCK', dist: 96 },
    { cs: 'FUERTE 21', tactic: 'BLOCKADE', dist: 120 },
    { cs: 'AIR-1', tactic: 'SEARCHLIGHT', dist: 88, air: true },
  ];
  world.cash = 12450;
  world.respect = 46;
  hud.setCash(world.cash, true);
  hud.setRespect(world.respect);
  hud.setStars(3, true);
  world.missions.index = 2;
  world.hud.setMission(3, 'La Deuda', 'Collect the second debt', 74);
  world.waypoint = { x: -300, z: SEA_Z - 120 };
  showWaypoint(rendererState, world.waypoint, true);

  // Palms & promenade traffic: cars on the boulevard behind.
  const kinds = ['brisa', 'amarillo', 'mulo', 'brisa', 'panera', 'brisa'];
  kinds.forEach((kind, i) => {
    const car = createVehicle(rendererState.scene, kind, { x: px + 18 + i * 15, z: pz - 16 }, Math.PI / 2, {});
    placeCar(car, px + 18 + i * 15, pz - 15, Math.PI / 2, 5);
    car.headlightsOn = true;
    world.vehicles.push(car);
  });
  // Two cruisers beside the boulevard, lights flashing.
  for (let i = 0; i < 2; i += 1) {
    const cop = createVehicle(rendererState.scene, 'crucero', { x: px + 34 + i * 14, z: pz - 24 }, Math.PI / 2, { police: true });
    placeCar(cop, px + 34 + i * 14, pz - 24, Math.PI / 2, 0);
    cop.police = true;
    cop.mesh.userData.lightbar.redMat.emissiveIntensity = 3.5;
    cop.mesh.userData.lightbar.blueMat.emissiveIntensity = 0.2;
    world.police.cars.push(cop);
    world.vehicles.push(cop);
  }
  // Pedestrians on the sidewalk.
  const pedSpots = [
    [8, 4, 0.2], [16, 4, -1.2], [26, 5, 2.4], [-10, 6, 0.8], [40, 4, 3.1], [52, 5, -1.4], [64, 3, 1.1],
    [2, 12, 2.1], [30, -2, 0.4], [-26, 8, 1.6], [46, 10, -2.2], [70, 8, 0.9],
  ];
  const peds = world.peds.peds;
  pedSpots.forEach(([dx, dz, h], i) => {
    const ped = peds[i];
    if (ped) placePed(ped, px + dx, pz + dz, h);
  });
  // Pull a few bodies onto the beach far side.
  for (let i = 12; i < 20; i += 1) {
    const ped = peds[i];
    if (ped) placePed(ped, px + (i - 12) * 12 - 20, pz + 26, Math.PI);
  }

  // Camera: low, warm, looking down the promenade past the player toward the pier and lighthouse.
  snapCamera(rendererState, v3(px - 9, 3.4, pz + 6.5), v3(px + 12, 1.6, pz - 14), 64);
  world.player.group.visible = true;
}

function stageChase(world, kit) {
  const { rendererState, snapCamera, hud, camera } = kit;
  const px = 60;
  const pz = 420;
  // The player in the Vela GT on the coastal boulevard, heading west along the coast.
  const heading = Math.PI / 2;
  const vela = createVehicle(rendererState.scene, 'vela', { x: px, z: pz }, heading, { color: 0xb53a2a });
  vela.driver = 'player';
  vela.occupied = true;
  vela.speed = 31;
  vela.headlightsOn = true;
  placeCar(vela, px, pz, heading, 31);
  world.vehicles.push(vela);
  world.playerCar = vela;
  world.player.inVehicle = vela;
  world.player.group.visible = false;

  // Two cruisers in the adjacent lane and just behind, not dead astern.
  const cruiserA = createVehicle(rendererState.scene, 'crucero', { x: px - 7, z: pz + 12 }, heading, { police: true });
  placeCar(cruiserA, px - 7, pz + 12, heading + 0.06, 30);
  cruiserA.police = true;
  cruiserA.mesh.userData.lightbar.redMat.emissiveIntensity = 4;
  cruiserA.mesh.userData.lightbar.blueMat.emissiveIntensity = 0.2;
  world.police.cars.push(cruiserA);
  world.vehicles.push(cruiserA);

  const cruiserB = createVehicle(rendererState.scene, 'crucero', { x: px + 8, z: pz + 22 }, heading, { police: true });
  placeCar(cruiserB, px + 8, pz + 22, heading - 0.05, 30);
  cruiserB.police = true;
  cruiserB.mesh.userData.lightbar.redMat.emissiveIntensity = 0.2;
  cruiserB.mesh.userData.lightbar.blueMat.emissiveIntensity = 4;
  world.police.cars.push(cruiserB);
  world.vehicles.push(cruiserB);

  // A third further back and a roadblock ahead for the minimap to fill.
  const cruiserC = createVehicle(rendererState.scene, 'fuerte', { x: px - 4, z: pz + 46 }, heading, { police: true });
  placeCar(cruiserC, px - 4, pz + 46, heading, 28);
  cruiserC.police = true;
  world.police.cars.push(cruiserC);
  world.vehicles.push(cruiserC);

  // Traffic ahead on the boulevard.
  for (let i = 0; i < 5; i += 1) {
    const kind = ['brisa', 'amarillo', 'mulo'][i % 3];
    const car = createVehicle(rendererState.scene, kind, { x: px - 2, z: pz - 30 - i * 14 }, heading, {});
    placeCar(car, px - 2, pz - 30 - i * 14, heading, 22);
    car.headlightsOn = true;
    world.vehicles.push(car);
  }

  // The helicopter above with its searchlight on the player.
  makeHelicopterForShot(world, v3(px + 20, 72, pz + 34), vela.position);

  world.police.wanted = 4;
  world.police.heat = 4;
  world.police.lastSeen = vela.position.clone();
  world.police.visible = true;
  world.police.searchRadius = 170;
  world.police.response = [
    { cs: 'UNIDAD 12', tactic: 'PURSUIT', dist: 12 },
    { cs: 'UNIDAD 14', tactic: 'PURSUIT', dist: 22 },
    { cs: 'FUERTE 21', tactic: 'RAMMING', dist: 46 },
    { cs: 'AIR-1', tactic: 'SEARCHLIGHT', dist: 74, air: true },
    { cs: 'UNIDAD 31', tactic: 'ROADBLOCK', dist: 110 },
  ];
  world.cash = 24300;
  world.respect = 62;
  hud.setCash(world.cash, true);
  hud.setRespect(world.respect);
  hud.setStars(4, true);
  hud.setMission(4, 'Ruta Nocturna', 'Lose the PCM before the pier', null);
  world.missions.index = 3;
  world.waypoint = { x: LOCATIONS.pier.x, z: LOCATIONS.pier.z };

  // Pedestrians on the promenade shouldering the road.
  const peds = world.peds.peds;
  for (let i = 0; i < 14; i += 1) {
    const ped = peds[i];
    if (ped) placePed(ped, px + 12 + (i % 5) * 8, pz - 8 + Math.floor(i / 5) * 9, Math.PI / 2);
  }

  // Camera to one side so the player sits left of centre and the cruisers fill the right.
  snapCamera(rendererState, v3(px + 4.5, 3.6, pz + 13.5), v3(px - 3, 1.1, pz - 26), 66);
}

function makeHelicopterForShot(world, at, focus) {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 0.6, metalness: 0.3, flatShading: true });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 7), navy);
  group.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 2.2), white);
  nose.position.set(0, 0.1, 4);
  group.add(nose);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 5), navy);
  boom.position.set(0, 0.3, -5.4);
  group.add(boom);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  rotor.position.y = 1.2;
  group.add(rotor);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff2c0, emissiveIntensity: 3 }));
  lamp.position.set(0, -1, 3);
  group.add(lamp);
  group.position.copy(at);
  group.lookAt(focus);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  world.rendererState.scene.add(group);
  const light = world.rendererState.searchLight;
  light.position.copy(at);
  light.target.position.set(focus.x, 0, focus.z);
  light.intensity = 8;
  light.angle = 0.3;
  // A visible cone of light from the lamp to the ground.
  const coneGeo = new THREE.CylinderGeometry(0.6, 12, at.y, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set((at.x + focus.x) / 2, at.y / 2, (at.z + focus.z) / 2);
  cone.lookAt(focus.x, 0, focus.z);
  cone.rotateX(Math.PI / 2);
  world.rendererState.scene.add(cone);
  world.police.helicopter = { group, position: at, rotor, tailRotor: rotor, searchlight: lamp };
}

function stageShootout(world, kit) {
  const { rendererState, snapCamera, hud, camera } = kit;
  const wh = LOCATIONS.warehouse;
  const px = wh.x + 2;
  const pz = wh.z + 12;
  world.player.position.set(px, 0.2, pz);
  world.player.group.position.copy(world.player.position);
  world.player.facing = Math.PI;
  world.player.aiming = true;
  world.player.current = 2;
  world.player.weapons[2] = { clip: 22, reserve: 150 };
  world.player.health = 64;
  world.player.armour = 72;
  world.player.stamina = 88;
  world.player.gun.visible = true;

  // Two guards down and more standing near the containers.
  const peds = world.peds.peds;
  const downA = peds[0];
  const downB = peds[1];
  if (downA) { placePed(downA, wh.x - 8, wh.z + 2, 0.4); downA.group.rotation.z = Math.PI / 2; downA.group.position.y = 0.4; }
  if (downB) { placePed(downB, wh.x + 7, wh.z + 1, 1.2); downB.group.rotation.z = Math.PI / 2; downB.group.position.y = 0.4; }
  const guards = [
    [wh.x - 4, wh.z - 4, 0.2], [wh.x + 5, wh.z - 6, -0.4], [wh.x + 12, wh.z - 2, 1.4], [wh.x - 12, wh.z - 3, -1.2], [wh.x + 1, wh.z - 12, 0], [wh.x - 1, wh.z - 18, 0.5],
  ];
  guards.forEach(([gx, gz, h], i) => {
    const ped = peds[2 + i];
    if (ped) placePed(ped, gx, gz, h);
  });
  // Muzzle flash and tracers from the player's SMG at the nearest guards.
  makeMuzzle(world, v3(px, 1.4, pz - 0.6), v3(wh.x - 4, 1.2, wh.z - 4), 0xffd27a);
  makeMuzzle(world, v3(px, 1.4, pz - 0.6), v3(wh.x + 5, 1.3, wh.z - 6), 0xffd27a);
  makeMuzzle(world, v3(px, 1.4, pz - 0.6), v3(wh.x + 1, 1.15, wh.z - 12), 0xffcf87);
  // Impact sparks near the shells.
  for (let i = 0; i < 6; i += 1) {
    rendererState.sparks.spawn(wh.x - 3 + i * 2, 1.2, wh.z - 2, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.6, 0.35, 0xffb347, 7, 0, 0.8);
  }
  rendererState.casings.spawn(px + 0.4, 1.1, pz - 0.4, 2, 1);
  rendererState.casings.spawn(px + 0.2, 1.1, pz - 0.4, -1, 2);
  // A couple of crates in front of the player for cover.
  for (let i = 0; i < 4; i += 1) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9, flatShading: true }));
    crate.position.set(wh.x - 8 + i * 5, 0.7, wh.z + 6);
    crate.castShadow = true;
    rendererState.scene.add(crate);
  }

  world.police.wanted = 0;
  world.police.heat = 0;
  world.cash = 48200;
  world.respect = 74;
  hud.setCash(world.cash, true);
  hud.setRespect(world.respect);
  hud.setStars(0, false);
  hud.setMission(6, 'Tormenta', 'Eliminate the guards 3/6', null);
  world.missions.index = 5;
  world.waypoint = { x: wh.x, z: wh.z };

  // Camera over the shoulder, looking into the warehouse through the open front.
  snapCamera(rendererState, v3(px + 3.5, 2.4, pz + 4.8), v3(wh.x - 1, 1.4, wh.z - 8), 62);
  hud.setReticle(true);
}

function stageTitle(world, kit) {
  const { rendererState, snapCamera, hud, camera } = kit;
  hud.hide();
  const screen = document.getElementById('screen');
  screen.classList.remove('hidden');
  screen.classList.add('dim');
  // Aerial shot over the skyline toward the sea, sun low.
  const cam = rendererState.camera;
  cam.position.set(-120, 210, -60);
  cam.lookAt(new THREE.Vector3(-120, 40, 420));
  cam.fov = 52;
  cam.updateProjectionMatrix();
  // A golden sun disc low over the sea.
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(46, 32), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9, fog: false }));
  sunDisc.position.set(-520, 90, 1600);
  sunDisc.lookAt(cam.position);
  rendererState.scene.add(sunDisc);
  // Lights on the skyline.
  for (let i = 0; i < 40; i += 1) {
    const h = 12 + (i % 7) * 8;
    const box = new THREE.Mesh(new THREE.BoxGeometry(6, h, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, emissive: 0xffd27a, emissiveIntensity: 0.4 }));
    box.position.set(-400 + (i * 37) % 760, h / 2, 300 - (i % 5) * 40);
    rendererState.scene.add(box);
  }
  // Title card DOM.
  const mission = world.missions.story[world.missions.index];
  screen.innerHTML = `
    <div class="menu" style="width:560px;background:linear-gradient(180deg,rgba(16,18,20,0.0),rgba(16,18,20,0.86) 30%);padding:60px 40px 40px">
      <div class="logo">Cielo Mar<span>cielo mar</span></div>
      <div class="tag">A crime story on the Costa Dorada · Golden hour</div>
      <div class="menu-item sel" data-sel><span class="n">01</span><span class="t">Continue</span></div>
      <div class="menu-item" data-sel><span class="n">02</span><span class="t">New Game</span></div>
      <div class="menu-item" data-sel><span class="n">03</span><span class="t">Options</span></div>
      <div class="menu-note">Eight jobs · ${mission ? `Next: ${mission.title}` : 'Complete'} · 1 of ${world.missions.story.length} missions done</div>
    </div>`;
}
