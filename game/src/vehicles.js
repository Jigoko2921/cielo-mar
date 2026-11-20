// Vehicles: eight original car models built from boxes and wedges (the Vela GT coupe, Brisa 4
// sedan, Mulo pickup, Panera van, Amarillo taxi, two PCM police models, and the Lancha boat),
// arcade physics with engine force, rolling drag, speed-scaled steering, handbrake drift and
// lateral slip, body roll and pitch, wheel spin, headlights and brake lights, accumulated impact
// damage with smoke and fire, and the traffic AI that follows lane centrelines, slows for corners,
// stops for the player and honks when blocked. Carjacking lives here too.

import { VEHICLE_SPECS, PALETTE, CITY, SEA_Z } from './config.js';

const CAR_COLORS = {
  vela: 0xb53a2a,
  brisa: 0x6d8f7d,
  mulo: 0x8d5b3f,
  panera: 0xd7ccc0,
  amarillo: 0xe8b62c,
  crucero: PALETTE.policeNavy,
  fuerte: PALETTE.policeNavy,
  lancha: 0xf4f1e8,
};

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.55, metalness: opts.metal ?? 0.15, flatShading: true, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.glow ?? 0 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Build a car group shaped by spec.kind: body, cabin, wheels, lights, and police livery. */
export function buildVehicleModel(kind, color) {
  const spec = VEHICLE_SPECS[kind];
  const group = new THREE.Group();
  const W = spec.width, L = spec.length, H = spec.height;
  const bodyColor = color ?? CAR_COLORS[kind];
  const isPolice = kind === 'crucero' || kind === 'fuerte';
  const isBoat = kind === 'boat';

  // Lower body.
  const body = box(W, H * 0.52, L, bodyColor);
  body.position.y = H * 0.42;
  group.add(body);

  if (isBoat) {
    const hull = box(W * 0.9, H * 0.5, L * 0.9, 0xf4f1e8);
    hull.position.y = H * 0.3;
    group.add(hull);
    const deck = box(W * 0.7, 0.15, L * 0.6, 0x8a6a4a);
    deck.position.set(0, H * 0.62, 0.4);
    group.add(deck);
    const cabinBoat = box(W * 0.6, 0.6, L * 0.25, 0xf4f1e8);
    cabinBoat.position.set(0, H * 0.9, -0.4);
    group.add(cabinBoat);
    const windshield = box(W * 0.52, 0.3, 0.06, 0x2a3a44, { metal: 0.5 });
    windshield.position.set(0, H * 1.05, 0.35);
    group.add(windshield);
    const stripe = box(W * 0.92, 0.1, L * 0.8, 0x2f8f9d);
    stripe.position.set(0, H * 0.45, 0);
    group.add(stripe);
    group.userData.kind = kind;
    return group;
  }

  // Cabin: lower and more rakish on the coupe, tall on the van/SUV.
  const cabinH = spec.kind === 'coupe' ? 0.5 : spec.kind === 'van' ? 1.25 : spec.kind === 'suv' ? 1.0 : 0.7;
  const cabinL = spec.kind === 'van' ? L * 0.7 : spec.kind === 'pickup' ? L * 0.38 : L * 0.5;
  const cabin = box(W * 0.86, cabinH, cabinL, bodyColor);
  const cabinZ = spec.kind === 'pickup' ? -L * 0.16 : spec.kind === 'van' ? L * 0.02 : 0;
  cabin.position.set(0, H * 0.42 + cabinH / 2 + H * 0.1, cabinZ);
  group.add(cabin);
  // Glass band.
  const glass = box(W * 0.8, cabinH * 0.62, cabinL * 0.94, 0x22323c, { metal: 0.6, rough: 0.2, emissive: 0x0a1218, glow: 0.2 });
  glass.position.copy(cabin.position);
  glass.position.y += 0.02;
  group.add(glass);

  if (spec.kind === 'pickup') {
    const bed = box(W * 0.92, 0.45, L * 0.4, bodyColor);
    bed.position.set(0, H * 0.5, L * 0.26);
    group.add(bed);
  }
  if (spec.kind === 'van') {
    const backCargo = box(W * 0.94, cabinH * 0.8, L * 0.5, 0xe8e2d4);
    backCargo.position.set(0, H * 0.42 + cabinH / 2 + H * 0.1, -L * 0.2);
    group.add(backCargo);
  }

  // Bumpers.
  const bumperMat = 0x2a2c2e;
  const fb = box(W * 0.95, 0.22, 0.3, bumperMat, { metal: 0.4 });
  fb.position.set(0, H * 0.28, L / 2 - 0.1);
  group.add(fb);
  const rb = box(W * 0.95, 0.22, 0.3, bumperMat, { metal: 0.4 });
  rb.position.set(0, H * 0.28, -L / 2 + 0.1);
  group.add(rb);

  // Wheels: four dark cylinders with a lighter hub; returned so physics can spin them.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9, flatShading: true });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.7, roughness: 0.35 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Group();
      const tyre = new THREE.Mesh(wheelGeo, wheelMat);
      tyre.rotation.z = Math.PI / 2;
      wheel.add(tyre);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.36, 8), hubMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      wheel.position.set(sx * W * 0.48, 0.42, sz * L * 0.33);
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
  }

  // Headlights and tail lights: emissive quads with a spotlight each at the front.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c0, emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a1010, emissive: 0xff2200, emissiveIntensity: 0.6 });
  const lights = [];
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    head.position.set(sx * W * 0.34, H * 0.48, L / 2 + 0.01);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat.clone());
    tail.position.set(sx * W * 0.34, H * 0.46, -L / 2 - 0.01);
    group.add(tail);
    lights.push({ head, tail });
  }
  const headlight = new THREE.SpotLight(0xfff2c0, 0, 60, 0.5, 0.5, 1.4);
  headlight.position.set(0, H * 0.5, L / 2);
  headlight.target.position.set(0, 0, L / 2 + 12);
  group.add(headlight);
  group.add(headlight.target);

  // Livery: police get a dark navy body already; add white door panels, a teal stripe and a lightbar.
  let lightbar = null;
  let sirenLamps = null;
  if (isPolice) {
    const panelMat = new THREE.MeshStandardMaterial({ color: PALETTE.policeWhite, roughness: 0.5, flatShading: true });
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, H * 0.36, L * 0.44), panelMat);
      door.position.set(sx * (W / 2 + 0.01), H * 0.4, 0.1);
      group.add(door);
    }
    const stripeMat = new THREE.MeshStandardMaterial({ color: PALETTE.policeStripe, roughness: 0.4, emissive: 0x0c4a44, emissiveIntensity: 0.4 });
    for (const sx of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, L * 0.9), stripeMat);
      stripe.position.set(sx * (W / 2 + 0.02), H * 0.55, 0);
      group.add(stripe);
    }
    const barMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.14, 0.4), barMat);
    bar.position.set(0, H * 0.42 + cabinH + H * 0.1 + 0.12, cabinZ);
    group.add(bar);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff1a1a, emissive: 0xff1a1a, emissiveIntensity: 2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1a4cff, emissive: 0x1a4cff, emissiveIntensity: 2 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.5), redMat);
    red.position.set(-0.55, H * 0.42 + cabinH + H * 0.1 + 0.24, cabinZ);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.5), blueMat);
    blue.position.set(0.55, H * 0.42 + cabinH + H * 0.1 + 0.24, cabinZ);
    group.add(blue);
    lightbar = { red, blue, redMat, blueMat };
    sirenLamps = { redMat, blueMat };
    // A spotlight the helicopter and cruisers can turn on.
    const spot = new THREE.SpotLight(0xffffff, 0, 40, 0.6, 0.6, 1.4);
    spot.position.set(0, H * 0.5, L / 2);
    spot.target.position.set(0, 0, L / 2 + 14);
    group.add(spot);
    group.add(spot.target);
  }

  group.userData.kind = kind;
  group.userData.wheels = wheels;
  group.userData.lights = lights;
  group.userData.headlight = headlight;
  group.userData.lightbar = lightbar;
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

let nextCarId = 1;

export function createVehicle(scene, kind, position, heading = 0, options = {}) {
  const spec = VEHICLE_SPECS[kind];
  const color = options.color ?? CAR_COLORS[kind];
  const mesh = buildVehicleModel(kind, color);
  mesh.position.set(position.x, 0, position.z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    id: nextCarId++,
    kind,
    spec,
    mesh,
    position: new THREE.Vector3(position.x, 0, position.z),
    speed: 0,
    heading,
    steer: 0,
    drift: 0,
    wheelSpin: 0,
    length: spec.length,
    width: spec.width,
    damage: 0,
    health: 100,
    burning: false,
    exploded: false,
    driver: options.driver ?? null,
    occupied: !!options.driver,
    parked: options.parked ?? false,
    traffic: options.traffic ?? false,
    lane: options.lane ?? 0,
    route: options.route ?? null,
    routeIndex: 0,
    player: null,
    police: options.police ?? false,
    color,
    headlightsOn: options.headlightsOn ?? false,
    braking: false,
    honkCooldown: 0,
    sirenPhase: Math.random() * 6,
    stuck: 0,
    smokeTimer: 0,
    radioStation: 0,
    wheels: mesh.userData.wheels,
    lastCollide: -99,
  };
  return car;
}

/** Spin the wheels, roll and pitch the body, and update the mesh transform from the car state. */
function syncMesh(car, dt, throttle, brake) {
  car.mesh.position.set(car.position.x, 0, car.position.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * dt * 2.4;
  for (const w of car.wheels) {
    w.children[0].rotation.x = car.wheelSpin;
    w.children[1].rotation.x = car.wheelSpin;
  }
  const roll = THREE.MathUtils.clamp(car.steer * car.speed * 0.006, -0.09, 0.09);
  const pitch = THREE.MathUtils.clamp((throttle - brake) * 0.02, -0.05, 0.05);
  car.mesh.rotation.z = -roll;
  car.mesh.rotation.x = pitch;
  const lights = car.mesh.userData.lights;
  if (lights) {
    for (const l of lights) {
      l.tail.material.emissiveIntensity = car.braking || brake > 0 ? 2.4 : 0.6;
    }
  }
  const headlight = car.mesh.userData.headlight;
  if (headlight) headlight.intensity = car.headlightsOn ? 3 : 0;
  if (car.mesh.userData.lightbar) {
    car.sirenPhase += dt * 10;
    const red = car.mesh.userData.lightbar.redMat;
    const blue = car.mesh.userData.lightbar.blueMat;
    const flash = Math.sin(car.sirenPhase) > 0;
    red.emissiveIntensity = flash ? 3 : 0.2;
    blue.emissiveIntensity = flash ? 0.2 : 3;
  }
}

function collidesAt(x, z, heading, car, colliders) {
  // Approximate the car as a circle of half its length; test the four wheel corners against boxes.
  const cos = Math.cos(heading), sin = Math.sin(heading);
  const hl = car.length * 0.42, hw = car.width * 0.45;
  const pts = [
    [x + cos * hl, z - sin * hl], [x - cos * hl, z + sin * hl],
    [x + sin * hw, z + cos * hw], [x - sin * hw, z - cos * hw],
  ];
  for (const [px, pz] of pts) {
    for (const c of colliders) {
      if (c.height < 1.0) continue;
      if (px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ) return c;
    }
  }
  return null;
}

export function damageVehicle(car, amount, world) {
  if (car.exploded) return;
  car.damage = Math.min(100, car.damage + amount);
  car.health = 100 - car.damage;
  if (car.damage > 85 && !car.burning) {
    car.burning = true;
    world.audio?.play.impact?.(1.5);
  }
  if (car.damage >= 100 && !car.exploded) {
    explodeVehicle(car, world);
  }
}

function explodeVehicle(car, world) {
  car.exploded = true;
  car.occupied = false;
  car.mesh.visible = false;
  for (let i = 0; i < 40; i += 1) {
    world.rendererState.sparks.spawn(car.position.x, 1, car.position.z, (Math.random() - 0.5) * 18, Math.random() * 14, (Math.random() - 0.5) * 18, 0.4 + Math.random() * 0.4, 0.6 + Math.random() * 0.6, 0xffb347, 6, 0.4);
  }
  for (let i = 0; i < 12; i += 1) {
    world.rendererState.smokes.spawn(car.position.x, 1.4, car.position.z, (Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4, 1.4, 2, 0x2a2a2a, -1, 3, 0.7);
  }
  world.audio?.play.explosion?.();
  world.onVehicleExploded?.(car);
}

/** Arcade physics for one car. Controls come from the player while driving, or the traffic AI. */
export function updateVehicle(car, dt, world) {
  if (car.exploded) return;
  const spec = car.spec;
  let throttle = 0;
  let brake = 0;
  let steerInput = 0;
  let handbrake = false;

  if (car === world.playerCar) {
    const p = world.player;
    const input = world.input;
    if (input.isDown('forward')) throttle = 1;
    if (input.isDown('back')) { if (car.speed > 2) brake = 1; else throttle = -1; }
    if (input.isDown('left')) steerInput += 1;
    if (input.isDown('right')) steerInput -= 1;
    handbrake = input.isDown('jump');
  } else if (car.police) {
    ({ throttle, steerInput, brake } = car.aiDrive(world, dt));
  } else if (car.traffic) {
    ({ throttle, steerInput, brake } = trafficDrive(car, world, dt));
  }

  const maxSpeed = spec.top;
  const enginePower = spec.engine;
  car.braking = brake > 0;
  if (throttle > 0) car.speed += enginePower * throttle * dt * (1 - Math.max(0, car.speed) / maxSpeed);
  else if (throttle < 0) car.speed += enginePower * throttle * dt * 0.6;
  if (brake > 0) car.speed -= Math.sign(car.speed) * 26 * brake * dt;
  if (handbrake) car.speed *= 1 - dt * 1.8;

  // Rolling drag and off-road slowdown.
  const offRoad = Math.abs(car.position.z) > SEA_Z + 6 || car.position.z > SEA_Z;
  car.speed *= 1 - dt * (offRoad ? 1.6 : 0.35);
  if (!throttle && !brake) car.speed *= 1 - dt * 0.5;
  car.speed = THREE.MathUtils.clamp(car.speed, -maxSpeed * 0.35, maxSpeed);

  const speedFactor = Math.min(1, Math.abs(car.speed) / 14);
  car.steer += (steerInput - car.steer) * Math.min(1, dt * 6);
  const turn = car.steer * (2.0 - speedFactor * 1.0) * Math.min(1, Math.abs(car.speed) / 5);
  car.heading += turn * dt * (car.speed >= 0 ? 1 : -1);
  car.drift += ((handbrake ? 0.85 : 0.15) - car.drift) * Math.min(1, dt * 3);

  const nx = car.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.position.z + Math.cos(car.heading) * car.speed * dt;
  const hit = collidesAt(nx, nz, car.heading, car, world.colliders);
  if (hit) {
    const impact = Math.abs(car.speed);
    if (impact > 6) {
      damageVehicle(car, impact * 0.9, world);
      world.audio?.play.impact?.(impact / 20);
      world.rendererState?.sparks.spawn(nx, 1, nz, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0.3, 0.3, 0xffcf87, 9, 0);
      world.onVehicleImpact?.(car, impact);
    }
    car.speed *= -0.25;
  } else {
    car.position.x = nx;
    car.position.z = nz;
  }

  // The sea stops traffic and the boat can float on it.
  if (car.kind !== 'boat' && car.position.z > SEA_Z + 4) {
    car.position.z = SEA_Z + 4;
    car.speed *= -0.3;
  }
  car.position.x = THREE.MathUtils.clamp(car.position.x, -CITY - 60, CITY + 60);

  syncMesh(car, dt, throttle, brake);

  if (car.parked) return;

  // Collisions with the player on foot and pedestrians are asked of the caller (world).
  world.resolveVehicleHits?.(car);

  // Smoke then fire when damaged, and burning cars tick damage.
  if (car.damage > 45 || car.burning) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = car.burning ? 0.06 : 0.18;
      const color = car.burning ? 0xff7a2a : 0x5a5650;
      world.rendererState.smokes.spawn(car.position.x + (Math.random() - 0.5), 1.2, car.position.z + (Math.random() - 0.5), (Math.random() - 0.5), 1.5 + Math.random(), (Math.random() - 0.5), 0.9, car.burning ? 0.5 : 0.8, color, -0.5, 2.2, car.burning ? 0.9 : 0.5);
    }
    if (car.burning) damageVehicle(car, dt * 4, world);
  }

  if (car.police) {
    world.audio?.updateSiren?.(car, world.wanted);
  }
}

/** Mark the parked and traffic cars' headlights on in the evening and off at noon. */
export function updateHeadlights(vehicles, evening) {
  for (const car of vehicles) car.headlightsOn = evening || car.headlightsOn;
}

let trafficCursor = 0;
const TRAFFIC_COUNTS = { brisa: 3, mulo: 2, panera: 1, amarillo: 3, vela: 1, fuerte: 0 };
const TRAFFIC_KINDS = ['brisa', 'brisa', 'brisa', 'mulo', 'mulo', 'panera', 'amarillo', 'amarillo', 'amarillo', 'vela'];

/** Spawn traffic on the road grid out of view of the player, each on a lane with a heading. */
export function spawnTraffic(scene, world, count = 26) {
  const roads = world.city.roads;
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const kind = TRAFFIC_KINDS[i % TRAFFIC_KINDS.length];
    const useNS = Math.random() < 0.5;
    const line = roads[5 + Math.floor(Math.random() * (roads.length - 10))];
    const along = -CITY + 40 + Math.random() * (CITY * 2 - 80);
    const lane = (Math.random() < 0.5 ? -1 : 1) * 4;
    const pos = useNS
      ? { x: line + lane, z: along }
      : { x: along, z: line - lane };
    const heading = useNS ? (lane > 0 ? Math.PI : 0) : (lane > 0 ? -Math.PI / 2 : Math.PI / 2);
    if (pos.z > SEA_Z - 20) { pos.z = SEA_Z - 40; }
    const car = createVehicle(scene, kind, pos, heading, { traffic: true, driver: 'civilian' });
    car.useNS = useNS;
    car.laneLine = line;
    car.speed = 6 + Math.random() * 5;
    car.heading = heading;
    cars.push(car);
  }
  return cars;
}

/** Traffic AI: keep to the lane centre, slow for corners, stop for the player and each other. */
function trafficDrive(car, world, dt) {
  let throttle = 1;
  let brake = 0;
  let steerInput = 0;
  // Stay on the lane: steer back toward the line's lane.
  const laneTarget = car.laneLine + (car.useNS ? car.laneOffset ?? 4 : -(car.laneOffset ?? 4));
  if (car.useNS) {
    const dx = laneTarget - car.position.x;
    steerInput = THREE.MathUtils.clamp(-dx * 0.08, -0.5, 0.5);
    // Turn at the next intersection.
    const nextNode = Math.round((car.position.z + CITY * 0.5) / 80) * 80 - CITY * 0.5;
    const ahead = (car.heading > 0 ? 1 : -1) * (nextNode - car.position.z);
    if (ahead > 0 && ahead < 12 && car.turnCooldown <= 0) {
      brake = 0.5;
    }
  } else {
    const dz = laneTarget - car.position.z;
    steerInput = THREE.MathUtils.clamp(dz * 0.08 * (car.heading > 0 ? 1 : -1), -0.5, 0.5);
  }
  car.turnCooldown = (car.turnCooldown ?? 0) - dt;

  // Stop for anything ahead (player car, player on foot, other traffic, police).
  const aheadDir = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
  const ahead = car.position.clone().addScaledVector(aheadDir, 9);
  let blocked = false;
  if (world.playerCar && world.playerCar !== car) {
    if (ahead.distanceTo(world.playerCar.position) < 7) blocked = true;
  }
  for (const other of world.vehicles) {
    if (other === car || other.exploded) continue;
    if (ahead.distanceTo(other.position) < 6 && other.speed < car.speed) blocked = true;
  }
  if (!world.player.inVehicle) {
    if (ahead.distanceTo(world.player.position) < 6) blocked = true;
  }
  if (blocked) {
    throttle = 0;
    brake = 1;
    car.stuck += dt;
    if (car.stuck > 1.5 && car.honkCooldown <= 0) {
      world.audio?.play.horn?.();
      car.honkCooldown = 3;
    }
  } else {
    car.stuck = Math.max(0, car.stuck - dt);
  }
  car.honkCooldown = (car.honkCooldown ?? 0) - dt;

  // Despawn far behind the player and respawn on another line out of sight.
  const focus = world.player.inVehicle ? world.playerCar.position : world.player.position;
  if (car.position.distanceTo(focus) > 600) {
    respawnTraffic(car, world, focus);
  }
  return { throttle, steerInput, brake };
}

function respawnTraffic(car, world, focus) {
  const roads = world.city.roads;
  for (let tries = 0; tries < 12; tries += 1) {
    const line = roads[5 + Math.floor(Math.random() * (roads.length - 10))];
    const along = focus.z + (Math.random() < 0.5 ? -320 : 320);
    const pos = { x: line + 4, z: along };
    if (pos.z > SEA_Z - 30 || pos.z < -CITY + 30) continue;
    car.position.set(pos.x, 0, pos.z);
    car.heading = Math.random() < 0.5 ? 0 : Math.PI;
    car.useNS = true;
    car.laneLine = line;
    car.speed = 6;
    car.mesh.position.set(pos.x, 0, pos.z);
    car.mesh.rotation.y = car.heading;
    return;
  }
}

/** Carjacking: the civilian driver flees, the player takes the wheel. Returns the vehicle or null. */
export function stealVehicle(player, car, world) {
  if (car.exploded || car.kind === 'boat' && !world.nearWater(player)) return null;
  if (car.driver && car.driver !== 'player') {
    car.driver = null;
    car.traffic = false;
    car.parked = false;
    car.occupied = true;
    world.onCarjack?.(car);
    // A fleeing pedestrian appears beside the car.
    world.peds?.spawnFleeingPedestrian?.(car.position, car.heading);
  }
  car.traffic = false;
  car.driver = 'player';
  car.occupied = true;
  world.playerCar = car;
  return car;
}

/** Find the nearest enterable car within reach of the player. */
export function nearestVehicle(player, vehicles, maxDist = 4.5) {
  let best = null;
  let bestD = maxDist;
  for (const car of vehicles) {
    if (car.exploded) continue;
    const d = car.position.distanceTo(player.position);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

export function seatPlayerInVehicle(world, car) {
  const { player } = world;
  world.playerCar = car;
  car.driver = 'player';
  car.occupied = true;
  car.traffic = false;
  car.police = false;
  car.parked = false;
  player.inVehicle = car;
  player.group.visible = false;
  if (car.mesh.userData.lightbar) car.mesh.userData.lightbar.redMat.emissiveIntensity = 0.2;
}

export function removePlayerFromVehicle(world, car) {
  const { player } = world;
  player.inVehicle = null;
  player.group.visible = true;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading)).multiplyScalar(2.4);
  player.position.set(car.position.x + side.x, 0.2, car.position.z + side.z);
  player.group.position.copy(player.position);
  player.velocity.set(0, 0, 0);
  if (world.playerCar === car) world.playerCar = null;
  car.driver = null;
  if (!car.police) car.parked = true;
}

export { CAR_COLORS, TRAFFIC_COUNTS };
