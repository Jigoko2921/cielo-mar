// Rafa Quintero: on-foot movement, camera-relative controls and four-weapon hitscan combat.
import { PLAYER_CONFIG, WEAPONS, PALETTE, clamp, createRandom, distance2D } from './config.js';
import { GeometryBatch } from './render.js';

function buildRafa() {
  const group = new THREE.Group();
  group.name = 'Rafa Quintero';
  const batch = new GeometryBatch();
  const skin = 0xb97b54, shirt = 0x466f69, pants = 0x2d3c43;
  batch.box(0, 1.18, 0, 0.78, 0.8, 0.4, shirt);
  batch.box(0, 1.45, 0.02, 0.36, 0.22, 0.37, skin);
  batch.primitive(new THREE.SphereGeometry(0.245, 10, 7), 0, 1.77, 0, skin, [0.9, 1.1, 0.92]);
  batch.box(0, 1.97, -0.035, 0.4, 0.16, 0.34, 0x2c2927);
  batch.box(0, 1.81, -0.18, 0.38, 0.3, 0.12, 0x2c2927);
  batch.box(-0.22, 0.47, 0, 0.28, 0.88, 0.31, pants);
  batch.box(0.22, 0.47, 0, 0.28, 0.88, 0.31, pants);
  batch.box(-0.22, 0.08, 0.1, 0.32, 0.17, 0.51, 0x342d28);
  batch.box(0.22, 0.08, 0.1, 0.32, 0.17, 0.51, 0x342d28);
  batch.box(-0.48, 1.18, 0, 0.23, 0.55, 0.25, shirt, 0, -0.12);
  batch.box(0.48, 1.18, 0, 0.23, 0.55, 0.25, shirt, 0, 0.35);
  batch.box(-0.52, 0.85, 0.02, 0.2, 0.33, 0.21, skin);
  batch.box(0.64, 1.03, 0.13, 0.2, 0.36, 0.21, skin);
  batch.box(0.67, 0.91, 0.15, 0.23, 0.1, 0.24, 0x3d4d4e);
  batch.box(0, 0.85, 0, 0.76, 0.12, 0.42, 0x584534);
  const body = batch.finish('Rafa rolled sleeves, watch and boots');
  group.add(body);
  const weapons = [];
  for (let index = 1; index < 4; index++) {
    const gun = new GeometryBatch();
    const length = index === 1 ? 0.52 : index === 2 ? 0.92 : 1.2;
    gun.box(0.58, 1.13, 0.42 + length * 0.35, 0.13, 0.2, length, index === 3 ? 0x4b3d31 : 0x293236);
    gun.box(0.58, 0.98, 0.35, 0.12, 0.28, 0.16, 0x493c30, 0, 0, -0.25);
    if (index === 2) gun.box(0.58, 0.99, 0.6, 0.12, 0.35, 0.18, 0x252b2c);
    if (index === 3) gun.box(0.58, 1.07, 0.87, 0.16, 0.1, 0.55, 0x8b6d42);
    const mesh = gun.finish(WEAPONS[index].name);
    mesh.visible = false;
    group.add(mesh);
    weapons[index] = mesh;
  }
  return { group, body, weapons };
}

export class PlayerController {
  constructor(renderer, city) {
    this.renderer = renderer;
    this.city = city;
    const rafa = buildRafa();
    this.group = rafa.group;
    this.body = rafa.body;
    this.weaponMeshes = rafa.weapons;
    this.position = this.group.position;
    this.position.set(-136, city.heightAt(-136, 88), 88);
    this.heading = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.health = PLAYER_CONFIG.health;
    this.armour = 0;
    this.stamina = 100;
    this.currentWeapon = 0;
    this.ammo = [Infinity, 12, 30, 8];
    this.reserves = [Infinity, 84, 150, 48];
    this.extendedMags = false;
    this.improvedSpread = false;
    this.cooldown = 0;
    this.reloadRemaining = 0;
    this.aiming = false;
    this.triggerHeld = false;
    this.lastCombat = 20;
    this.vehicle = null;
    this.crouching = false;
    this.random = createRandom(29191);
    this.fireCount = 0;
    this.footstepTimer = 0;
    renderer.scene.add(this.group);
  }

  teleport(x, z, heading = 0) {
    if (this.vehicle) this.vehicle = null;
    this.position.set(x, this.city.heightAt(x, z), z);
    this.heading = heading;
    this.group.rotation.y = heading;
    this.velocityY = 0;
    this.group.visible = true;
  }

  get weapon() { return WEAPONS[this.currentWeapon]; }
  get magazineSize() {
    const base = this.weapon.magazine;
    return Number.isFinite(base) && this.extendedMags ? Math.ceil(base * 1.5) : base;
  }

  selectWeapon(index, game) {
    if (index < 0 || index > 3 || this.currentWeapon === index) return;
    this.currentWeapon = index;
    this.reloadRemaining = 0;
    for (let i = 1; i < 4; i++) this.weaponMeshes[i].visible = i === index;
    game.audio.uiClick();
    game.hud.toast(WEAPONS[index].name.toUpperCase(), index === 0 ? 'Close combat' : `${this.ammo[index]} rounds loaded`);
  }

  beginReload(game) {
    const index = this.currentWeapon;
    if (index === 0 || this.reloadRemaining > 0 || this.ammo[index] >= this.magazineSize || this.reserves[index] <= 0) return;
    this.reloadRemaining = this.weapon.reload;
    game.audio.reload();
    game.hud.toast('RELOADING', this.weapon.name);
  }

  finishReload() {
    const needed = this.magazineSize - this.ammo[this.currentWeapon];
    const loaded = Math.min(needed, this.reserves[this.currentWeapon]);
    this.ammo[this.currentWeapon] += loaded;
    this.reserves[this.currentWeapon] -= loaded;
  }

  updateOnFoot(deltaTime, game) {
    const input = game.input;
    this.crouching = input.down('KeyC');
    const forwardInput = input.axis('KeyW', 'KeyS');
    const sideInput = input.axis('KeyD', 'KeyA');
    const moving = forwardInput !== 0 || sideInput !== 0;
    const sprinting = input.down('ShiftLeft') && forwardInput > 0 && this.stamina > 0 && !this.aiming && !this.crouching;
    const speed = this.crouching ? PLAYER_CONFIG.crouchSpeed : sprinting ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;
    if (sprinting) this.stamina = Math.max(0, this.stamina - deltaTime * PLAYER_CONFIG.staminaDrain);
    else this.stamina = Math.min(100, this.stamina + deltaTime * PLAYER_CONFIG.staminaRecovery);
    if (moving) {
      const length = Math.hypot(forwardInput, sideInput);
      const forward = new THREE.Vector3(Math.sin(game.cameraYaw), 0, Math.cos(game.cameraYaw));
      const right = new THREE.Vector3(Math.cos(game.cameraYaw), 0, -Math.sin(game.cameraYaw));
      const motion = forward.multiplyScalar(forwardInput / length).addScaledVector(right, sideInput / length);
      this.position.addScaledVector(motion, speed * deltaTime);
      const desiredHeading = this.aiming ? game.cameraYaw : Math.atan2(motion.x, motion.z);
      this.heading += Math.atan2(Math.sin(desiredHeading - this.heading), Math.cos(desiredHeading - this.heading)) * Math.min(1, deltaTime * 13);
      this.footstepTimer -= deltaTime;
      if (this.footstepTimer <= 0 && this.grounded) {
        game.audio.footstep(sprinting);
        this.footstepTimer = sprinting ? 0.27 : 0.43;
      }
    } else if (this.aiming) this.heading = game.cameraYaw;
    this.city.resolveCollision(this.position, PLAYER_CONFIG.radius);
    const ground = this.city.heightAt(this.position.x, this.position.z);
    if (input.consume('Space') && this.grounded && !this.crouching) {
      this.velocityY = PLAYER_CONFIG.jumpSpeed;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.velocityY -= 24 * deltaTime;
      this.position.y += this.velocityY * deltaTime;
      if (this.position.y <= ground) {
        this.position.y = ground;
        this.velocityY = 0;
        this.grounded = true;
      }
    } else this.position.y += (ground - this.position.y) * Math.min(1, deltaTime * 16);
    this.group.rotation.y = this.heading;
    const scaleY = this.crouching ? 0.72 : 1;
    this.body.scale.y += (scaleY - this.body.scale.y) * Math.min(1, deltaTime * 12);
    this.body.rotation.x = moving ? Math.sin(game.elapsed * (sprinting ? 14 : 9)) * 0.025 : 0;
    this.aiming = input.aiming && this.currentWeapon > 0;
    this.updateCombat(deltaTime, game);
  }

  updateCombat(deltaTime, game) {
    this.cooldown = Math.max(0, this.cooldown - deltaTime);
    this.lastCombat += deltaTime;
    if (this.reloadRemaining > 0) {
      this.reloadRemaining -= deltaTime;
      if (this.reloadRemaining <= 0) this.finishReload();
    }
    if (this.lastCombat > 8 && this.health > 0) {
      const ceiling = this.health < 33 ? 33 : this.health < 66 ? 66 : 100;
      this.health = Math.min(ceiling, this.health + deltaTime * 3.5);
    }
    if (this.vehicle) { this.triggerHeld = game.input.firing; return; }
    const firing = game.input.firing;
    if (firing && (!this.triggerHeld || this.weapon.auto) && this.cooldown <= 0 && this.reloadRemaining <= 0) this.fireWeapon(game);
    this.triggerHeld = firing;
  }

  findHitscanTarget(origin, direction, range, tolerance, game) {
    let best = null, nearest = range;
    for (const person of game.peds.people) {
      if (person.down) continue;
      const centre = person.position.clone().add(new THREE.Vector3(0, person.role === 'civilian' ? 1.05 : 1.2, 0));
      const offset = centre.clone().sub(origin);
      const along = offset.dot(direction);
      if (along < 0 || along > nearest) continue;
      const perpendicular = offset.clone().addScaledVector(direction, -along).length();
      if (perpendicular < tolerance && this.city.hasLineOfSight(origin, centre)) { nearest = along; best = { kind: 'person', target: person, point: centre }; }
    }
    for (const car of game.vehicles.vehicles) {
      if (car.destroyed) continue;
      const centre = car.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      const offset = centre.clone().sub(origin);
      const along = offset.dot(direction);
      if (along < 0 || along > nearest) continue;
      const perpendicular = offset.clone().addScaledVector(direction, -along).length();
      if (perpendicular < 1.35 && this.city.hasLineOfSight(origin, centre)) { nearest = along; best = { kind: 'vehicle', target: car, point: centre }; }
    }
    return { hit: best, distance: nearest };
  }

  fireWeapon(game, forcedDirection = null) {
    const index = this.currentWeapon;
    const weapon = this.weapon;
    if (index > 0 && this.ammo[index] <= 0) {
      this.beginReload(game);
      this.cooldown = 0.25;
      return;
    }
    const forward = forcedDirection?.clone().normalize() || new THREE.Vector3(Math.sin(game.cameraYaw) * Math.cos(game.cameraPitch), Math.sin(game.cameraPitch), Math.cos(game.cameraYaw) * Math.cos(game.cameraPitch));
    const right = new THREE.Vector3(Math.cos(game.cameraYaw), 0, -Math.sin(game.cameraYaw));
    const origin = this.position.clone().add(new THREE.Vector3(0, this.crouching ? 1 : 1.35, 0)).addScaledVector(right, 0.48).addScaledVector(forward, 0.65);
    this.cooldown = weapon.rate;
    this.fireCount++;
    if (index > 0) {
      this.ammo[index]--;
      this.lastCombat = 0;
      game.audio.gunshot(weapon.id);
      this.renderer.addMuzzleFlash(origin, index === 3 ? 1.8 : 1.15);
      this.renderer.addSparks(origin.clone().addScaledVector(right, -0.35), 0xd7b25e, 1); // brass casing
      this.renderer.shake = Math.max(this.renderer.shake, index === 3 ? 0.2 : 0.07);
      game.police.raiseWanted(0.18, 'Gunfire');
      game.peds.panicAround(this.position, 33);
    }
    const pellets = weapon.pellets || 1;
    const hits = new Map();
    let finalEnd = origin.clone().addScaledVector(forward, weapon.range);
    for (let pellet = 0; pellet < pellets; pellet++) {
      const spread = weapon.spread * (this.aiming ? 0.45 : 1) * (this.improvedSpread ? 0.7 : 1);
      const direction = forward.clone();
      direction.x += (this.random() - 0.5) * spread;
      direction.y += (this.random() - 0.5) * spread;
      direction.z += (this.random() - 0.5) * spread;
      direction.normalize();
      const result = this.findHitscanTarget(origin, direction, weapon.range, index === 0 ? 1.35 : 0.82, game);
      finalEnd = result.hit ? result.hit.point : origin.clone().addScaledVector(direction, result.distance);
      if (result.hit) {
        const entry = result.hit;
        const key = entry.target.id;
        hits.set(key, { entry, damage: (hits.get(key)?.damage || 0) + weapon.damage });
      }
    }
    for (const { entry, damage } of hits.values()) {
      if (entry.kind === 'person') game.peds.damagePerson(entry.target, damage, game);
      else game.vehicles.damageVehicle(entry.target, damage * 0.35, game, 'gunfire');
      this.renderer.addSparks(entry.point, entry.kind === 'person' ? 0xe79a68 : 0xffb347, 4);
    }
    if (index > 0) this.renderer.addTracer(origin, finalEnd, 0xffd080, 0.13);
    game.missions?.onGunshot();
    return { origin, end: finalEnd, hits: hits.size };
  }

  takeDamage(amount, game) {
    if (this.health <= 0 || game.state === 'shot') return;
    const absorbed = Math.min(this.armour, amount * 0.62);
    this.armour -= absorbed;
    this.health = Math.max(0, this.health - (amount - absorbed));
    this.lastCombat = 0;
    this.renderer.shake = Math.max(this.renderer.shake, 0.18);
    game.audio.hurt();
    if (this.health <= 0) game.handlePlayerDeath();
  }

  addCashPickup(game, cash, armour = 0, ammo = false) {
    game.cash += cash;
    this.armour = Math.min(100, this.armour + armour);
    if (ammo) {
      this.reserves[1] += 24;
      this.reserves[2] += 60;
      this.reserves[3] += 16;
    }
  }
}
