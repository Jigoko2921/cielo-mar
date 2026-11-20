// Rafa Quintero on foot: WASD relative to the camera, sprint with stamina, jump, crouch, capsule
// movement resolved against the city's box colliders, the third-person camera, four weapons with
// hitscan fire, tracers, muzzle flash, recoil, reloads, health and armour. Combat here is the
// player's half only: what a bullet hits is asked of the world by castRay.

import { WEAPONS, GAME, PLAYER_HEIGHT } from './config.js';
import {
  CAMERA, updateCameraRig, drawTracer, drawMuzzle, drawImpact,
} from './render.js';

export function createPlayer(scene, start) {
  const group = new THREE.Group();
  // Body made of boxes: torso in a cream shirt, dark trousers, a sun-red jacket on the shoulders.
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97a52, roughness: 0.8, flatShading: true });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xe7dcc4, roughness: 0.85, flatShading: true });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x9c3d2c, roughness: 0.8, flatShading: true });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x2f3a46, roughness: 0.9, flatShading: true });
  const hair = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
  torso.position.y = 1.22;
  torso.castShadow = true;
  group.add(torso);
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.4), jacket);
  shoulders.position.y = 1.5;
  shoulders.castShadow = true;
  group.add(shoulders);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.32), skin);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);
  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), hair);
  hairCap.position.y = 1.99;
  group.add(hairCap);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.34), trousers);
  hips.position.y = 0.84;
  group.add(hips);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.74, 0.26), trousers);
  legL.position.set(-0.15, 0.42, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.74, 0.26), trousers);
  legR.position.set(0.15, 0.42, 0);
  legR.castShadow = true;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), jacket);
  armL.position.set(-0.4, 1.22, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), jacket);
  armR.position.set(0.4, 1.22, 0);
  group.add(armR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.6, roughness: 0.4 }));
  gun.position.set(0.4, 1.26, 0.32);
  gun.visible = false;
  group.add(gun);

  group.position.set(start.x, 0.2, start.z);
  scene.add(group);

  const player = {
    group, torso, head, legL, legR, armL, armR, gun,
    position: new THREE.Vector3(start.x, 0.2, start.z),
    velocity: new THREE.Vector3(),
    facing: 0,
    footed: true,
    crouch: false,
    sprinting: false,
    aiming: false,
    health: GAME.healthMax,
    armour: 0,
    stamina: 100,
    weapons: [
      { clip: 0, reserve: 0 },
      { clip: 12, reserve: 96 },
      { clip: 0, reserve: 0 },
      { clip: 0, reserve: 0 },
    ],
    current: 0,
    fireCooldown: 0,
    reloading: 0,
    lastHurt: -99,
    alive: true,
    inVehicle: null,
    walkPhase: 0,
    hitFlash: 0,
    wheelOpen: false,
    crouchY: 1,
    upgrades: { mag: false, spread: false },
  };

  return player;
}

export function resetPlayer(player, start) {
  player.position.set(start.x, 0.2, start.z);
  player.velocity.set(0, 0, 0);
  player.group.position.copy(player.position);
  player.health = GAME.healthMax;
  player.armour = 0;
  player.stamina = 100;
  player.alive = true;
  player.inVehicle = null;
  player.group.visible = true;
  player.lastHurt = -99;
}

/** Box-vs-box: does a circle of radius r at (x,z) overlap a collider (keeping clear of tall ones). */
function resolveColliders(position, radius, colliders) {
  for (const c of colliders) {
    if (c.height < 1.2 && c.kind !== 'wall') continue;
    const nx = Math.max(c.minX, Math.min(position.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(position.z, c.maxZ));
    const dx = position.x - nx;
    const dz = position.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.0001;
      // Push out along the shortest axis: the nearest face.
      const pushX = (radius - Math.abs(dx)) * Math.sign(dx || 1);
      const pushZ = (radius - Math.abs(dz)) * Math.sign(dz || 1);
      if (Math.abs(pushX) < Math.abs(pushZ)) position.x += pushX;
      else position.z += pushZ;
    }
  }
}

export function updatePlayer(player, input, dt, world) {
  const { rendererState, colliders, vehicles, peds, audio, hud, police, missions } = world;
  if (!player.alive) return;

  const now = world.time;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.reloading = Math.max(0, player.reloading - dt);
  if (player.reloading === 0 && player.reloadPending) finishReload(player, hud, audio);
  player.aiming = input.mouse.right || input.isDown('crouch') && false;

  const move = new THREE.Vector3();
  if (input.isDown('forward')) move.z -= 1;
  if (input.isDown('back')) move.z += 1;
  if (input.isDown('left')) move.x -= 1;
  if (input.isDown('right')) move.x += 1;
  const moving = move.lengthSq() > 0;
  if (moving) move.normalize();

  player.crouch = input.isDown('crouch');
  const wantSprint = input.isDown('sprint') && !player.aiming && !player.crouch;
  if (wantSprint && player.stamina > 1 && moving) {
    player.stamina = Math.max(0, player.stamina - GAME.staminaDrain * dt);
    player.sprinting = true;
  } else {
    player.sprinting = false;
    player.stamina = Math.min(100, player.stamina + GAME.staminaRegen * dt);
  }
  const speed = player.crouch ? GAME.walk * 0.55 : player.aiming ? GAME.walk * 0.8 : player.sprinting ? GAME.sprint : GAME.run;

  // Movement is camera-relative.
  const yaw = CAMERA.yaw;
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const target = new THREE.Vector3();
  target.addScaledVector(fwd, -move.z).addScaledVector(right, move.x);
  if (target.lengthSq() > 0) target.normalize().multiplyScalar(speed);

  player.velocity.x += (target.x - player.velocity.x) * Math.min(1, dt * 12);
  player.velocity.z += (target.z - player.velocity.z) * Math.min(1, dt * 12);

  // Jump and gravity.
  if (input.pressed('jump') && player.position.y <= 0.21) player.velocity.y = GAME.jump;
  player.velocity.y -= GAME.gravity * dt;
  player.position.y += player.velocity.y * dt;
  if (player.position.y < 0.2) { player.position.y = 0.2; player.velocity.y = 0; }

  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  resolveColliders(player.position, 0.45, colliders);
  // Keep the player on land; the sea is a soft edge onto the beach.
  player.position.x = THREE.MathUtils.clamp(player.position.x, -800, 800);
  player.position.z = Math.min(player.position.z, world.seaZ + 30);

  // Face the movement direction or the aim.
  if (player.aiming) player.facing = CAMERA.yaw;
  else if (moving) player.facing = Math.atan2(player.velocity.x, player.velocity.z);
  const bodyYaw = player.facing;
  player.group.rotation.y = bodyYaw;
  player.group.position.copy(player.position);
  player.group.position.y -= player.crouch ? 0.35 : 0;

  // Walk cycle: legs and arms swing with speed.
  const planar = Math.hypot(player.velocity.x, player.velocity.z);
  player.walkPhase += dt * planar * 1.4;
  const swing = Math.sin(player.walkPhase) * Math.min(0.7, planar * 0.07);
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;
  player.armL.rotation.x = -swing * 0.6;
  player.armR.rotation.x = player.aiming ? -1.35 : swing * 0.6;
  if (player.aiming) {
    player.torso.rotation.y = 0;
    player.head.rotation.y = 0;
  } else {
    player.torso.rotation.y = 0;
  }

  // Weapon draw.
  const weapon = WEAPONS[player.current];
  player.gun.visible = player.current !== 0;
  if (player.gun.visible) {
    const clip = player.weapons[player.current].clip;
    player.gun.scale.setScalar(player.current === 3 ? 1.25 : player.current === 2 ? 1 : 0.8);
    player.gun.position.set(0.38, 1.28, 0.36);
    if (clip <= 0) player.gun.material.opacity = 1;
  }

  handleWeaponInput(player, input, world);
  updateHealth(player, dt, world);

  // Camera rig with wall pull-in.
  if (world.thirdPerson && world.cameraProbe) {
    const target = player.position;
    updateCameraRig(rendererState, target, input, {
      dt,
      aiming: player.aiming,
      sprint: player.sprinting,
      collision: world.cameraProbe,
    });
  }
}

function handleWeaponInput(player, input, world) {
  const { rendererState, audio } = world;
  const weapon = WEAPONS[player.current];
  if (input.wheelDelta) {
    if (Math.abs(input.wheelDelta) >= 1) {
      player.current = (player.current + (input.wheelDelta > 0 ? 1 : WEAPONS.length - 1)) % WEAPONS.length;
      world.hud?.showToast?.(`${WEAPONS[player.current].name}`);
      input.wheelDelta = 0;
    }
  }
  if (input.pressed('reload') && player.current !== 0) startReload(player);
  // 1-4 selects the weapon.
  for (let i = 1; i <= 4; i += 1) {
    if (input.pressedCode(`Digit${i}`)) player.current = i - 1;
  }
  if (input.pressedCode('Digit0') || input.pressedCode('KeyQ')) player.current = 0;

  const trigger = weapon.auto ? input.mouse.left : input.mouse.leftPressed;
  if (!trigger || player.fireCooldown > 0 || player.reloading > 0) return;
  if (player.current === 0) {
    // Melee punch: hits a pedestrian or guard within reach.
    player.fireCooldown = weapon.rate;
    const hit = castRay(player, world, weapon.range);
    if (hit && hit.distance < weapon.range) {
      if (hit.entity && hit.entity.takeDamage) hit.entity.takeDamage(weapon.damage, player);
      audio?.play.impact?.();
      CAMERA.shake = Math.max(CAMERA.shake, 0.4);
    }
    return;
  }
  const clip = player.weapons[player.current];
  if (clip.clip <= 0) {
    startReload(player);
    return;
  }
  clip.clip -= 1;
  player.fireCooldown = weapon.rate;
  audio?.play.gunshot?.(weapon.id);
  CAMERA.shake = Math.max(CAMERA.shake, player.current === 3 ? 1.4 : 0.7);
  player.aiming = player.aiming || input.mouse.right;

  const origin = new THREE.Vector3(player.position.x, player.position.y + 1.45, player.position.z);
  origin.addScaledVector(new THREE.Vector3(Math.sin(CAMERA.yaw), 0, Math.cos(CAMERA.yaw)), -0.2);
  const muzzle = origin.clone().add(new THREE.Vector3(Math.sin(player.facing) * 0.6, 0.1, Math.cos(player.facing) * 0.6));
  const pellets = weapon.pellets ?? 1;
  const spread = player.aiming ? weapon.spread * 0.45 : weapon.spread + (player.sprinting ? 0.03 : 0) + (player.crouch ? -weapon.spread * 0.2 : 0);
  for (let p = 0; p < pellets; p += 1) {
    const dir = cameraAimDirection(world);
    dir.x += (Math.random() - 0.5) * spread * 2;
    dir.y += (Math.random() - 0.5) * spread * 2;
    dir.z += (Math.random() - 0.5) * spread * 2;
    dir.normalize();
    const hit = castRay(player, world, weapon.range, dir, origin);
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, weapon.range);
    drawTracer(rendererState, muzzle, end, weapon.ammo ?? 0xffd27a);
    if (hit) {
      const target = hit.entity;
      if (target && target.takeDamage) {
        const dmg = target.headshot ? weapon.damage * 2.2 : weapon.damage;
        target.takeDamage(dmg, player);
        drawImpact(rendererState, hit.point, hit.normal, true);
      } else {
        drawImpact(rendererState, hit.point, hit.normal, false);
      }
    }
  }
  drawMuzzle(rendererState, muzzle, new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)));
  rendererState.casings.spawn(muzzle.x, 1.3, muzzle.z, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
  world.onGunfire?.(player);
}

function cameraAimDirection(world) {
  // Aim where the crosshair points: a ray from the camera through screen centre.
  const cam = world.rendererState.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  return dir.normalize();
}

/** Ray against the nearest of: peds/guards, police, vehicles and city boxes. Returns {point,distance,entity}. */
export function castRay(originEntity, world, maxRange, dirIn, originIn) {
  const origin = originIn ?? new THREE.Vector3(originEntity.position.x, originEntity.position.y + 1.45, originEntity.position.z);
  const dir = dirIn ?? cameraAimDirection(world);
  let best = { distance: maxRange, point: origin.clone().addScaledVector(dir, maxRange), entity: null, normal: null };

  const testPoint = (entity, point, radius, isHead) => {
    const t = point.clone().sub(origin);
    const along = t.dot(dir);
    if (along < 0.5 || along > best.distance) return;
    const closest = origin.clone().addScaledVector(dir, along);
    if (closest.distanceTo(point) < radius) {
      best = { distance: along, point: closest, entity, normal: dir.clone().negate(), headshot: isHead };
    }
  };
  for (const ped of world.peds ?? []) {
    if (ped.dead || ped === originEntity) continue;
    testPoint(ped, new THREE.Vector3(ped.position.x, ped.position.y + 1.2, ped.position.z), 0.55, false);
    testPoint(ped, new THREE.Vector3(ped.position.x, ped.position.y + 1.8, ped.position.z), 0.3, true);
  }
  for (const cop of world.police?.officers ?? []) {
    if (cop.dead) continue;
    testPoint(cop, new THREE.Vector3(cop.position.x, cop.position.y + 1.2, cop.position.z), 0.55, false);
    testPoint(cop, new THREE.Vector3(cop.position.x, cop.position.y + 1.8, cop.position.z), 0.3, true);
  }
  for (const car of world.vehicles ?? []) {
    if (car === originEntity) continue;
    const t = car.position.clone().sub(origin);
    const along = t.dot(dir);
    if (along < 0 || along > best.distance) continue;
    const closest = origin.clone().addScaledVector(dir, along);
    if (Math.abs(closest.x - car.position.x) < car.width / 2 + 0.3 && Math.abs(closest.z - car.position.z) < car.length / 2 + 0.3 && closest.y < 2.5) {
      best = { distance: along, point: closest, entity: car, normal: dir.clone().negate() };
    }
  }
  // City boxes: step along the ray and test footprints.
  for (let step = 1; step < Math.min(best.distance, maxRange); step += 1.5) {
    const x = origin.x + dir.x * step;
    const y = origin.y + dir.y * step;
    const z = origin.z + dir.z * step;
    let hitBox = null;
    for (const c of world.colliders) {
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && y < c.height) { hitBox = c; break; }
    }
    if (hitBox || y < 0) {
      best = { distance: step, point: new THREE.Vector3(x, y, z), entity: null, normal: new THREE.Vector3(0, 1, 0) };
      break;
    }
  }
  return best.distance < maxRange || best.entity ? best : null;
}

function startReload(player) {
  if (player.current === 0) return;
  const weapon = WEAPONS[player.current];
  const state = player.weapons[player.current];
  const cap = weapon.clip + (player.upgrades.mag ? Math.ceil(weapon.clip * 0.5) : 0);
  if (state.clip >= cap || state.reserve <= 0) return;
  player.reloading = 1.5;
  player.reloadPending = true;
}

function finishReload(player, hud, audio) {
  player.reloadPending = false;
  const weapon = WEAPONS[player.current];
  const state = player.weapons[player.current];
  const cap = weapon.clip + (player.upgrades.mag ? Math.ceil(weapon.clip * 0.5) : 0);
  const need = cap - state.clip;
  const take = Math.min(need, state.reserve);
  state.clip += take;
  state.reserve -= take;
  audio?.play.reload?.();
}

function updateHealth(player, dt, world) {
  if (player.health <= 0 && player.alive) {
    player.alive = false;
    world.onWasted?.(player);
    return;
  }
  const since = world.time - player.lastHurt;
  if (since > GAME.healthRegenDelay && player.health < GAME.healthMax) {
    // Regenerate only up to the nearest third, as the brief asks.
    const ceiling = player.health > 66 ? GAME.healthMax : player.health > 33 ? 66 : 33;
    player.health = Math.min(ceiling, player.health + dt * 6);
  }
  if (player.armour > 0) world.hud?.setArmour?.(player.armour);
}

export function hurtPlayer(player, amount, source, world) {
  if (!player.alive) return;
  player.lastHurt = world.time;
  let dmg = amount;
  if (player.armour > 0) {
    const absorbed = Math.min(player.armour, dmg * 0.7);
    player.armour -= absorbed;
    dmg -= absorbed;
  }
  player.health = Math.max(0, player.health - dmg);
  player.hitFlash = 0.3;
  CAMERA.shake = Math.max(CAMERA.shake, 0.8);
  world.hud?.flashHurt?.(source);
}

/** Hand the player into a car: hide the body, tell the vehicle. */
export function enterVehicle(player, car) {
  player.inVehicle = car;
  player.group.visible = false;
  car.driver = 'player';
  car.occupied = true;
}

export function exitVehicle(player, car) {
  player.inVehicle = null;
  player.group.visible = true;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading)).multiplyScalar(2.2);
  player.position.set(car.position.x + side.x, 0.2, car.position.z + side.z);
  player.velocity.set(0, 0, 0);
  player.group.position.copy(player.position);
  car.driver = null;
}
