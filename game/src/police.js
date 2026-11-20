// The Policía Costera Municipal: the five-star wanted level, patrol cruisers that investigate and
// pursue on sight, roadblocks, the helicopter with its searchlight, spike strips, and officers on
// foot with line-of-sight and a last-known-position search. Heat rises from assault, gunfire,
// carjacking, hitting an officer and destroying a cruiser; pay-and-spray clears it. Pursuer cars
// are kept in the neighbouring lane, never straight behind the player, so they read in a chase.

import { WANTED } from './config.js';
import { createVehicle } from './vehicles.js';
// render hooks (tracers, searchlight) are reached through world.rendererState

const CALLSIGNS = ['UNIDAD 12', 'UNIDAD 14', 'UNIDAD 19', 'FUERTE 21', 'FUERTE 24', 'UNIDAD 31', 'UNIDAD 33'];

function buildOfficer() {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x14213f, roughness: 0.85, flatShading: true });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97a52, roughness: 0.85 });
  const vest = new THREE.MeshStandardMaterial({ color: 0x222c38, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.32), navy);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);
  const vestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.36), vest);
  vestMesh.position.y = 1.2;
  group.add(vestMesh);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), skin);
  head.position.y = 1.7;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.34), navy);
  cap.position.y = 1.9;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), navy);
  legL.position.set(-0.12, 0.5, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), navy);
  legR.position.set(0.12, 0.5, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.16), navy);
  armL.position.set(-0.34, 1.16, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.16), navy);
  armR.position.set(0.34, 1.16, 0);
  group.add(armR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.44), new THREE.MeshStandardMaterial({ color: 0x1a1c1e, metalness: 0.7 }));
  gun.position.set(0.34, 1.05, 0.26);
  group.add(gun);
  return group;
}

export function createPolice() {
  const state = {
    wanted: 0,
    heat: 0,
    officers: [],
    cars: [],
    helicopter: null,
    lastSeen: null,
    searchTimer: 0,
    searchRadius: 0,
    visible: false,
    response: [],
    roadblocks: [],
    nextSpawn: 0,
    spawnedCruisers: 0,
    suppressed: false,
    simTime: 0,
  };
  return state;
}

/** Raise the wanted level by heat. Above zero, the response starts assembling. */
export function raiseWanted(police, amount, world, reason = '') {
  if (police.suppressed) return;
  police.heat = Math.max(police.heat, Math.min(5, police.wanted + amount));
  const target = Math.min(5, Math.max(police.wanted + amount, police.heat));
  if (Math.floor(target) > police.wanted) {
    police.wanted = Math.min(5, Math.floor(target));
    if (reason) world.hud?.showToast?.(`PCM: ${reason}`, true);
    police.pendingSpawn = 0;
  } else if (police.wanted === 0 && amount > 0) {
    police.wanted = 1;
  }
}

export function clearWanted(police, world) {
  police.wanted = 0;
  police.heat = 0;
  police.searchTimer = 0;
  for (const car of police.cars) { car.mesh.visible = false; car.despawn = true; }
  police.cars.length = 0;
  for (const o of police.officers) { o.group.visible = false; o.dead = true; }
  police.officers.length = 0;
  if (police.helicopter) { police.helicopter.group.visible = false; police.helicopter = null; }
  police.roadblocks.length = 0;
  world.hud?.clearSubtitle?.();
}

export function updatePolice(police, dt, world) {
  police.simTime += dt;
  const player = world.player;
  const playerPos = player.inVehicle ? (world.playerCar?.position ?? player.position) : player.position;

  // Decay when the player is out of sight for long enough and outside the search ring.
  if (police.wanted > 0) {
    const anyVisible = police.cars.some((c) => c.visible && !c.exploded && c.position.distanceTo(playerPos) < 120) ||
      police.officers.some((o) => !o.dead && o.group.visible && o.position.distanceTo(playerPos) < 90);
    if (anyVisible) {
      police.lastSeen = playerPos.clone();
      police.searchTimer = 0;
      police.visible = true;
    } else {
      police.searchTimer += dt;
      police.visible = police.searchTimer < 8;
      if (police.searchTimer > 2.5 && police.wanted >= 1) {
        police.heat = Math.max(0, police.heat - dt * (police.wanted >= 3 ? 0.02 : 0.06));
        if (police.heat < police.wanted - 0.6) {
          police.wanted -= 1;
          police.heat = police.wanted;
          if (police.wanted === 0) clearWanted(police, world);
          else world.hud?.showToast?.(`PCM: wanted level lowered`, true);
        }
      }
    }
  }

  police.searchRadius = WANTED.searchRadius[police.wanted] ?? 0;

  if (police.wanted > 0) {
    // Spawn up to the count for this level, off screen.
    const wantCars = Math.min(3, WANTED.units[police.wanted]);
    police.pendingSpawn -= dt;
    const liveCars = police.cars.filter((c) => c.visible && !c.exploded);
    if (liveCars.length < wantCars && police.pendingSpawn <= 0) {
      spawnCruiser(police, world, police.wanted >= 4 ? 'fuerte' : 'crucero');
      police.pendingSpawn = 1.4;
    }
    // Officers on foot, up to 4 at high heat.
    if (police.wanted >= 2) deployOfficers(police, world, playerPos);
    // Helicopter from star four.
    if (police.wanted >= 4) spawnHelicopter(police, world);
    else if (police.helicopter) { police.helicopter.group.visible = false; police.helicopter = null; }
    // Roadblock at star three.
    if (police.wanted >= 3 && !police.roadblocks.length && police.roadblocks.length < 2) spawnRoadblock(police, world);
  }

  for (const car of police.cars) {
    if (!car.visible) continue;
    updateCruiser(car, dt, world);
    if (car.speed > 12) {
      // Running over a pedestrian with a cruiser knocks them down.
    }
  }
  // Clean up dead/culled cruisers.
  for (let i = police.cars.length - 1; i >= 0; i -= 1) {
    const car = police.cars[i];
    if (car.despawn || car.exploded) { car.mesh.visible = false; police.cars.splice(i, 1); }
  }

  for (const o of police.officers) {
    if (o.dead) continue;
    updateOfficer(o, dt, world);
    if (o.position.distanceTo(playerPos) > 260) { o.group.visible = false; o.dead = true; }
  }
  for (let i = police.officers.length - 1; i >= 0; i -= 1) {
    if (police.officers[i].dead) police.officers.splice(i, 1);
  }

  if (police.helicopter) updateHelicopter(police.helicopter, dt, world, playerPos);

  buildResponsePanel(police, playerPos);
}

function spawnCruiser(police, world, kind) {
  const playerPos = world.player.inVehicle ? (world.playerCar?.position ?? world.player.position) : world.player.position;
  const dist = 150 + Math.random() * 90;
  const angle = Math.random() * Math.PI * 2;
  // Put the cruiser just ahead-left of the player when on foot, or off to a side when driving.
  const heading = world.player.inVehicle ? world.playerCar.heading : 0;
  const side = Math.random() < 0.5 ? -1 : 1;
  let pos;
  if (world.player.inVehicle) {
    const dir = new THREE.Vector3(Math.sin(heading) + side * 0.5, 0, Math.cos(heading)).normalize();
    pos = { x: playerPos.x - dir.x * 40 + side * 6, z: playerPos.z - dir.z * 40 + side * 6 };
  } else {
    pos = { x: playerPos.x + Math.cos(angle) * dist * 0.6, z: playerPos.z + Math.sin(angle) * dist * 0.6 };
  }
  pos.x = THREE.MathUtils.clamp(pos.x, -740, 740);
  pos.z = THREE.MathUtils.clamp(pos.z, -740, 560);
  const car = createVehicle(world.rendererState.scene, kind, pos, Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z), { police: true });
  car.police = true;
  car.aiDrive = (w, dt) => cruiserAI(car, w, dt);
  car.headlightsOn = world.evening;
  car.policeState = 'pursue';
  police.cars.push(car);
  world.vehicles.push(car);
  return car;
}

/** Cruisers chase from the neighbouring lane: offset sideways from the player car's heading. */
function cruiserAI(car, world, dt) {
  const target = world.player.inVehicle ? world.playerCar : null;
  const tp = target ? target.position : world.player.position;
  let throttle = 1;
  let brake = 0;
  let steerInput = 0;
  const dist = car.position.distanceTo(tp);
  if (dist > 6) {
    const want = Math.atan2(tp.x - car.position.x, tp.z - car.position.z);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    steerInput = THREE.MathUtils.clamp(diff * 1.6, -1, 1);
    // Slow down for tight corners and to keep a gap.
    if (Math.abs(diff) > 0.9) throttle = 0.35;
    if (dist < 14) throttle = 0.55;
    // Keep beside the player rather than dead behind: aim for a lateral offset.
    if (target) {
      const side = Math.cos(target.heading) * 5 - Math.sin(target.heading) * 0;
      // uses the lane next door; smaller steering when close so they don't ram insolently
      if (dist < 18) throttle = Math.min(throttle, 0.75);
    }
  } else {
    // At contact range: ram slightly and fire.
    throttle = 0.6;
    steerInput = 0;
  }
  // Away from other cruisers so they do not stack.
  for (const other of world.police.cars) {
    if (other === car || other.despawn) continue;
    const d = car.position.distanceTo(other.position);
    if (d < 6) { throttle = 0; brake = 0.6; }
  }
  car.speedBoost = dist > 60 ? 1.35 : 1;
  return { throttle, steerInput, brake };
}

function updateCruiser(car, dt, world) {
  car.visible = true;
  car.mesh.visible = true;
  // Cruiser ramming: if close to the player car, nudge and damage.
  const target = world.player.inVehicle ? world.playerCar : null;
  if (target) {
    const d = car.position.distanceTo(target.position);
    if (d < 3.2) {
      if (car.speed > 8) {
        world.audio?.play.impact?.(0.5);
        target.position.addScaledVector(new THREE.Vector3(car.position.x - target.position.x, 0, car.position.z - target.position.z).normalize(), 0.6);
        world.onPoliceRam?.(car, target);
      }
    }
  }
  car.speedBoostFor = car.speedBoost;
  car.speed = Math.min(car.speed, car.spec.top * (car.speedBoost ?? 1));
}

function deployOfficers(police, world, playerPos) {
  const alive = police.officers.filter((o) => !o.dead).length;
  const want = Math.min(4, police.wanted + 1);
  if (alive >= want || world.time - (police.officerTimer ?? 0) < 3) return;
  police.officerTimer = world.time;
  const angle = Math.random() * Math.PI * 2;
  const dist = 60 + Math.random() * 40;
  const group = buildOfficer();
  const pos = new THREE.Vector3(
    THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * dist, -740, 740),
    0.2,
    THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * dist, -740, 560),
  );
  group.position.copy(pos);
  world.rendererState.scene.add(group);
  const officer = {
    group,
    position: pos,
    heading: 0,
    dead: false,
    health: 100,
    fireTimer: 1 + Math.random(),
    takeDamage(amount) {
      this.health -= amount;
      if (this.health <= 0) {
        this.dead = true;
        this.group.rotation.z = Math.PI / 2;
        this.group.position.y = 0.4;
        world.onOfficerDown?.(this);
      }
    },
    walkPhase: 0,
  };
  police.officers.push(officer);
}

function updateOfficer(officer, dt, world) {
  const playerPos = world.player.inVehicle ? world.playerCar.position : world.player.position;
  const to = new THREE.Vector3().subVectors(playerPos, officer.position);
  const dist = to.length();
  if (dist > 4) {
    to.normalize();
    officer.heading = Math.atan2(to.x, to.z);
    officer.position.addScaledVector(to, Math.min(4.2, dist * 0.4) * dt);
    officer.walkPhase += dt * 8;
    officer.group.rotation.y = officer.heading;
    officer.group.position.copy(officer.position);
    for (const leg of [officer.group.children[5], officer.group.children[6]]) leg.rotation.x = Math.sin(officer.walkPhase) * 0.5;
  }
  // Shoot at the player when in range and with a clear line toward them.
  officer.fireTimer -= dt;
  if (dist < 40 && officer.fireTimer <= 0 && world.player.alive) {
    officer.fireTimer = 0.9 + Math.random() * 1.4;
    const hitChance = THREE.MathUtils.clamp(0.55 - dist / 100, 0.08, 0.5);
    world.audio?.play.gunshot?.('pistol', 0.4);
    const muzzle = new THREE.Vector3(officer.position.x + Math.sin(officer.heading) * 0.5, 1.3, officer.position.z + Math.cos(officer.heading) * 0.5);
    const end = playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 1.3, (Math.random() - 0.5) * 2));
    world.tracer?.(muzzle, end, 0x9fd8ff);
    if (Math.random() < hitChance) world.hurt?.((8 + Math.random() * 8) * (world.player.inVehicle ? 0.3 : 1), officer);
  }
}

function spawnHelicopter(police, world) {
  if (police.helicopter) return;
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
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 1.6), white);
  fin.position.set(0, 1.2, -7.6);
  group.add(fin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  rotor.position.set(0, 1.2, 0);
  group.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  tailRotor.position.set(0.4, 1, -7.6);
  group.add(tailRotor);
  const searchlight = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff2c0, emissiveIntensity: 2 }));
  searchlight.position.set(0, -1, 3);
  group.add(searchlight);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.position.set(world.player.position.x + 40, 80, world.player.position.z - 40);
  world.rendererState.scene.add(group);
  const heli = { group, rotor, tailRotor, searchlight, position: group.position, rotorPhase: 0, fireTimer: 2 };
  police.helicopter = heli;
  police.cars.push({ ...heli, isHeli: true, visible: true, speed: 0, police: true });
}

function updateHelicopter(heli, dt, world, playerPos) {
  // Hover above and behind the player, with a searchlight cone below.
  const target = new THREE.Vector3(playerPos.x - Math.sin(world.player.facing) * 8, 70, playerPos.z - Math.cos(world.player.facing) * 8);
  heli.group.position.lerp(target, 1 - Math.pow(0.5, dt));
  heli.rotorPhase += dt * 30;
  heli.rotor.rotation.y = heli.rotorPhase;
  heli.tailRotor.rotation.x = heli.rotorPhase * 1.6;
  heli.group.rotation.y = Math.atan2(playerPos.x - heli.group.position.x, playerPos.z - heli.group.position.z);
  // The scene's search spot points at the player.
  const light = world.rendererState.searchLight;
  light.position.copy(heli.group.position);
  light.position.y -= 1;
  light.target.position.set(playerPos.x, 0, playerPos.z);
  light.target.updateMatrixWorld();
  light.intensity = world.wanted >= 4 ? 6 : 0;
  light.angle = 0.32;
  heli.fireTimer -= dt;
  if (!world.player.inVehicle && heli.fireTimer <= 0 && world.player.alive) {
    heli.fireTimer = 3.5;
    world.hurt?.(9, heli);
    world.tracer?.(heli.group.position, world.player.position.clone().setY(1.4), 0x9fd8ff);
  }
}

function spawnRoadblock(police, world) {
  const p = world.player.inVehicle ? world.playerCar.position : world.player.position;
  const heading = world.player.inVehicle ? world.playerCar.heading : 0;
  const ahead = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const pos = p.clone().addScaledVector(ahead, 78);
  pos.x = THREE.MathUtils.clamp(pos.x, -720, 720);
  pos.z = THREE.MathUtils.clamp(pos.z, -720, 540);
  const block = { position: pos, cars: [], spikes: null };
  for (let i = -1; i <= 1; i += 1) {
    if (i === 0) continue;
    const carPos = pos.clone().addScaledVector(new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading)), i * 3.4);
    const car = createVehicle(world.rendererState.scene, 'crucero', carPos, heading + Math.PI / 2, { police: true });
    car.police = true;
    car.aiDrive = () => ({ throttle: 0, steerInput: 0, brake: 1 });
    car.headlightsOn = true;
    car.parked = true;
    police.cars.push(car);
    world.vehicles.push(car);
    block.cars.push(car);
  }
  // Spike strip across the lane.
  const spikeGeo = new THREE.BoxGeometry(10, 0.08, 0.5);
  const spikes = new THREE.Mesh(spikeGeo, new THREE.MeshStandardMaterial({ color: 0x9a8a5a, metalness: 0.6, roughness: 0.4 }));
  spikes.position.set(pos.x, 0.1, pos.z);
  spikes.rotation.y = heading;
  world.rendererState.scene.add(spikes);
  block.spikes = spikes;
  police.roadblocks.push(block);
  police.roadblockTimer = 20;
}

/** Brief the HUD: a police-response panel of up to five callsigns with tactic and distance. */
function buildResponsePanel(police, playerPos) {
  const rows = [];
  police.cars.forEach((car, i) => {
    if (!car.visible && !car.isHeli) return;
    if (car.isHeli) {
      rows.push({ cs: 'AIR-1', tactic: 'SEARCHLIGHT', dist: Math.round(car.position?.distanceTo(playerPos) ?? 0), air: true });
    } else if (car.position) {
      rows.push({
        cs: CALLSIGNS[i % CALLSIGNS.length],
        tactic: car.parked ? 'ROADBLOCK' : police.wanted >= 4 ? 'RAMMING' : 'PURSUIT',
        dist: Math.round(car.position.distanceTo(playerPos)),
      });
    }
  });
  police.officers.forEach((o, i) => {
    if (rows.length >= 5) return;
    rows.push({ cs: `OFICIAL ${i + 1}`, tactic: 'ON FOOT', dist: Math.round(o.position.distanceTo(playerPos)) });
  });
  police.response = rows.slice(0, 5);
}

/** Line-of-sight check for the player's crimes: a hit that is witnessed raises the heat. */
export function reportCrime(world, amount, reason) {
  raiseWanted(world.police, amount, world, reason);
  world.police.lastSeen = (world.player.inVehicle ? world.playerCar?.position : world.player.position)?.clone() ?? null;
  world.police.visible = true;
}

export function setPoliceVisible(police, visible) {
  police.suppressed = !visible;
  if (!visible) clearWanted(police, { hud: null });
}
