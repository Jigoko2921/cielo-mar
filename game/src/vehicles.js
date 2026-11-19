// Original vehicles, arcade driving, theft, deterministic traffic and collision damage.
import { VEHICLES, WORLD, PALETTE, choose, clamp, angleDelta, distance2D } from './config.js';
import { GeometryBatch } from './render.js';

function makeWedge(width, height, depth) {
  const x = width / 2, z = depth / 2;
  const vertices = new Float32Array([
    -x,0,-z, x,0,-z, x,0,z, -x,0,-z, x,0,z, -x,0,z,
    -x,0,z, x,0,z, x,height,z*0.45, -x,0,z, x,height,z*0.45, -x,height,z*0.45,
    -x,0,-z, -x,height,-z*0.35, x,height,-z*0.35, -x,0,-z, x,height,-z*0.35, x,0,-z,
    -x,height,-z*0.35, -x,height,z*0.45, x,height,z*0.45, -x,height,-z*0.35, x,height,z*0.45, x,height,-z*0.35,
    -x,0,-z, -x,0,z, -x,height,z*0.45, -x,0,-z, -x,height,z*0.45, -x,height,-z*0.35,
    x,0,-z, x,height,z*0.45, x,0,z, x,0,-z, x,height,-z*0.35, x,height,z*0.45,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildVehicleBody(type, spec, colour) {
  const batch = new GeometryBatch();
  const w = spec.width, l = spec.length;
  const dark = 0x26383d, trim = 0x343b3c;
  if (type === 'boat') {
    batch.box(0, 0.55, -0.4, w, 0.7, l * 0.75, colour);
    batch.primitive(makeWedge(w, 0.8, l * 0.35), 0, 0.45, l * 0.32, colour);
    batch.box(0, 1.05, -0.6, w * 0.88, 0.18, l * 0.55, 0xe1c69d);
    batch.box(0, 1.7, -0.4, w * 0.72, 1.25, 1.7, 0xece1c7);
    batch.primitive(makeWedge(w * 0.74, 0.8, 1.3), 0, 1.25, 0.55, 0x315a62);
    batch.box(0, 1.7, -l * 0.48, 0.8, 1.5, 0.75, 0x333b3d);
    batch.box(w * 0.25, 2.5, -0.2, 0.12, 1.7, 0.12, 0xd6d0b8);
    return batch.finish('Sirena 27 hull and cabin');
  }
  batch.box(0, 0.62, 0, w, 0.62, l, colour);
  batch.box(0, 0.39, 0, w * 0.96, 0.22, l * 0.97, trim);
  if (spec.kind === 'coupe') {
    batch.box(0, 1.04, 1.35, w * 0.96, 0.3, 1.55, colour);
    batch.primitive(makeWedge(w * 0.83, 0.78, 2.25), 0, 0.94, -0.3, dark);
    batch.box(0, 1.66, -0.52, w * 0.76, 0.12, 1.45, colour);
    batch.box(0, 1.12, -l * 0.49, w * 1.02, 0.11, 0.45, trim);
    batch.box(0, 1.08, 1.89, w * 0.65, 0.11, 0.08, 0xc5b084);
  } else if (spec.kind === 'pickup') {
    batch.box(0, 1.15, 1.25, w * 0.94, 0.65, 1.35, colour);
    batch.primitive(makeWedge(w * 0.85, 0.95, 1.75), 0, 1.04, 0.55, dark);
    batch.box(0, 2.0, 0.38, w * 0.83, 0.16, 1.25, colour);
    batch.box(0, 0.87, -1.45, w * 0.86, 0.2, 1.65, 0x524c41);
    batch.box(-w * 0.43, 1.12, -1.45, 0.16, 0.65, 1.8, colour);
    batch.box(w * 0.43, 1.12, -1.45, 0.16, 0.65, 1.8, colour);
    batch.box(0, 1.12, -l * 0.47, w * 0.85, 0.65, 0.14, colour);
  } else if (spec.kind === 'van') {
    batch.box(0, 1.55, -0.45, w * 0.95, 1.6, l * 0.76, colour);
    batch.primitive(makeWedge(w * 0.87, 0.86, 1.45), 0, 1.05, 1.48, dark);
    batch.box(w * 0.48, 1.65, -0.6, 0.05, 0.75, 2.65, 0x45646a);
    batch.box(0, 1.56, -l * 0.48, w * 0.83, 1.12, 0.07, 0xd5c79f);
    batch.box(w * 0.49, 1.15, -0.4, 0.08, 0.12, 3.65, 0x397f79);
  } else {
    const tall = spec.kind === 'suv' ? 1.2 : 0.92;
    batch.primitive(makeWedge(w * 0.85, tall, 2.4), 0, 0.92, -0.3, dark);
    batch.box(0, 0.92 + tall, -0.42, w * 0.78, 0.16, 1.55, colour);
    batch.box(0, 1.02, 1.35, w * 0.92, 0.28, 1.4, colour);
    if (spec.kind === 'suv') batch.box(0, 2.2, -0.4, w * 0.7, 0.13, 1.9, trim);
  }
  if (spec.kind === 'taxi') {
    batch.box(0, 2.03, -0.45, 0.85, 0.38, 0.46, 0xe8b533);
    for (let side of [-1, 1]) for (let n = -4; n <= 4; n++) batch.box(side * w * 0.505, 0.78, n * 0.42, 0.035, 0.18, 0.2, n % 2 ? 0xeee2c5 : 0x2c383a);
  }
  if (spec.kind === 'police') {
    for (const side of [-1, 1]) {
      batch.box(side * w * 0.505, 0.95, 0.05, 0.045, 0.62, 1.35, 0xefe6d2);
      batch.box(side * w * 0.505, 0.78, 0, 0.035, 0.18, l * 0.88, 0x2fa9a0);
      batch.box(side * w * 0.507, 1.24, -0.4, 0.04, 0.3, 1.05, 0x16303c);
    }
    batch.box(0, 1.34, 0.35, w * 0.72, 0.1, 0.9, 0xefe6d2);
  }
  batch.box(0, 0.58, l * 0.505, w * 0.87, 0.18, 0.1, 0xb0afa1);
  batch.box(0, 0.52, -l * 0.505, w * 0.88, 0.17, 0.1, trim);
  batch.box(-w * 0.59, 1.18, 0.6, 0.26, 0.16, 0.35, colour);
  batch.box(w * 0.59, 1.18, 0.6, 0.26, 0.16, 0.35, colour);
  return batch.finish(`${spec.name} original bodywork`);
}

function buildAxles(spec) {
  if (spec.kind === 'boat') return [];
  const axles = [];
  for (const z of [-spec.length * 0.31, spec.length * 0.31]) {
    const batch = new GeometryBatch();
    const wheel = new THREE.CylinderGeometry(0.39, 0.39, 0.28, 10);
    batch.primitive(wheel, -spec.width * 0.51, 0.43, 0, 0x25292a, [1, 1, 1], [0, 0, Math.PI / 2]);
    batch.primitive(wheel, spec.width * 0.51, 0.43, 0, 0x25292a, [1, 1, 1], [0, 0, Math.PI / 2]);
    const hub = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8);
    batch.primitive(hub, -spec.width * 0.515, 0.43, 0, 0x84908a, [1, 1, 1], [0, 0, Math.PI / 2]);
    batch.primitive(hub, spec.width * 0.515, 0.43, 0, 0x84908a, [1, 1, 1], [0, 0, Math.PI / 2]);
    const mesh = batch.finish('Paired rotating wheels');
    mesh.position.z = z;
    axles.push(mesh);
  }
  return axles;
}

export class VehicleSystem {
  constructor(renderer, city, seed = 1) {
    this.renderer = renderer;
    this.city = city;
    this.vehicles = [];
    this.random = createTrafficRandom(seed);
    this.nextId = 1;
    this.playerVehicle = null;
    this.lastImpact = 0;
  }

  spawnVehicle(type, x, z, heading = 0, options = {}) {
    const spec = VEHICLES[type] || VEHICLES.brisa;
    const colour = options.colour ?? choose(this.random, spec.colours);
    const group = new THREE.Group();
    group.name = spec.name;
    const body = buildVehicleBody(type, spec, colour);
    group.add(body);
    const wheels = buildAxles(spec);
    wheels.forEach((wheel) => group.add(wheel));
    const front = new GeometryBatch();
    const rear = new GeometryBatch();
    if (type === 'boat') {
      front.box(0, 1.15, spec.length * 0.48, 0.32, 0.2, 0.15, 0xffe5a5);
    } else {
      for (const side of [-1, 1]) {
        front.box(side * spec.width * 0.34, 0.82, spec.length * 0.51, 0.44, 0.24, 0.08, 0xffe9ad);
        rear.box(side * spec.width * 0.35, 0.82, -spec.length * 0.51, 0.42, 0.22, 0.08, 0xef5535);
      }
    }
    const headlights = front.finish('Working headlights', { unlit: true, castShadow: false });
    const brakeLights = rear.finish('Brake lights', { unlit: true, castShadow: false });
    group.add(headlights, brakeLights);
    let lightbar = null;
    if (spec.kind === 'police' || spec.kind === 'suv') {
      lightbar = new THREE.Group();
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.26, 0.4), new THREE.MeshBasicMaterial({ color: 0xff3b26 }));
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.26, 0.4), new THREE.MeshBasicMaterial({ color: 0x3fc4ff }));
      red.position.set(-0.4, spec.kind === 'suv' ? 2.42 : 2.11, -0.25);
      blue.position.copy(red.position).x = 0.4;
      lightbar.add(red, blue);
      lightbar.userData = { red, blue };
      group.add(lightbar);
    }
    const car = {
      id: this.nextId++, type, spec, colour, mesh: group, body, wheels, headlights, brakeLights, lightbar,
      position: group.position, velocity: new THREE.Vector3(), heading, speed: 0,
      steer: 0, damage: 0, occupied: !!options.occupied, parked: !!options.parked,
      traffic: !!options.traffic, police: !!options.police, player: false,
      route: options.route || null, routeIndex: 0, destroyed: false, missionTag: options.missionTag || null,
      blockedTime: 0, honkTimer: 0, impactCooldown: 0, radio: 0, name: spec.name,
    };
    group.position.set(x, type === 'boat' ? -0.15 : this.city.heightAt(x, z), z);
    group.rotation.y = heading;
    this.renderer.scene.add(group);
    this.vehicles.push(car);
    this.updateVehicleVisual(car, 0, false);
    return car;
  }

  spawnParkedVehicles(count = 20) {
    const types = ['vela', 'brisa', 'mulo', 'panera', 'amarillo'];
    for (let i = 0; i < count; i++) {
      const vertical = this.random() > 0.45;
      const road = choose(this.random, WORLD.roadCoords.slice(0, -1));
      const along = -315 + this.random() * 580;
      const x = vertical ? road + (this.random() > 0.5 ? 5.8 : -5.8) : along;
      const z = vertical ? along : road + (this.random() > 0.5 ? 5.8 : -5.8);
      this.spawnVehicle(choose(this.random, types), x, z, vertical ? 0 : Math.PI / 2, { parked: true });
    }
    this.spawnVehicle('vela', -77, 273, Math.PI / 2, { parked: true, colour: 0xb02b28, missionTag: 'hotelVela' });
    this.spawnVehicle('panera', 214, 146, Math.PI, { parked: true, missionTag: 'contrabandVan' });
    this.spawnVehicle('boat', -226, 439, 0, { parked: true, missionTag: 'escapeBoat' });
  }

  createTrafficRoute() {
    const startI = 1 + Math.floor(this.random() * 7);
    const startJ = 1 + Math.floor(this.random() * 6);
    let i = startI, j = startJ, previous = null;
    const route = [];
    for (let step = 0; step < 14; step++) {
      const node = this.city.roadGraph[i][j];
      route.push(node);
      let neighbours = node.neighbours.filter(([ni, nj]) => !previous || ni !== previous[0] || nj !== previous[1]);
      const next = choose(this.random, neighbours.length ? neighbours : node.neighbours);
      previous = [i, j];
      [i, j] = next;
    }
    return route;
  }

  spawnTraffic(count = WORLD.maxTraffic) {
    const types = ['brisa', 'brisa', 'mulo', 'panera', 'amarillo', 'vela'];
    for (let n = 0; n < count; n++) {
      const route = this.createTrafficRoute();
      const node = route[0], next = route[1];
      const heading = Math.atan2(next.x - node.x, next.z - node.z);
      const rightX = Math.cos(heading), rightZ = -Math.sin(heading);
      const car = this.spawnVehicle(choose(this.random, types), node.x + rightX * WORLD.laneOffset, node.z + rightZ * WORLD.laneOffset, heading, { traffic: true, occupied: true, route });
      car.routeIndex = 1;
      car.speed = 7 + this.random() * 5;
    }
  }

  findNearestVehicle(position, maximum = 5, filter = null) {
    let nearest = null, best = maximum;
    for (const car of this.vehicles) {
      if (car.destroyed || (filter && !filter(car))) continue;
      const distance = distance2D(position, car.position);
      if (distance < best) { best = distance; nearest = car; }
    }
    return nearest;
  }

  stealVehicle(car, game) {
    if (!car || car.destroyed) return false;
    if (this.playerVehicle === car) return true;
    if (this.playerVehicle) this.exitVehicle(game);
    if (car.occupied) {
      game.peds.spawnFleeingDriver(car.position, car.heading);
      game.police.raiseWanted(0.75, 'Carjacking');
      game.hud.toast('VEHICLE STOLEN', car.name);
    } else game.hud.toast(car.name.toUpperCase(), 'Engine ready');
    car.occupied = false;
    car.traffic = false;
    car.parked = false;
    car.player = true;
    this.playerVehicle = car;
    game.player.vehicle = car;
    game.player.group.visible = false;
    game.missions?.onVehicleEntered(car, game);
    game.audio.startEngine();
    return true;
  }

  exitVehicle(game) {
    const car = this.playerVehicle;
    if (!car) return;
    car.player = false;
    const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
    game.player.position.copy(car.position).addScaledVector(side, car.spec.width + 0.85);
    game.player.position.y = this.city.heightAt(game.player.position.x, game.player.position.z);
    this.city.resolveCollision(game.player.position, 0.55, car.type === 'boat');
    game.player.group.visible = true;
    game.player.vehicle = null;
    this.playerVehicle = null;
    game.audio.stopEngine();
  }

  damageVehicle(car, amount, game, source = 'impact') {
    if (car.destroyed) return;
    car.damage = clamp(car.damage + amount, 0, 120);
    if (car.damage >= 100) {
      car.destroyed = true;
      car.speed = 0;
      car.mesh.rotation.z = 0.08;
      this.renderer.addExplosion(car.position.clone().add(new THREE.Vector3(0, 1, 0)));
      game.audio.explosion();
      if (car.police) game.police.raiseWanted(2, 'Cruiser destroyed');
      if (this.playerVehicle === car) {
        game.player.takeDamage(65, game);
        this.exitVehicle(game);
      }
    } else if (game.missions && (source === 'ram' || car.missionTag === 'coronelCar')) game.missions.onVehicleRam(car, amount);
  }

  driveVehicle(car, throttle, steering, handbrake, deltaTime) {
    const spec = car.spec;
    const forward = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
    const right = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
    let longitudinal = car.velocity.dot(forward);
    let lateral = car.velocity.dot(right);
    longitudinal += throttle * spec.acceleration * deltaTime;
    longitudinal = clamp(longitudinal, -spec.maxSpeed * 0.38, spec.maxSpeed);
    const drag = throttle === 0 ? 1.6 : 0.35;
    longitudinal *= Math.max(0, 1 - drag * deltaTime);
    const speedSteer = clamp(Math.abs(longitudinal) / 5, 0, 1) * (1 - clamp(Math.abs(longitudinal) / spec.maxSpeed, 0, 1) * 0.5);
    car.heading -= steering * spec.steering * speedSteer * deltaTime * Math.sign(longitudinal || 1);
    const grip = handbrake ? spec.grip * 0.12 : spec.grip;
    lateral += steering * Math.abs(longitudinal) * (handbrake ? 0.9 : 0.12) * deltaTime;
    lateral *= Math.max(0, 1 - grip * deltaTime);
    car.velocity.copy(forward).multiplyScalar(longitudinal).addScaledVector(right, lateral);
    car.speed = longitudinal;
    car.steer = steering;
  }

  updatePlayerVehicle(car, deltaTime, game) {
    const throttle = game.input.axis('KeyW', 'KeyS');
    const steering = game.input.axis('KeyA', 'KeyD');
    const handbrake = game.input.down('Space');
    this.driveVehicle(car, throttle, steering, handbrake, deltaTime);
    const previous = car.position.clone();
    car.position.addScaledVector(car.velocity, deltaTime);
    const allowedWater = car.type === 'boat';
    const preX = car.position.x, preZ = car.position.z;
    this.city.resolveCollision(car.position, Math.max(car.spec.width, 1.25) * 0.62, allowedWater);
    if ((Math.abs(preX - car.position.x) + Math.abs(preZ - car.position.z)) > 0.05) {
      const impact = car.velocity.length();
      car.velocity.multiplyScalar(-0.24);
      car.speed *= -0.24;
      if (impact > 5 && car.impactCooldown <= 0) {
        this.damageVehicle(car, impact * 0.8, game, 'ram');
        this.renderer.addSparks(car.position.clone().add(new THREE.Vector3(0, 0.7, 0)));
        this.renderer.shake = Math.min(0.5, impact * 0.012);
        car.impactCooldown = 0.25;
      }
    }
    // Vehicle-to-vehicle shunts are felt and count for the courier mission.
    for (const other of this.vehicles) {
      if (other === car || other.destroyed) continue;
      const distance = distance2D(car.position, other.position);
      if (distance < 3.25 && Math.abs(car.speed) > 5 && car.impactCooldown <= 0) {
        const force = Math.abs(car.speed);
        this.damageVehicle(other, force * 1.1, game, 'ram');
        this.damageVehicle(car, force * 0.28, game);
        car.speed *= -0.15;
        car.velocity.multiplyScalar(-0.15);
        car.position.copy(previous);
        car.impactCooldown = 0.35;
        game.audio.crash();
      }
    }
    for (const person of game.peds.people) {
      if (person.down || person.role === 'guard' || person.role === 'officer') continue;
      if (distance2D(car.position, person.position) < 2.1 && car.velocity.length() > 5) {
        game.peds.knockDown(person, game, 'traffic');
        game.police.raiseWanted(0.8, 'Reckless driving');
        car.speed *= 0.8;
      }
    }
    if (car.damage > 62 && this.random() < deltaTime * 3) this.renderer.addSparks(car.position.clone().add(new THREE.Vector3(0, 1.5, 0)), car.damage > 85 ? 0xe4572e : 0x656d68, 1);
  }

  updateTrafficVehicle(car, deltaTime, game) {
    if (!car.route || car.player || car.police || car.destroyed) return;
    const targetNode = car.route[car.routeIndex];
    const nextNode = car.route[(car.routeIndex + 1) % car.route.length];
    const desiredHeading = Math.atan2(nextNode.x - targetNode.x || targetNode.x - car.position.x, nextNode.z - targetNode.z || targetNode.z - car.position.z);
    const rightX = Math.cos(desiredHeading), rightZ = -Math.sin(desiredHeading);
    const targetX = targetNode.x + rightX * WORLD.laneOffset;
    const targetZ = targetNode.z + rightZ * WORLD.laneOffset;
    const going = Math.atan2(targetX - car.position.x, targetZ - car.position.z);
    car.heading += angleDelta(car.heading, going) * Math.min(1, deltaTime * 3.1);
    const distance = Math.hypot(targetX - car.position.x, targetZ - car.position.z);
    if (distance < 7) car.routeIndex = (car.routeIndex + 1) % car.route.length;
    let desiredSpeed = Math.abs(angleDelta(car.heading, going)) > 0.4 ? 4 : 12;
    const forwardX = Math.sin(car.heading), forwardZ = Math.cos(car.heading);
    let blocked = false;
    for (const other of this.vehicles) {
      if (other === car || other.destroyed) continue;
      const dx = other.position.x - car.position.x, dz = other.position.z - car.position.z;
      if (dx * forwardX + dz * forwardZ > 0 && Math.hypot(dx, dz) < 7.2) { desiredSpeed = 0; blocked = true; break; }
    }
    const target = game.player.vehicle?.position || game.player.position;
    if (distance2D(car.position, target) < 6.5) { desiredSpeed = 0; blocked = true; }
    car.speed += (desiredSpeed - car.speed) * Math.min(1, deltaTime * 2.4);
    car.position.x += forwardX * car.speed * deltaTime;
    car.position.z += forwardZ * car.speed * deltaTime;
    car.blockedTime = blocked ? car.blockedTime + deltaTime : 0;
    car.honkTimer -= deltaTime;
    if (car.blockedTime > 2.5 && car.honkTimer <= 0) { game.audio.honk(); car.honkTimer = 4; }
    if (distance2D(car.position, target) > 510) {
      const route = this.createTrafficRoute();
      car.route = route;
      car.routeIndex = 1;
      car.position.set(route[0].x, 0, route[0].z);
    }
  }

  updateVehicleVisual(car, deltaTime, braking = false) {
    car.mesh.rotation.y = car.heading;
    car.mesh.position.x = car.position.x;
    car.mesh.position.z = car.position.z;
    car.mesh.position.y = car.type === 'boat' ? -0.1 + Math.sin(performance.now() * 0.0018 + car.id) * 0.09 : this.city.heightAt(car.position.x, car.position.z);
    car.body.rotation.z += ((-car.steer * clamp(car.speed / 30, -1, 1) * 0.07) - car.body.rotation.z) * Math.min(1, deltaTime * 5);
    car.body.rotation.x = Math.sin(performance.now() * 0.008 + car.id) * Math.min(0.008, Math.abs(car.speed) * 0.0003);
    for (const wheel of car.wheels) wheel.rotation.x -= car.speed * deltaTime / 0.39;
    car.brakeLights.visible = braking || car.speed < -0.3;
    car.headlights.visible = car.player || car.police || (gameNightValue > 0.4);
    if (car.lightbar) {
      const phase = Math.floor(performance.now() * 0.009 + car.id) % 2;
      car.lightbar.userData.red.visible = phase === 0;
      car.lightbar.userData.blue.visible = phase === 1;
    }
    car.impactCooldown = Math.max(0, car.impactCooldown - deltaTime);
  }

  update(deltaTime, game) {
    for (const car of this.vehicles) {
      if (car.player && game.state === 'playing') {
        const braking = !game.input.down('KeyW') || game.input.down('Space');
        this.updatePlayerVehicle(car, deltaTime, game);
        this.updateVehicleVisual(car, deltaTime, braking);
      } else {
        if (car.traffic && game.state === 'playing') this.updateTrafficVehicle(car, deltaTime, game);
        this.updateVehicleVisual(car, deltaTime, false);
      }
    }
    gameNightValue = game.night || 0;
  }
}

let gameNightValue = 0;
function createTrafficRandom(seed) {
  let state = (seed ^ 0x91e10da5) >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}
