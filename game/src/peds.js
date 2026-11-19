// Sidewalk crowds, reactions, fleeing drivers and armed mission guards.
import { WORLD, createRandom, choose, clamp, distance2D, angleDelta } from './config.js';
import { GeometryBatch } from './render.js';

const wardrobe = [0xd07c4e, 0x347e7c, 0xe0bd72, 0xebe0c7, 0x697a4c, 0xa9594d, 0x557084, 0xbe956b];
const trousers = [0x30393d, 0x514a3f, 0x273c4a, 0x6d6151];

function personMesh(shirt, pants, role = 'civilian', skin = 0xb77c56) {
  const batch = new GeometryBatch();
  batch.box(0, 1.16, 0, 0.66, 0.78, 0.34, shirt);
  batch.box(0, 1.47, 0, 0.44, 0.2, 0.37, skin);
  batch.primitive(new THREE.SphereGeometry(0.23, 8, 6), 0, 1.78, 0, skin, [0.9, 1.1, 0.9]);
  batch.box(0, 1.96, -0.02, 0.37, 0.13, 0.34, 0x322d29);
  batch.box(-0.43, 1.16, 0, 0.19, 0.73, 0.22, shirt, 0, role === 'guard' ? -0.22 : 0.03);
  batch.box(0.43, 1.16, 0, 0.19, 0.73, 0.22, shirt, 0, role === 'guard' ? 0.65 : -0.03);
  batch.box(-0.18, 0.48, 0, 0.25, 0.83, 0.28, pants);
  batch.box(0.18, 0.48, 0, 0.25, 0.83, 0.28, pants);
  batch.box(-0.18, 0.08, 0.09, 0.28, 0.15, 0.48, 0x272b2b);
  batch.box(0.18, 0.08, 0.09, 0.28, 0.15, 0.48, 0x272b2b);
  if (role === 'guard' || role === 'officer') {
    batch.box(0, 1.2, 0.19, 0.55, 0.58, 0.08, role === 'officer' ? 0x284b55 : 0x393f3c);
    batch.box(0.43, 1.15, 0.34, 0.13, 0.14, 0.65, 0x252c2e);
    batch.box(0, 1.97, 0.02, 0.48, 0.1, 0.46, role === 'officer' ? 0x25434d : 0x504639);
  }
  if (role === 'coronel') {
    batch.box(0, 1.17, 0.19, 0.58, 0.7, 0.08, 0xddd1b2);
    batch.box(0, 1.97, 0.02, 0.54, 0.13, 0.5, 0x5c664e);
    batch.box(0.1, 1.41, 0.24, 0.09, 0.17, 0.05, 0xd1a54c);
  }
  const mesh = batch.finish(`${role} procedural character`);
  mesh.castShadow = true;
  return mesh;
}

export class PedestrianSystem {
  constructor(renderer, city, seed = 1) {
    this.renderer = renderer;
    this.city = city;
    this.random = createRandom(seed ^ 0xabc141);
    this.people = [];
    this.nextId = 1;
  }

  spawnPedestrian(x, z, options = {}) {
    const role = options.role || 'civilian';
    const shirt = role === 'officer' ? 0x315665 : role === 'guard' ? 0x655b48 : role === 'coronel' ? 0x59634e : choose(this.random, wardrobe);
    const mesh = personMesh(shirt, choose(this.random, trousers), role, choose(this.random, [0x9a6446, 0xb9805c, 0xd19a72, 0x805239]));
    const person = {
      id: this.nextId++, role, mesh, position: mesh.position, heading: this.random() * Math.PI * 2,
      speed: 1.1 + this.random() * 0.75, health: role === 'coronel' ? 180 : role === 'guard' ? 72 : role === 'officer' ? 90 : 45,
      down: false, alive: true, state: options.state || 'walk', fleeTime: 0, waitTime: this.random() * 5,
      shotTimer: this.random() * 1.8, walkTime: this.random() * 6, missionTag: options.missionTag || null,
      home: new THREE.Vector3(x, 0, z), target: null,
    };
    mesh.position.set(x, this.city.heightAt(x, z), z);
    mesh.rotation.y = person.heading;
    this.renderer.scene.add(mesh);
    this.people.push(person);
    return person;
  }

  spawnStreetCrowd(count = WORLD.maxPedestrians) {
    for (let i = 0; i < count; i++) {
      const point = this.city.randomSidewalkPoint(this.random);
      this.spawnPedestrian(point.x, point.z, { state: this.random() > 0.87 ? 'idle' : 'walk' });
    }
    // Promenade extras are deliberately visible in the cover shot.
    for (const [x, z] of [[-52, 282], [-39, 289], [-12, 280], [18, 293], [42, 278]]) this.spawnPedestrian(x, z);
  }

  spawnGuard(x, z, options = {}) {
    return this.spawnPedestrian(x, z, { ...options, role: options.role || 'guard', state: 'combat' });
  }

  spawnFleeingDriver(position, heading) {
    const side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    const point = position.clone().addScaledVector(side, 2);
    const person = this.spawnPedestrian(point.x, point.z, { state: 'flee' });
    person.fleeTime = 12;
    person.heading = heading + Math.PI / 2;
    return person;
  }

  panicAround(position, radius = 28) {
    for (const person of this.people) {
      if (person.role !== 'civilian' || person.down) continue;
      if (distance2D(person.position, position) < radius) {
        person.state = 'flee';
        person.fleeTime = 6 + this.random() * 6;
        person.heading = Math.atan2(person.position.x - position.x, person.position.z - position.z);
      }
    }
  }

  knockDown(person, game, cause = 'combat') {
    if (person.down) return;
    person.down = true;
    person.alive = false;
    person.health = 0;
    person.mesh.rotation.z = Math.PI / 2;
    person.mesh.position.y = this.city.heightAt(person.position.x, person.position.z) + 0.42;
    if (person.role === 'civilian' && cause !== 'traffic') game.police.raiseWanted(1, 'Assault');
    if (person.role === 'officer') game.police.raiseWanted(1.25, 'Officer down');
    game.missions?.onEnemyDown(person, game);
  }

  damagePerson(person, damage, game) {
    if (!person || person.down) return false;
    person.health -= damage;
    person.state = person.role === 'civilian' ? 'flee' : 'combat';
    person.fleeTime = 8;
    if (person.health <= 0) this.knockDown(person, game);
    return true;
  }

  updateGuard(person, deltaTime, game) {
    const target = game.player.vehicle?.position || game.player.position;
    const distance = distance2D(person.position, target);
    const origin = person.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const aim = target.clone().add(new THREE.Vector3(0, 1.1, 0));
    const sees = distance < 52 && this.city.hasLineOfSight(origin, aim);
    person.shotTimer -= deltaTime;
    if (sees) {
      person.heading = Math.atan2(target.x - person.position.x, target.z - person.position.z);
      if (distance > 15 && distance < 46) {
        person.position.x += Math.sin(person.heading) * 1.35 * deltaTime;
        person.position.z += Math.cos(person.heading) * 1.35 * deltaTime;
      }
      if (person.shotTimer <= 0) {
        const end = aim.clone();
        end.x += (this.random() - 0.5) * 1.9;
        end.y += (this.random() - 0.5) * 0.8;
        end.z += (this.random() - 0.5) * 1.9;
        this.renderer.addTracer(origin, end, 0xff9354, 0.13);
        this.renderer.addMuzzleFlash(origin, 0.8);
        game.audio.gunshot('pistola', 0.28);
        if (end.distanceTo(aim) < 1.1 && !game.player.vehicle) game.player.takeDamage(person.role === 'officer' ? 9 : 12, game);
        person.shotTimer = person.role === 'coronel' ? 0.55 : 0.9 + this.random() * 1.3;
      }
    } else if (distance < 80) {
      const going = Math.atan2(target.x - person.position.x, target.z - person.position.z);
      person.heading += angleDelta(person.heading, going) * deltaTime * 2;
      person.position.x += Math.sin(person.heading) * 1.6 * deltaTime;
      person.position.z += Math.cos(person.heading) * 1.6 * deltaTime;
    }
  }

  updateCivilian(person, deltaTime, game) {
    person.fleeTime -= deltaTime;
    person.walkTime -= deltaTime;
    person.waitTime -= deltaTime;
    if (person.fleeTime <= 0 && person.state === 'flee') person.state = 'walk';
    if (person.state === 'idle') {
      if (person.waitTime <= 0) person.state = 'walk';
      return;
    }
    if (person.walkTime <= 0) {
      person.walkTime = 4 + this.random() * 8;
      if (this.random() > 0.58) person.heading += Math.PI / 2 * (this.random() > 0.5 ? 1 : -1); // corner crossing
      else person.heading += Math.PI;
    }
    const speed = person.state === 'flee' ? 5.1 : person.speed;
    person.position.x += Math.sin(person.heading) * speed * deltaTime;
    person.position.z += Math.cos(person.heading) * speed * deltaTime;
    if (Math.abs(person.position.x) > 410 || person.position.z < -440 || person.position.z > 335) {
      const point = this.city.randomSidewalkPoint(this.random);
      person.position.set(point.x, this.city.heightAt(point.x, point.z), point.z);
    }
    if (this.random() < deltaTime * 0.18) this.city.resolveCollision(person.position, 0.3);
    const playerPosition = game.player.vehicle?.position || game.player.position;
    const threatened = game.player.aiming && distance2D(person.position, playerPosition) < 16;
    if (threatened && person.state !== 'flee') {
      person.state = 'flee';
      person.fleeTime = 5;
      person.heading = Math.atan2(person.position.x - playerPosition.x, person.position.z - playerPosition.z);
    }
    if (game.player.vehicle && game.player.vehicle.velocity.length() > 13 && distance2D(person.position, playerPosition) < 12) {
      person.state = 'flee';
      person.fleeTime = 4;
      person.heading = Math.atan2(person.position.x - playerPosition.x, person.position.z - playerPosition.z);
    }
  }

  update(deltaTime, game) {
    for (const person of this.people) {
      if (person.down) continue;
      if (person.role === 'guard' || person.role === 'officer' || person.role === 'coronel') {
        if (person.role === 'officer' && game.police.wanted <= 0) {
          person.state = 'idle';
          person.shotTimer = 2;
        } else this.updateGuard(person, deltaTime, game);
      } else this.updateCivilian(person, deltaTime, game);
      person.mesh.rotation.y = person.heading;
      const moving = person.state === 'walk' || person.state === 'flee' || person.state === 'combat';
      person.mesh.position.y = this.city.heightAt(person.position.x, person.position.z) + (moving ? Math.abs(Math.sin(game.elapsed * 7 + person.id)) * 0.045 : 0);
      person.mesh.rotation.x = person.state === 'flee' ? Math.sin(game.elapsed * 10 + person.id) * 0.035 : 0;
    }
  }
}
