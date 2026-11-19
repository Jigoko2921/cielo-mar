// Reproducible camera setups made from the actual city, actors, combat and HUD systems.
import { LOCATIONS } from './config.js';

function clearScreens(game) {
  game.screens.hideAll();
  game.input.enabled = false;
  document.body.style.cursor = 'none';
  game.elapsed = 38;
  game.night = 0;
  game.renderer.setNight(0);
  game.cash = 3850;
  game.respect = 24;
  game.player.health = 92;
  game.player.armour = 58;
  game.player.stamina = 78;
}

function moveCar(car, x, z, heading, speed) {
  car.position.set(x, car.type === 'boat' ? -0.1 : 0.18, z);
  car.heading = heading;
  car.speed = speed;
  car.velocity.set(Math.sin(heading) * speed, 0, Math.cos(heading) * speed);
  car.traffic = false;
  car.mesh.rotation.y = heading;
  car.mesh.visible = true;
}

function stageBoulevardTraffic(game) {
  const traffic = game.vehicles.vehicles.filter((car) => !car.police && car.type !== 'boat');
  const placements = [
    [-25, 281.8, Math.PI / 2, 12], [16, 288.2, -Math.PI / 2, 13],
    [51, 281.8, Math.PI / 2, 11], [-76, 288.2, -Math.PI / 2, 12],
    [87, 288.2, -Math.PI / 2, 10], [-104, 281.8, Math.PI / 2, 12],
  ];
  placements.forEach((placement, index) => {
    if (traffic[index]) moveCar(traffic[index], ...placement);
  });
}

function snapShoulder(game, distance = 6, fov = 57) {
  const target = game.player.vehicle?.position || game.player.position;
  const yaw = game.cameraYaw;
  const forward = new THREE.Vector3(Math.sin(game.cameraYaw), Math.sin(game.cameraPitch), Math.cos(game.cameraYaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const focus = target.clone().add(new THREE.Vector3(0, game.player.vehicle ? 1.25 : 1.3, 0));
  if (!game.player.vehicle) focus.addScaledVector(right, 0.55);
  const camera = focus.clone().addScaledVector(forward, -distance);
  camera.y += game.player.vehicle ? 1.6 : 1.15;
  const look = focus.clone().addScaledVector(forward, game.player.vehicle ? 24 : 15);
  game.renderer.snapCamera(camera, look, fov);
}

function stageCover(game) {
  const vela = game.vehicles.vehicles.find((car) => car.missionTag === 'hotelVela');
  moveCar(vela, -33, 278.5, Math.PI / 2, 0);
  vela.parked = true;
  game.player.teleport(-47, 296, 2.48);
  game.player.selectWeapon(0, game);
  game.cameraYaw = 2.48;
  game.cameraPitch = -0.03;
  stageBoulevardTraffic(game);
  game.missions.active = true;
  game.missions.missionIndex = 0;
  game.missions.phase = 0;
  game.missions.completedCount = 0;
  game.missions.data = { kills: 0, reference: vela };
  game.missions.setTarget(vela.position);
  game.police.game = game;
  game.police.raiseWanted(3, 'Hotel alarm');
  game.police.lastKnown.copy(game.player.position);
  game.police.searchRadius = 138;
  game.police.searching = true;
  game.police.spawnResponse(game);
  game.police.units.slice(0, 3).forEach((car, index) => moveCar(car, 22 + index * 17, 281.5 + (index % 2) * 7, -Math.PI / 2, 7));
  game.peds.people.filter((person) => person.role === 'officer').forEach((person) => { person.mesh.visible = false; });
  const pedestrians = game.peds.people.filter((person) => person.role === 'civilian');
  [[-37.5, 291.5], [-28, 295.5], [-15.5, 289], [1.5, 293.5], [16, 289]].forEach(([x, z], index) => {
    if (pedestrians[index]) {
      pedestrians[index].position.set(x, 0.18, z);
      pedestrians[index].heading = index % 2 ? Math.PI / 2 : -Math.PI / 2;
      pedestrians[index].mesh.rotation.y = pedestrians[index].heading;
    }
  });
  game.hud.showSubtitle('TAVO', 'Vela GT. Marina hotel. Red like an unpaid bill.', 99);
  snapShoulder(game, 6.4, 58);
}

function stageChase(game) {
  const vela = game.vehicles.vehicles.find((car) => car.missionTag === 'hotelVela');
  moveCar(vela, 0, 284.8, Math.PI / 2, 28);
  vela.player = true;
  vela.parked = false;
  game.vehicles.playerVehicle = vela;
  game.player.vehicle = vela;
  game.player.group.visible = false;
  game.player.selectWeapon(0, game);
  game.player.armour = 44;
  game.player.health = 76;
  game.cash = 5240;
  game.cameraYaw = 1.78;
  game.cameraPitch = -0.08;
  stageBoulevardTraffic(game);
  game.missions.active = true;
  game.missions.missionIndex = 0;
  game.missions.phase = 1;
  game.missions.data = { kills: 0, reference: vela };
  game.missions.setTarget({ x: 239, z: 275 });
  game.police.game = game;
  game.police.raiseWanted(4, 'Coastal pursuit');
  game.police.lastKnown.copy(vela.position);
  game.police.searchRadius = 160;
  game.police.searching = true;
  game.police.spawnResponse(game);
  game.police.units.slice(0, 5).forEach((car, index) => {
    const positions = [[9, 290.4, -Math.PI / 2, 11], [16, 279.6, Math.PI / 2, 14], [24, 290.8, -Math.PI / 2, 8], [33, 279.8, Math.PI / 2, 10], [-9, 285.0, Math.PI / 2, 22]];
    moveCar(car, ...positions[index]);
    if (car.lightbar) car.lightbar.visible = true;
  });
  game.peds.people.filter((person) => person.role === 'officer').forEach((person) => { person.mesh.visible = false; });
  if (game.police.helicopter) {
    game.police.helicopter.visible = true;
    game.police.helicopter.position.set(16, 8.2, 272);
    game.police.helicopter.rotation.y = Math.PI / 2;
    if (game.police.heliRotor) game.police.heliRotor.rotation.y = 0.55;
  }
  game.hud.showSubtitle('INÉS', 'Four stars, Rafa. The boulevard is yours if you can hold it.', 99);
  const carPos = vela.position;
  game.renderer.snapCamera(
    new THREE.Vector3(carPos.x - 12.5, 4.1, carPos.z + 6.2),
    new THREE.Vector3(carPos.x + 33, 2.1, carPos.z - 2.5),
    62,
  );
}

function addContainer(game, x, z, rotation, colour, stacked = false) {
  const material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.82, metalness: 0.12, flatShading: true });
  for (let level = 0; level < (stacked ? 2 : 1); level++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.7, 2.9), material);
    box.position.set(x, 1.36 + level * 2.72, z);
    box.rotation.y = rotation;
    box.castShadow = true;
    box.receiveShadow = true;
    game.renderer.scene.add(box);
  }
}

function stageShootout(game) {
  addContainer(game, 231, 197, 0.04, 0xa8452f, true);
  addContainer(game, 240.5, 195.5, 0.02, 0x2f6470, false);
  addContainer(game, 258, 195, -0.03, 0x9c7a3c, true);
  addContainer(game, 266.5, 198, 0.05, 0x3d6b52, false);
  addContainer(game, 249, 191.5, 0.01, 0x8c3b34, false);
  game.player.teleport(246, 215, Math.PI - 0.24);
  game.player.aiming = true;
  game.player.armour = 63;
  game.player.health = 71;
  game.player.selectWeapon(2, game);
  game.player.currentWeapon = 2;
  game.player.ammo[2] = 30;
  game.cash = 7310;
  game.cameraYaw = Math.PI - 0.24;
  game.cameraPitch = 0.01;
  const guardPositions = [[239, 204], [257, 207], [249, 202], [265, 199], [232, 199], [272, 207]];
  const guards = guardPositions.map(([x, z]) => game.peds.spawnGuard(x, z, { missionTag: 'warehouse' }));
  game.missions.active = true;
  game.missions.missionIndex = 5;
  game.missions.phase = 1;
  game.missions.data = { kills: 0, wave: 2, timer: 0 };
  game.peds.knockDown(guards[0], game, 'combat');
  game.peds.knockDown(guards[1], game, 'combat');
  guards[2].health = 16;
  const target = guards[2].position.clone().add(new THREE.Vector3(0, 1.2, 0));
  const direction = target.clone().sub(game.player.position.clone().add(new THREE.Vector3(0, 1.35, 0))).normalize();
  game.player.fireWeapon(game, direction);
  guards[3].heading = -1.7;
  const enemyMuzzle = guards[3].position.clone().add(new THREE.Vector3(0, 1.45, 0));
  game.renderer.addTracer(enemyMuzzle, game.player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xff8950, 99);
  game.renderer.addMuzzleFlash(enemyMuzzle, 3.6);
  game.renderer.addMuzzleFlash(game.player.position.clone().add(new THREE.Vector3(0, 1.45, 0)), 2.3);
  const flashLight = new THREE.PointLight(0xffb066, 26, 26, 1.6);
  flashLight.position.copy(enemyMuzzle);
  game.renderer.scene.add(flashLight);
  game.renderer.addSparks(new THREE.Vector3(262, 2.4, 199), 0xffb347, 16);
  game.renderer.addSparks(new THREE.Vector3(252, 1.8, 203), 0xffd27a, 10);
  game.missions.data.kills = Math.max(3, game.missions.data.kills);
  game.missions.setTarget(guards.find((guard) => !guard.down)?.position || LOCATIONS.warehouse);
  game.hud.showSubtitle('LA SIRENA', 'My boat is at the pier. I only wait for winners.', 99);
  game.renderer.snapCamera(new THREE.Vector3(233, 4.4, 234), new THREE.Vector3(257, 3.2, 198), 58);
}

function stageTitle(game) {
  game.screens.showTitle(true);
  game.hud.setVisible(false);
  stageBoulevardTraffic(game);
  game.renderer.snapCamera(new THREE.Vector3(115, 76, 15), new THREE.Vector3(-5, 4, 305), 56);
}

export function stageShot(game, mode) {
  clearScreens(game);
  if (mode === 'cover') stageCover(game);
  else if (mode === 'chase') stageChase(game);
  else if (mode === 'shootout') stageShootout(game);
  else stageTitle(game);
  for (const car of game.vehicles.vehicles) game.vehicles.updateVehicleVisual(car, 0, false);
  game.elapsed = 38;
  game.renderer.animateWaypoint(game.missions.waypoint, 38);
  return { mode };
}
