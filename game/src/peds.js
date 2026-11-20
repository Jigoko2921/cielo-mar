// Pedestrians: walk the sidewalks in both directions, idle at benches and stands, cross at the
// corners, flee from gunfire, crashes and speeding cars, react when the player aims at them. A
// small crowd pool keeps the street alive without adding draw calls: each ped is one merged figure
// with a few boxes, and stepping past the pool edge teleports a body back near the player.

import { PALETTE } from './config.js';

const SHIRTS = [0xe4572e, 0x35d0c0, 0xffb347, 0xefe2c8, 0x3d6a8a, 0x8a4a86, 0xc26b4a, 0x5c7a52];
const SKIN = [0xb97a52, 0x8a5a3c, 0xd9a878, 0x6b4230, 0xc08a5e];
const SHORTS = [0x2f3a46, 0x3a3a3c, 0x6b5b48, 0x2a4a5a];

function makePedBody(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)], roughness: 0.9, flatShading: true });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN[Math.floor(rng() * SKIN.length)], roughness: 0.85, flatShading: true });
  const legs = new THREE.MeshStandardMaterial({ color: SHORTS[Math.floor(rng() * SHORTS.length)], roughness: 0.9, flatShading: true });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), shirt);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), legs);
  legL.position.set(-0.12, 0.5, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), legs);
  legR.position.set(0.12, 0.5, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.52, 0.15), shirt);
  armL.position.set(-0.33, 1.16, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.52, 0.15), shirt);
  armR.position.set(0.33, 1.16, 0);
  group.add(armR);
  return { group, torso, head, legL, legR, armL, armR };
}

export function createPeds(scene, count = 46) {
  const peds = [];
  const state = { scene, peds, alerted: false, alertTimer: 0 };
  for (let i = 0; i < count; i += 1) {
    const rng = Math.random;
    const body = makePedBody(rng);
    const ped = {
      ...body,
      position: new THREE.Vector3(),
      heading: 0,
      speed: 1.2 + rng() * 0.7,
      walkPhase: rng() * 10,
      mode: 'walk',
      timer: 0,
      lane: rng() < 0.5 ? -1 : 1,
      dead: false,
      health: 60,
      knocked: 0,
      takeDamage(amount, source, world) {
        this.health -= amount;
        if (this.health <= 0) {
          this.dead = true;
          this.group.rotation.z = Math.PI / 2;
          this.group.position.y = 0.4;
        }
      },
      flee: 0,
      rng,
    };
    body.group.visible = false;
    scene.add(body.group);
    peds.push(ped);
  }
  state.spawnAround = (center, radius = 260) => {
    for (const ped of peds) {
      if (ped.dead) continue;
      if (ped.position.distanceTo(center) < radius && ped.group.visible) continue;
      placePed(ped, state, center, radius);
    }
  };
  state.spawnFleeingPedestrian = (position, heading) => {
    const ped = peds.find((p) => p.dead || !p.group.visible) ?? peds[0];
    ped.group.visible = true;
    ped.dead = false;
    ped.health = 60;
    ped.position.set(position.x + Math.cos(heading) * 2.4, 0.2, position.z - Math.sin(heading) * 2.4);
    ped.heading = heading + Math.PI * 0.5;
    ped.speed = 5.4;
    ped.flee = 6;
    ped.mode = 'flee';
    ped.group.position.copy(ped.position);
  };
  return state;
}

function placePed(ped, state, center, radius) {
  // Find a sidewalk-adjacent point: between blocks on the road shoulder.
  const angle = ped.rng() * Math.PI * 2;
  const dist = 30 + ped.rng() * radius;
  const x = THREE.MathUtils.clamp(center.x + Math.cos(angle) * dist, -740, 740);
  const z = THREE.MathUtils.clamp(center.z + Math.sin(angle) * dist, -740, 580);
  // Snap to the sidewalk band nearest a road line (every 80 m).
  const lineX = Math.round((x + 760) / 80) * 80 - 760;
  const lineZ = Math.round((z + 760) / 80) * 80 - 760;
  if (ped.rng() < 0.5) {
    ped.position.set(lineX + ped.lane * 13, 0.2, z);
    ped.heading = ped.rng() < 0.5 ? 0 : Math.PI;
  } else {
    ped.position.set(x, 0.2, lineZ + ped.lane * 13);
    ped.heading = ped.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  ped.group.position.copy(ped.position);
  ped.group.visible = true;
  ped.mode = 'walk';
  ped.flee = 0;
  ped.timer = 2 + ped.rng() * 4;
}

export function updatePeds(state, dt, world) {
  const player = world.player;
  const focus = player.inVehicle ? player.inVehicle.position : player.position;
  state.alertTimer = Math.max(0, state.alertTimer - dt);
  const gunfire = state.alertTimer > 0;

  for (const ped of state.peds) {
    if (!ped.group.visible) continue;
    if (ped.position.distanceTo(focus) > 340) {
      if (ped.mode !== 'dead') placePed(ped, state, focus, 300);
      continue;
    }
    if (ped.dead) {
      ped.knocked = Math.max(0, ped.knocked - dt);
      continue;
    }

    // Check for speeding cars that knock a pedestrian down.
    for (const car of world.vehicles) {
      if (car.exploded || Math.abs(car.speed) < 9) continue;
      if (Math.abs(car.position.x - ped.position.x) < car.width * 0.8 + 0.6 && Math.abs(car.position.z - ped.position.z) < car.length * 0.5 + 0.6) {
        knockDownPedestrian(ped, car, world);
        break;
      }
    }

    const distToPlayer = ped.position.distanceTo(player.position);
    if (gunfire && distToPlayer < 40) {
      ped.mode = 'flee';
      ped.flee = 4;
    }
    // React when the player aims at them within a few metres.
    if (player.aiming && distToPlayer < 22 && ped.mode !== 'flee') {
      ped.mode = 'flee';
      ped.flee = 2.5;
    }
    if (world.carjackAlert && ped.position.distanceTo(world.carjackAlert) < 16) {
      ped.mode = 'flee';
      ped.flee = 3;
    }

    if (ped.mode === 'flee') {
      ped.flee -= dt;
      const away = new THREE.Vector3().subVectors(ped.position, player.position).setY(0).normalize();
      ped.heading = Math.atan2(away.x, away.z);
      const run = 3.4;
      ped.position.addScaledVector(away, run * dt);
      animatePed(ped, dt, run * 2);
      if (ped.flee <= 0) { ped.mode = 'walk'; ped.speed = 1.2 + ped.rng() * 0.6; }
      continue;
    }

    // Idle at a bench, then walk again.
    ped.timer -= dt;
    if (ped.mode === 'idle') {
      animatePed(ped, dt, 0);
      if (ped.timer <= 0) { ped.mode = 'walk'; ped.timer = 3 + ped.rng() * 5; }
      continue;
    }
    if (ped.timer <= 0 && ped.rng() < 0.3) {
      ped.mode = 'idle';
      ped.timer = 2 + ped.rng() * 4;
      continue;
    }
    // Walk forward, veering a little, and turn at the block corner.
    ped.position.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.position.z += Math.cos(ped.heading) * ped.speed * dt;
    const ex = Math.abs(ped.position.x) > 720 || ped.position.z > 570 || ped.position.z < -720;
    if (ex || ped.rng() < 0.002) {
      ped.heading = Math.floor(ped.rng() * 4) * (Math.PI / 2);
    }
    animatePed(ped, dt, ped.speed * 3);
    ped.group.position.copy(ped.position);
    ped.group.rotation.y = ped.heading;
  }
}

function animatePed(ped, dt, rate) {
  ped.walkPhase += dt * rate;
  const swing = Math.sin(ped.walkPhase) * 0.5;
  ped.legL.rotation.x = swing;
  ped.legR.rotation.x = -swing;
  ped.armL.rotation.x = -swing * 0.7;
  ped.armR.rotation.x = swing * 0.7;
  ped.group.position.copy(ped.position);
  ped.group.rotation.y = ped.heading;
}

function knockDownPedestrian(ped, car, world) {
  ped.dead = true;
  ped.group.rotation.z = Math.PI / 2;
  ped.group.position.y = 0.4;
  world.onPedestrianHit?.(ped, car);
  world.audio?.play.impact?.(0.8);
}

export function alertCrowd(state, position, seconds = 4) {
  state.alertTimer = Math.max(state.alertTimer || 0, seconds);
  state.alerted = true;
}
