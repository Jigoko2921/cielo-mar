// Five-star wanted director: pursuit, line-of-sight searches, roadblocks and air support.
import { clamp, distance2D, angleDelta, LOCATIONS, PALETTE } from './config.js';

export class PoliceSystem {
  constructor(renderer, city, vehicles) {
    this.renderer = renderer;
    this.city = city;
    this.vehicles = vehicles;
    this.wanted = 0;
    this.displayWanted = 0;
    this.rising = false;
    this.units = [];
    this.officers = [];
    this.lastKnown = new THREE.Vector3();
    this.searchRadius = 0;
    this.timeWithoutSight = 0;
    this.searching = false;
    this.helicopter = null;
    this.roadblock = null;
    this.spikes = null;
    this.crimeCooldown = 0;
    this.heliRotor = null;
  }

  raiseWanted(amount, reason = 'Crime') {
    const previous = Math.ceil(this.wanted - 0.01);
    this.wanted = clamp(this.wanted + amount, 0, 5);
    this.displayWanted = Math.ceil(this.wanted - 0.01);
    this.rising = true;
    this.timeWithoutSight = 0;
    this.searching = true;
    if (this.displayWanted > previous && this.game) {
      this.game.hud.toast(`WANTED LEVEL ${this.displayWanted}`, reason);
      this.game.audio.wanted();
    }
  }

  clearWanted(reason = 'You lost the police') {
    this.wanted = 0;
    this.displayWanted = 0;
    this.searching = false;
    this.rising = false;
    this.timeWithoutSight = 0;
    for (const car of this.units) car.retiring = true;
    if (this.helicopter) this.helicopter.visible = false;
    if (this.game) {
      this.game.hud.toast('IN THE CLEAR', reason);
      this.game.missions?.onPoliceEvaded();
    }
  }

  payAndSpray(game) {
    const fee = 180 + this.displayWanted * 120;
    if (!this.wanted) { game.hud.toast('GARAGE', 'No heat. Paint is clean.'); return; }
    if (game.cash < fee) { game.hud.toast('GARAGE', `Need $${fee}`); return; }
    game.cash -= fee;
    this.clearWanted('Fresh paint. Clean plates.');
  }

  spawnPoliceUnit(type, position, heading = 0) {
    const car = this.vehicles.spawnVehicle(type, position.x, position.z, heading, { police: true, occupied: true });
    car.speed = 10;
    this.units.push(car);
    return car;
  }

  spawnResponse(game) {
    const level = this.displayWanted;
    const target = game.player.vehicle?.position || game.player.position;
    const desired = [0, 1, 2, 4, 6, 8][level];
    while (this.units.filter((car) => !car.destroyed && !car.retiring).length < desired) {
      const index = this.units.length;
      const angle = index * 2.4 + 0.5;
      const distance = 42 + index * 7;
      const x = clamp(target.x + Math.sin(angle) * distance, -405, 405);
      const z = clamp(target.z + Math.cos(angle) * distance, -420, 325);
      const type = level >= 4 && index % 3 === 2 ? 'suv' : 'police';
      this.spawnPoliceUnit(type, { x, z }, angle + Math.PI);
    }
    if (level >= 2 && this.officers.filter((person) => !person.down).length < Math.min(3, level)) {
      const person = game.peds.spawnGuard(target.x + 12 + this.officers.length * 3, target.z + 10, { role: 'officer' });
      this.officers.push(person);
    }
    if (level >= 3 && !this.roadblock) this.spawnRoadblock(game);
    if (level >= 4 && !this.helicopter) this.spawnHelicopter();
    if (level >= 5 && !this.spikes) this.spawnSpikeStrip(game);
  }

  spawnRoadblock(game) {
    const target = game.player.vehicle?.position || game.player.position;
    const group = new THREE.Group();
    group.name = 'PCM striped roadblock';
    for (let x = -5; x <= 5; x += 2.5) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 0.65), new THREE.MeshStandardMaterial({ color: x % 5 ? 0xe0d4b8 : 0xd2603d, roughness: 0.9 }));
      barrier.position.set(x, 0.5, 0);
      barrier.rotation.z = -0.15;
      group.add(barrier);
    }
    group.position.set(target.x + 22, 0, clamp(target.z + 32, -400, 320));
    this.renderer.scene.add(group);
    this.roadblock = group;
  }

  spawnSpikeStrip(game) {
    const target = game.player.vehicle?.position || game.player.position;
    const group = new THREE.Group();
    const strip = new THREE.Mesh(new THREE.BoxGeometry(12, 0.14, 0.6), new THREE.MeshStandardMaterial({ color: 0x292f30 }));
    strip.position.y = 0.16;
    group.add(strip);
    for (let x = -5.5; x < 6; x += 0.8) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0x8c938b, metalness: 0.5 }));
      spike.position.set(x, 0.36, 0);
      group.add(spike);
    }
    group.position.set(target.x - 10, 0, clamp(target.z + 35, -400, 320));
    this.renderer.scene.add(group);
    this.spikes = group;
  }

  spawnHelicopter() {
    const group = new THREE.Group();
    group.name = 'PCM Gaviota helicopter';
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 6), new THREE.MeshStandardMaterial({ color: 0x294b52, roughness: 0.65, flatShading: true }));
    body.scale.set(1, 0.85, 1.65);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 5), new THREE.MeshStandardMaterial({ color: 0x48747b, roughness: 0.3 }));
    cockpit.position.set(0, 0.3, 1.4);
    cockpit.scale.set(0.95, 0.65, 0.9);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0x294b52 }));
    tail.position.z = -3.6;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.3, 1.6), new THREE.MeshStandardMaterial({ color: 0x3a6467 }));
    fin.position.set(0, 1, -6.3);
    const rotor = new THREE.Group();
    for (const rotation of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(13, 0.07, 0.28), new THREE.MeshStandardMaterial({ color: 0x263033 }));
      blade.rotation.y = rotation;
      rotor.add(blade);
    }
    rotor.position.y = 1.8;
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.25), new THREE.MeshBasicMaterial({ color: 0x242d2e }));
    tailRotor.position.set(0.35, 0.6, -6.1);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    cone.position.y = -15.5;
    cone.rotation.x = Math.PI;
    const searchlight = new THREE.SpotLight(0xffdd9c, 80, 90, 0.25, 0.45, 1.5);
    searchlight.position.y = -1;
    searchlight.target.position.set(0, -40, 0);
    group.add(body, cockpit, tail, fin, rotor, tailRotor, cone, searchlight, searchlight.target);
    group.position.set(0, 43, 0);
    group.userData.cone = cone;
    this.renderer.scene.add(group);
    this.helicopter = group;
    this.heliRotor = rotor;
  }

  updateHelicopter(deltaTime, game, target) {
    if (!this.helicopter) return;
    this.helicopter.visible = this.displayWanted >= 4;
    if (!this.helicopter.visible) return;
    const desired = target.clone().add(new THREE.Vector3(-17, 41, -21));
    this.helicopter.position.lerp(desired, Math.min(1, deltaTime * 0.65));
    this.helicopter.rotation.y = Math.atan2(target.x - this.helicopter.position.x, target.z - this.helicopter.position.z);
    this.heliRotor.rotation.y += deltaTime * 28;
    this.helicopter.rotation.z = Math.sin(game.elapsed * 0.8) * 0.035;
    if (this.game && Math.floor(game.elapsed * 2) % 7 === 0) this.game.audio.siren(0.04);
  }

  updatePursuitCar(car, deltaTime, game) {
    if (car.destroyed || car.player) return;
    if (car.retiring && this.wanted === 0) {
      car.police = false;
      car.traffic = true;
      car.route = this.vehicles.createTrafficRoute();
      car.retiring = false;
      return;
    }
    const target = game.player.vehicle?.position || game.player.position;
    const aim = this.searching ? this.lastKnown : target;
    const dx = aim.x - car.position.x, dz = aim.z - car.position.z;
    const desiredHeading = Math.atan2(dx, dz);
    const steering = clamp(angleDelta(car.heading, desiredHeading) * 1.6, -1, 1);
    const aggression = this.displayWanted >= 5 ? 1.18 : 1;
    this.vehicles.driveVehicle(car, aggression, steering, false, deltaTime);
    if (Math.abs(angleDelta(car.heading, desiredHeading)) > 1.6 && car.speed > 5) car.speed *= 0.85;
    car.position.addScaledVector(car.velocity, deltaTime);
    this.city.resolveCollision(car.position, 1.15);
    car.heading += Math.sin(game.elapsed * 1.3 + car.id) * 0.0008;
    if (distance2D(car.position, target) < 4 && game.player.vehicle) {
      this.vehicles.damageVehicle(game.player.vehicle, deltaTime * (this.displayWanted >= 4 ? 6 : 2), game);
    }
    if (distance2D(car.position, this.spikes?.position || new THREE.Vector3(9999, 0, 9999)) < 5 && game.player.vehicle) car.speed *= 0.92;
  }

  update(deltaTime, game) {
    this.game = game;
    this.crimeCooldown -= deltaTime;
    this.displayWanted = Math.ceil(this.wanted - 0.01);
    this.rising = this.timeWithoutSight < 0.7 && this.wanted > 0;
    const target = game.player.vehicle?.position || game.player.position;
    this.spawnResponse(game);
    let visible = false;
    for (const car of this.units) {
      if (distance2D(car.position, target) < 95 && this.city.hasLineOfSight(car.position.clone().add(new THREE.Vector3(0, 1.5, 0)), target.clone().add(new THREE.Vector3(0, 1, 0)))) visible = true;
    }
    if (this.displayWanted >= 4 && this.helicopter?.visible) visible = true;
    if (visible) {
      this.lastKnown.copy(target);
      this.timeWithoutSight = 0;
      this.searching = true;
    } else this.timeWithoutSight += deltaTime;
    this.searchRadius = 65 + this.displayWanted * 24;
    if (this.wanted > 0 && this.timeWithoutSight > 11 + this.displayWanted * 3 && distance2D(target, this.lastKnown) > this.searchRadius * 0.8) this.clearWanted();
    for (const car of this.units) this.updatePursuitCar(car, deltaTime, game);
    if (this.displayWanted > 0 && Math.floor(game.elapsed * 2.4) % 4 === 0) game.audio.siren(0.09);
    this.updateHelicopter(deltaTime, game, this.lastKnown.lengthSq() ? this.lastKnown : target);
    if (this.spikes && game.player.vehicle && distance2D(game.player.vehicle.position, this.spikes.position) < 6) {
      game.player.vehicle.velocity.multiplyScalar(1 - deltaTime * 2.6);
      if (Math.floor(game.elapsed * 4) % 3 === 0) this.vehicles.damageVehicle(game.player.vehicle, deltaTime * 2, game);
    }
  }
}
