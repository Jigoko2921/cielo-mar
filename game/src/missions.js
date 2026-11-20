// The story: eight missions for Rafa Quintero, each a briefing card, objective markers, dialogue,
// fail conditions and a reward; progress unlocks the next. Plus the side jobs (timed delivery and
// the boulevard street race), robbery spots and the garage's spend menu. Every mission runs on the
// real systems: cars are stolen and driven, couriers are rammed, guards are shot, pursuers are lost.
//
// 1 El Primer Vuelo  — steal the Vela GT from the Marina Verde hotel and deliver it to Puerto Azul.
// 2 Pan Comido      — ram a fleeing courier through Centro Viejo and take his case.
// 3 La Deuda        — collect three debts in La Ciénaga; the third turns into a shootout.
// 4 Ruta Nocturna   — drive contraband to the pier with two stars of police hunting you.
// 5 El Soplón       — tail an informant to the motel without being spotted, then silence him.
// 6 Tormenta        — assault the Puerto Azul warehouse: three waves of guards, then escape by boat.
// 7 Traición        — a meet in Las Palmas is a trap; fight out and lose a four-star pursuit.
// 8 Cielo Cayendo   — assault the Coronel's villa, chase him to the airstrip, end it on the runway.

import { LOCATIONS, VEHICLE_SPECS } from './config.js';
import { createVehicle } from './vehicles.js';
import { reportCrime } from './police.js';
import { alertCrowd } from './peds.js';

const STORY = [
  {
    id: 'primer-vuelo',
    title: 'El Primer Vuelo',
    giver: 'Tavo',
    brief: 'Take the Vela GT from the Hotel Marisol lot and bring it to my lock-up in Puerto Azul. No scrapes.',
    reward: 1200,
    start: { x: LOCATIONS.safehouse.x, z: LOCATIONS.safehouse.z },
    dialogue: [
      ['Tavo', 'Rafa. You came back to bury your father. Good. Now you work for me.'],
      ['Rafa', 'I came back for the funeral, Tavo. Not a job.'],
      ['Tavo', 'Same thing in this city. The Vela at the Marisol. Red, please. It is owed to me.'],
    ],
    steps: [
      { objective: 'Steal the Vela GT at the Hotel Marisol', marker: 'marinaHotel', enter: 'vela' },
      { objective: 'Deliver the car to Puerto Azul', marker: 'docks', near: 18 },
    ],
    fail: 'The car was destroyed.',
  },
  {
    id: 'pan-comido',
    title: 'Pan Comido',
    giver: 'Tavo',
    brief: 'A courier is running from my books through Centro Viejo. Ram him off the road and take his case.',
    reward: 1500,
    start: { x: LOCATIONS.garage.x, z: LOCATIONS.garage.z },
    dialogue: [
      ['Tavo', 'The courier. Brisa, tan, plate ends in four. He owes Vega.'],
      ['Rafa', 'And if he does not stop?'],
      ['Tavo', 'Then he learns what the seawall is for. Ram him. Carefully.'],
    ],
    steps: [{ objective: 'Ram the courier and take the case', chase: 'courier', marker: 'centro', near: 6 }],
    fail: 'The courier got away.',
  },
  {
    id: 'la-deuda',
    title: 'La Deuda',
    giver: 'Inés',
    brief: 'Three people owe your sister. Collect in La Ciénaga. The third one thinks he is a soldier.',
    reward: 1400,
    start: { x: LOCATIONS.cienaga.x, z: LOCATIONS.cienaga.z },
    dialogue: [
      ['Inés', 'You look like him. Around the mouth. Do not tell me the work, Rafa.'],
      ['Rafa', 'It is small debts, nena. From the old cart.'],
      ['Inés', 'Then collect them. Start with the man at the yellow cart.'],
    ],
    steps: [
      { objective: 'Collect the first debt', marker: 'cienaga', near: 4 },
      { objective: 'Collect the second debt', marker: 'garage', near: 4 },
      { objective: 'Collect the third debt — it is a trap', marker: 'stadium', guards: 3 },
    ],
    fail: 'You were killed collecting the debt.',
  },
  {
    id: 'ruta-nocturna',
    title: 'Ruta Nocturna',
    giver: 'La Sirena',
    brief: 'Drive a Panera of contraband to the pier with the PCM on your tail. Lose them before the dock.',
    reward: 1900,
    start: { x: LOCATIONS.garage.x, z: LOCATIONS.garage.z },
    dialogue: [
      ['La Sirena', 'The van is loaded. The police get a call from inside, of course.'],
      ['Rafa', 'Of course. How much do I have?'],
      ['La Sirena', 'To the pier and a boat. Lose them in the barrio. The streets eat a siren.'],
    ],
    steps: [
      { objective: 'Take the Panera van to the pier', enter: 'panera', wanted: 2, marker: 'pier', near: 20 },
    ],
    fail: 'The van was destroyed or the police held you.',
  },
  {
    id: 'el-soplon',
    title: 'El Soplón',
    giver: 'Tavo',
    brief: 'Follow the informant to the motel in Zona Norte. Stay off his mirror. Then silence him.',
    reward: 1700,
    start: { x: -100, z: 160 },
    dialogue: [
      ['Tavo', 'He talks to Márquez like it is a confession. Follow the yellow taxi.'],
      ['Rafa', 'He carries enough heat for a man who talks.'],
      ['Tavo', 'That is why we follow. Not question.'],
    ],
    steps: [
      { objective: 'Tail the informant to the motel', tail: 'informant' },
      { objective: 'Silence the informant at the motel', marker: 'motel', near: 5 },
    ],
    fail: 'The informant spotted you and ran.',
  },
  {
    id: 'tormenta',
    title: 'Tormenta',
    giver: 'La Sirena',
    brief: 'Clear the Puerto Azul warehouse. Three waves of Vidal’s men. Leave through the boat.',
    reward: 2400,
    start: { x: LOCATIONS.warehouse.x, z: LOCATIONS.warehouse.z + 30 },
    dialogue: [
      ['La Sirena', 'My cargo sits in Almacén 14 and the Coronel helps himself.'],
      ['Rafa', 'How many men?'],
      ['La Sirena', 'Three waves. The last one is the one that looks like him. Then the water.'],
    ],
    steps: [
      { objective: 'Eliminate the guards', marker: 'warehouse', waves: true, guards: 6 },
      { objective: 'Escape by boat from the pier', marker: 'pier', enter: 'boat', near: 14 },
    ],
    fail: 'You were overwhelmed.',
  },
  {
    id: 'traicion',
    title: 'Traición',
    giver: 'Tavo',
    brief: 'A deal in Las Palmas. It is a trap: fight out and lose the four stars before the villa lights go down.',
    reward: 2200,
    start: { x: LOCATIONS.villa.x - 60, z: LOCATIONS.villa.z - 40 },
    dialogue: [
      ['Tavo', 'The buyer has a house on the hill. Bring the case. Nothing more.'],
      ['Rafa', 'You said the same about the warehouse.'],
      ['Tavo', 'Rafa. If it goes bad — call Inés. Not me.'],
    ],
    steps: [
      { objective: 'Survive the ambush at Las Palmas', marker: 'villa', guards: 5 },
      { objective: 'Lose the four-star pursuit', wanted: 4, marker: 'safehouse', near: 20 },
    ],
    fail: 'The trap closed. You were killed.',
  },
  {
    id: 'cielo-cayendo',
    title: 'Cielo Cayendo',
    giver: 'Inés',
    brief: 'The Coronel took the only thing left. Take everything of his. The villa, then the airstrip.',
    reward: 5000,
    start: { x: LOCATIONS.safehouse.x, z: LOCATIONS.safehouse.z },
    dialogue: [
      ['Inés', 'They say he flies tonight. Márquez. From the north strip.'],
      ['Rafa', 'Then he flies to nowhere.'],
      ['Inés', 'Come back, Rafa. You are all of us now.'],
    ],
    steps: [
      { objective: 'Assault the Coronel’s villa', marker: 'villa', guards: 6 },
      { objective: 'Chase the Coronel to the airstrip', chase: 'coronel', marker: 'airstrip', near: 18 },
      { objective: 'End it on the runway', marker: 'airstrip', near: 4 },
    ],
    fail: 'The Coronel got to the plane.',
  },
];

export function createMissions() {
  return {
    index: 0,
    story: STORY,
    active: null,
    state: 'idle',
    step: 0,
    timer: 0,
    failures: 0,
    completed: 0,
    cooldown: 0,
    spawnTimer: 0,
    setIndex(i) { this.index = Math.max(0, Math.min(i, STORY.length)); },
    current() { return STORY[this.index] ?? null; },
    sideJobs: { delivery: null, race: null, deliveryCooldown: 0, raceCooldown: 30 },
  };
}

/** Start the mission at the current index. Stages its first step. */
export function startMission(missions, world) {
  const m = missions.current();
  if (!m) return false;
  if (missions.state === 'active') return false;
  missions.state = 'active';
  missions.step = 0;
  missions.active = { id: m.id, guardsAlive: 0, wave: 0, startTime: world.time, chase: null, target: null, spotted: false, alerted: false };
  world.audio?.play.ui?.();
  world.hud.showToast?.(`MISSION: ${m.title}`, true);
  if (m.dialogue) {
    openDialogue(m.dialogue, world);
  }
  stageStep(missions, world);
  return true;
}

let dialogueQueue = [];
let dialogueTimer = 0;
export function openDialogue(lines, world) {
  dialogueQueue = lines.slice();
  dialogueTimer = 0;
  nextLine(world);
}

function nextLine(world) {
  if (!dialogueQueue.length) return;
  const [who, line] = dialogueQueue.shift();
  world.hud.say(who, line, 3.2);
  dialogueTimer = 3.2;
}

export function updateDialogue(world, dt) {
  if (!dialogueQueue.length) return;
  dialogueTimer -= dt;
  if (dialogueTimer <= 0) nextLine(world);
}

function markerFor(step, m) {
  if (!step) return null;
  if (step.marker && LOCATIONS[step.marker]) {
    const loc = LOCATIONS[step.marker];
    return { x: loc.x, z: loc.z };
  }
  return null;
}

function stageStep(missions, world) {
  const m = missions.current();
  const step = m.steps[Math.min(missions.step, m.steps.length - 1)];
  missions.active.step = step;
  missions.active.guardsAlive = 0;
  missions.spawnTimer = 0;
  world.waypoint = markerFor(step, m);
  world.hud.setMission(missions.index + 1, m.title, step.objective, world.waypoint ? distanceTo(world, world.waypoint) : null);

  // Stage-specific spawns.
  if (step.enter === 'vela') {
    spawnSpecialCar(world, 'vela', LOCATIONS.marinaHotel, true);
  }
  if (step.chase === 'courier') {
    spawnChaseCar(world, 'brisa', 'courier', LOCATIONS.centro, 22, 0xb08a5a);
  }
  if (step.tail === 'informant') {
    const car = spawnChaseCar(world, 'amarillo', 'informant', { x: -100, z: 140 }, 30, 0xe8b62c);
    car.aiDrive = (w, dt) => informantAI(car, w, dt);
  }
  if (step.chase === 'coronel') {
    const car = spawnChaseCar(world, 'fuerte', 'coronel', { x: LOCATIONS.villa.x, z: LOCATIONS.villa.z - 30 }, 26, 0x101820);
    car.aiDrive = (w, dt) => coronelAI(car, w, dt);
  }
  if (step.guards || step.waves) setGuardsActive(missions, world, step);
  if (step.wanted) {
    world.police.wanted = Math.max(world.police.wanted, step.wanted);
    world.police.heat = world.police.wanted;
  }
  if (step.enter === 'panera') {
    spawnSpecialCar(world, 'panera', LOCATIONS.garage, false, true);
    world.police.wanted = Math.max(world.police.wanted, 2);
    world.police.heat = 2;
  }
}

function distanceTo(world, point) {
  const p = world.player.inVehicle ? world.playerCar.position : world.player.position;
  return Math.hypot(p.x - point.x, p.z - point.z);
}

function spawnSpecialCar(world, kind, at, parked = false, traffic = false) {
  if (world.missionCars.some((c) => c.kind === kind && c.special)) return;
  const car = createVehicle(world.rendererState.scene, kind, { x: at.x + 6, z: at.z + 6 }, Math.PI, { parked, traffic });
  car.special = true;
  car.missionKind = kind;
  world.vehicles.push(car);
  world.missionCars.push(car);
  return car;
}

function spawnChaseCar(world, kind, tag, at, distance, color) {
  const p = world.player.inVehicle ? world.playerCar.position : world.player.position;
  const heading = world.player.facing;
  const target = LOCATIONS[tag] ?? at;
  const angle = Math.atan2(target.x - p.x, target.z - p.z);
  const car = createVehicle(world.rendererState.scene, kind, { x: p.x + Math.sin(angle) * distance, z: p.z + Math.cos(angle) * distance }, angle, { color, driver: tag });
  car.missionTag = tag;
  car.speed = 10;
  car.aiDrive = (w, dt) => fleeAI(car, w, dt, LOCATIONS.pier);
  world.vehicles.push(car);
  world.missionCars.push(car);
  world.missions.active.target = car;
  world.hud.say('Tavo', 'There — that one. Do not lose him.', 3);
  return car;
}

function fleeAI(car, world, dt, awayFrom) {
  const target = world.missions.active?.fleeTarget ?? awayFrom;
  const want = Math.atan2(target.x - car.position.x, target.z - car.position.z);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { throttle: 1, steerInput: THREE.MathUtils.clamp(diff * 1.4, -1, 1), brake: 0 };
}

function informantAI(car, world, dt) {
  // Drives slowly to the motel along the lanes; if spotted, it sprints for the strip.
  const target = car.spotted ? LOCATIONS.airstrip : LOCATIONS.motel;
  const want = Math.atan2(target.x - car.position.x, target.z - car.position.z);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const throttle = car.spotted ? 1 : 0.4;
  car.speed = Math.min(car.speed, car.spotted ? 34 : 14);
  return { throttle, steerInput: THREE.MathUtils.clamp(diff * 1.3, -1, 1), brake: 0 };
}

function coronelAI(car, world, dt) {
  const target = LOCATIONS.airstrip;
  const d = car.position.distanceTo(new THREE.Vector3(target.x, 0, target.z));
  const want = Math.atan2(target.x - car.position.x, target.z - car.position.z);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const throttle = d < 20 ? 0.2 : 1;
  return { throttle, steerInput: THREE.MathUtils.clamp(diff * 1.3, -1, 1), brake: 0 };
}

/** Guards: mission-only hostiles, as simple figures with health and a rifle. */
function spawnGuard(world, position, heading = 0) {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x28312c, roughness: 0.9, flatShading: true });
  const skin = new THREE.MeshStandardMaterial({ color: 0xa86a44, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.32), dark);
  torso.position.y = 1.18; torso.castShadow = true; group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), skin);
  head.position.y = 1.7; group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), dark); legL.position.set(-0.12, 0.5, 0); group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), dark); legR.position.set(0.12, 0.5, 0); group.add(legR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  gun.position.set(0.3, 1.1, 0.3); group.add(gun);
  group.position.copy(position);
  group.rotation.y = heading;
  world.rendererState.scene.add(group);
  const guard = {
    group,
    position: position.clone(),
    heading,
    dead: false,
    health: 100,
    fireTimer: 1 + Math.random() * 1.5,
    takeDamage(amount) {
      this.health -= amount;
      if (this.health <= 0 && !this.dead) {
        this.dead = true;
        this.group.rotation.z = Math.PI / 2;
        this.group.position.y = 0.4;
          world.rendererState.sparks.spawn(position.x, 1.2, position.z, 0, 2, 0, 0.4, 0.4, 0xa3241a, 8, 0);
        world.missions.active.guardsAlive = Math.max(0, (world.missions.active.guardsAlive ?? 1) - 1);
        world.onGuardDown?.();
      }
    },
  };
  world.missionGuards.push(guard);
  world.peds.peds.push(guard);
  return guard;
}

function setGuardsActive(missions, world, step) {
  const count = step.guards ?? 6;
  const center = missions.active?.target?.position ?? markerFor(step, missions.current()) ?? world.player.position;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const pos = new THREE.Vector3(center.x + Math.cos(angle) * (7 + (i % 3) * 4), 0.2, center.z + Math.sin(angle) * (7 + (i % 3) * 4));
    spawnGuard(world, pos, Math.atan2(world.player.position.x - pos.x, world.player.position.z - pos.z));
  }
  missions.active.guardsAlive = count;
  missions.active.guardsTotal = count;
}

export function updateMissions(missions, world, dt) {
  updateDialogue(world, dt);
  const m = missions.current();
  for (const car of world.missionCars) {
    if (car.exploded) continue;
  }

  // Side jobs tick regardless of story.
  updateSideJobs(missions, world, dt);

  if (missions.state !== 'active' || !m) {
    // Idle: show the next mission marker at its start point.
    if (missions.state === 'idle' && m) {
      world.waypoint = m.start ?? null;
      world.hud.setMission(missions.index + 1, m.title, 'Start the mission', world.waypoint ? distanceTo(world, world.waypoint) : null);
    }
    return;
  }

  const active = missions.active;
  const step = active.step ?? m.steps[missions.step];
  if (!step) { completeMission(missions, world, m); return; }

  // Update the objective distance every frame.
  if (world.waypoint) world.hud.setMission(missions.index + 1, m.title, step.objective, distanceTo(world, world.waypoint));

  // Fail conditions: death is handled by the world before this; car destroyed.
  if (step.enter && world.player.inVehicle) {
    // Nothing extra: delivery checks the car kind.
  }
  if (m.id === 'primer-vuelo') {
    if (missions.step === 0) {
      if (world.player.inVehicle && world.playerCar?.special && world.playerCar.kind === 'vela') {
        missions.step = 1;
        world.hud.showToast('Vela secured. Deliver it.');
        stageStep(missions, world);
      }
    } else if (missions.step === 1) {
      if (world.player.inVehicle && world.playerCar?.special && world.playerCar.kind === 'vela' && distanceTo(world, world.waypoint) < 18) {
        completeMission(missions, world, m);
      }
      if (world.playerCar?.special && world.playerCar.exploded) failMission(missions, world, m.fail);
    }
  } else if (m.id === 'pan-comido') {
    const courier = active.target;
    if (courier && !courier.exploded) {
      const crashed = courier.damage > 55 || courier.speed < 2;
      if (crashed && distanceTo(world, courier.position) < 10) {
        world.hud.showToast('Case taken. The rest is paperwork.', true);
        completeMission(missions, world, m);
      }
      if (courier.position.distanceTo(world.player.position) > 260) failMission(missions, world, m.fail);
    }
  } else if (m.id === 'la-deuda') {
    if (missions.step < 2) {
      if (distanceTo(world, world.waypoint) < 5) {
        if (!missions.active.collected) {
          missions.active.collected = true;
          world.cash += 300;
          world.hud.showToast('$300 collected');
          world.audio?.play.pickup?.();
        }
      }
      if (missions.active.collected && distanceTo(world, world.waypoint) > 20) {
        missions.active.collected = false;
        missions.step += 1;
        waitThen(world, 0.4, () => stageStep(missions, world));
      }
    } else if (active.guardsAlive <= 0 && active.guardsTotal > 0) {
      completeMission(missions, world, m);
    }
  } else if (m.id === 'ruta-nocturna') {
    if (world.player.inVehicle && world.playerCar?.special && distanceTo(world, world.waypoint) < 20) {
      if (world.police.wanted >= 2) {
        world.hud.showToast('They saw the van. Lose them first.', true);
      } else {
        completeMission(missions, world, m);
      }
    }
    if (!world.player.inVehicle && world.playerCar?.exploded) failMission(missions, world, m.fail);
  } else if (m.id === 'el-soplon') {
    const target = active.target;
    if (missions.step === 0 && target) {
      const d = distanceTo(world, target.position);
      if (d < 22) {
        active.spotted = true;
        target.spotted = true;
        failMission(missions, world, m.fail);
      }
      if (target.position.distanceTo(new THREE.Vector3(LOCATIONS.motel.x, 0, LOCATIONS.motel.z)) < 14) {
        missions.step = 1;
        stageStep(missions, world);
        active.step = m.steps[1];
        world.hud.showToast('He parked. Finish it.');
        if (!active.guardsTotal) setGuardsActive(missions, world, { guards: 2, marker: 'motel' });
      }
    } else if (missions.step === 1) {
      if ((active.guardsAlive ?? 1) <= 0) completeMission(missions, world, m);
    }
  } else if (m.id === 'tormenta') {
    if (missions.step === 0) {
      if (active.guardsAlive <= 0) {
        active.wave += 1;
        if (active.wave < 3) {
          missions.spawnTimer -= dt;
          if (missions.spawnTimer <= 0) {
            missions.spawnTimer = 2.2;
            const remaining = 6 - active.wave * 2;
            setGuardsActive(missions, world, { guards: Math.max(2, remaining), marker: 'warehouse' });
            world.hud.showToast(`Wave ${active.wave + 1}`);
          }
        } else {
          missions.step = 1;
          stageStep(missions, world);
          world.waypoint = { x: LOCATIONS.pier.x, z: LOCATIONS.pier.z };
          world.hud.setMission(missions.index + 1, m.title, m.steps[1].objective, distanceTo(world, world.waypoint));
        }
      }
      world.hud.setMission(missions.index + 1, m.title, `Eliminate the guards ${Math.max(0, active.guardsTotal - active.guardsAlive)}/${active.guardsTotal}`, world.waypoint ? distanceTo(world, world.waypoint) : null);
    } else if (missions.step === 1) {
      if (world.player.inVehicle && world.playerCar?.kind === 'boat' && distanceTo(world, world.waypoint) < 24) {
        completeMission(missions, world, m);
      }
    }
  } else if (m.id === 'traicion') {
    if (missions.step === 0) {
      if (active.guardsAlive <= 0 && active.guardsTotal > 0) {
        missions.step = 1;
        world.police.wanted = 4;
        world.police.heat = 4;
        stageStep(missions, world);
      }
    } else if (missions.step === 1) {
      if (world.police.wanted === 0 && distanceTo(world, world.waypoint) < 30) completeMission(missions, world, m);
    }
  } else if (m.id === 'cielo-cayendo') {
    if (missions.step === 0) {
      if (active.guardsAlive <= 0 && active.guardsTotal > 0) {
        missions.step = 1;
        stageStep(missions, world);
        world.player.facing = 0;
        world.hud.say('Rafa', 'Márquez. The strip. Now.', 3);
        spawnChaseCar(world, 'fuerte', 'coronel', { x: LOCATIONS.villa.x, z: LOCATIONS.villa.z - 30 }, 26, 0x101820);
        world.missionCars[world.missionCars.length - 1].aiDrive = (w, dt) => coronelAI(world.missionCars[world.missionCars.length - 1], w, dt);
        world.missions.active.target = world.missionCars[world.missionCars.length - 1];
      }
    } else if (missions.step === 1) {
      const target = world.missionCars.find((c) => c.missionTag === 'coronel');
      if (target) {
        active.target = target;
        if (target.position.distanceTo(new THREE.Vector3(LOCATIONS.airstrip.x, 0, LOCATIONS.airstrip.z)) < 24 || (target.exploded)) {
          missions.step = 2;
          stageStep(missions, world);
          if (target.exploded) world.hud.say('Rafa', 'He is not flying anywhere.', 3);
          else setGuardsActive(missions, world, { guards: 3, marker: 'airstrip' });
        }
      }
    } else if (missions.step === 2) {
      if (active.guardsAlive <= 0 && active.guardsTotal > 0) completeEnding(missions, world, m);
    }
  }
}

let waits = [];
function waitThen(world, seconds, fn) { waits.push({ t: seconds, fn }); }
export function tickWaits(world, dt) {
  for (let i = waits.length - 1; i >= 0; i -= 1) {
    waits[i].t -= dt;
    if (waits[i].t <= 0) { const w = waits.splice(i, 1)[0]; w.fn(); }
  }
}

function completeEnding(missions, world, m) {
  completeMission(missions, world, m);
  world.hud.say('Inés', 'Cielo Mar is yours, Rafa. For now.', 5);
  world.hud.showToast('CIELO CAYENDO — COMPLETE', true);
  world.ending = true;
}

export function completeMission(missions, world, m) {
  if (missions.state !== 'active') return;
  missions.state = 'complete';
  missions.completed += 1;
  const payout = Math.round(m.reward * (1 + world.respect / 100));
  world.cash += payout;
  world.respect = Math.min(100, world.respect + (m.id === 'cielo-cayendo' ? 20 : 8));
  world.hud.showToast(`MISSION PASSED — $${payout}`, true);
  world.hud.say(m.giver ?? 'Rafa', m.id === 'cielo-cayendo' ? 'It is done. Golpe de gracia.' : 'Paid. The next one is worse.', 3.5);
  world.missions.index = Math.min(STORY.length, missions.index + 1);
  world.onMissionComplete?.(m, payout);
  world.waypoint = null;
  for (const car of world.missionCars) { if (car.special) car.special = false; }
  world.missionCars.length = 0;
  for (const g of world.missionGuards) { if (!g.dead) { g.dead = true; g.group.visible = false; } }
  world.missionGuards.length = 0;
  missions.cooldown = 3;
  missions.step = 0;
  missions.active = null;
  setTimeout(() => { if (world.missions.state === 'complete') world.missions.state = 'idle'; }, 3200);
}

export function failMission(missions, world, reason) {
  if (missions.state !== 'active') return;
  missions.state = 'failed';
  missions.failures += 1;
  for (const g of world.missionGuards) { if (!g.dead) { g.dead = true; g.group.position.y = 0.4; g.group.rotation.z = Math.PI / 2; } }
  world.hud.showToast(`MISSION FAILED — ${reason}`, true);
  world.hud.say('Rafa', 'Dammit.', 2.5);
  world.onMissionFailed?.(reason);
  setTimeout(() => { if (world.missions.state === 'failed') { world.missions.state = 'idle'; } }, 1600);
}

/** Notify missions that a vehicle was carjacked, a guard was shot, etc. */
export function missionsOnCarjack(missions, world, car) {
  if (missions.state === 'active' && missions.current()?.id === 'primer-vuelo' && car.kind === 'vela' && !car.special) {
    car.special = true;
    world.missionCars.push(car);
  }
}

/** The garage menu: repair, armour, weapon upgrades, respray. Returns a receipt string or null. */
export function garagePurchase(world, what) {
  if (what === 'repair') {
    if (world.cash < 350) return 'Not enough cash';
    world.cash -= 350;
    if (world.playerCar) world.playerCar.damage = 0;
    world.player.health = 100;
    return 'Vehicle repaired';
  }
  if (what === 'armour') {
    if (world.cash < 400) return 'Not enough cash';
    world.cash -= 400;
    world.player.armour = 100;
    return 'Armour vest fitted';
  }
  if (what === 'mag') {
    if (world.player.upgrades.mag) return 'Already fitted';
    if (world.cash < 1200) return 'Not enough cash';
    world.cash -= 1200;
    world.player.upgrades.mag = true;
    return 'Extended magazines';
  }
  if (what === 'spread') {
    if (world.player.upgrades.spread) return 'Already fitted';
    if (world.cash < 900) return 'Not enough cash';
    world.cash -= 900;
    world.player.upgrades.spread = true;
    return 'Tuned barrels';
  }
  if (what === 'respray') {
    if (world.cash < 600) return 'Not enough cash';
    world.cash -= 600;
    if (world.playerCar) { world.playerCar.damage = 0; world.playerCar.color = (world.playerCar.color + 0x556677) & 0xffffff; }
    return 'Resprayed and clean';
  }
  if (what === 'pay-spray') {
    if (world.cash < 600) return 'Not enough cash';
    world.cash -= 600;
    world.police.wanted = 0;
    world.police.heat = 0;
    if (world.playerCar) world.playerCar.color = 0x2f6f9d;
    return 'No plates, no record. Clean.';
  }
  return null;
}

/** A robbery spot in La Ciénaga: hold E to break a crate for cash; raises heat. */
export function tryRobbery(world) {
  const p = world.player.position;
  if (world.robberyCooldown > 0) return 'Nothing here yet';
  const spots = [
    { x: 590, z: -140, name: 'bodega' }, { x: 640, z: -90, name: 'taco stand' }, { x: 520, z: -200, name: 'laundromat' },
  ];
  for (const spot of spots) {
    if (Math.hypot(p.x - spot.x, p.z - spot.z) < 4) {
      world.robberyCooldown = 6;
      world.cash += 180;
      world.hud.showToast('$180 from the ' + spot.name);
      world.audio?.play.pickup?.();
      world.hud.flashHurt();
      reportCrime(world, Math.random() < 0.5 ? 1 : 2, 'Robbery in La Ciénaga');
      alertCrowd(world.peds, p, 5);
      return 'Robbery';
    }
  }
  return null;
}

/** Timed delivery: take a yellow van to a spot before the clock runs out. */
export function startDelivery(missions, world) {
  if (missions.sideJobs.delivery) return;
  const job = { time: 75, target: { x: 660, z: -650 }, van: null };
  const p = world.player.position;
  const van = createVehicle(world.rendererState.scene, 'panera', { x: p.x + 5, z: p.z + 3 }, 0, { color: 0xe8b62c });
  van.special = true;
  van.delivery = true;
  world.vehicles.push(van);
  job.van = van;
  missions.sideJobs.delivery = job;
  world.hud.showToast('DELIVERY: take the yellow van to the stadium', true);
}

function updateSideJobs(missions, world, dt) {
  const job = missions.sideJobs.delivery;
  if (job) {
    job.time -= dt;
    const p = world.player.inVehicle && world.playerCar === job.van ? job.van.position : world.player.position;
    const d = Math.hypot(p.x - job.target.x, p.z - job.target.z);
    world.waypoint = world.waypoint ?? job.target;
    world.hud.setMission(0, 'Side Job · Delivery', 'Deliver the van to the stadium', d);
    world.hud.showToast(`Delivery ${Math.ceil(job.time)}s`, false);
    if (d < 16) {
      world.cash += 900;
      world.hud.showToast('DELIVERY COMPLETE — $900', true);
      world.audio?.play.pickup?.();
      missions.sideJobs.delivery = null;
    } else if (job.time <= 0) {
      world.hud.showToast('DELIVERY FAILED', true);
      missions.sideJobs.delivery = null;
    }
  }
  missions.sideJobs.raceCooldown -= dt;
  const race = missions.sideJobs.race;
  if (race) {
    race.time -= dt;
    world.waypoint = race.target;
    world.hud.setMission(0, 'Side Job · Street Race', 'Hit all three checkpoints', null);
    if (race.target) {
      const p = world.player.inVehicle ? world.playerCar.position : world.player.position;
      if (Math.hypot(p.x - race.target.x, p.z - race.target.z) < 18) {
        race.checkpoint = (race.checkpoint ?? 0) + 1;
        if (race.checkpoint >= 3) {
          world.cash += 1500;
          world.hud.showToast('STREET RACE — $1500', true);
          missions.sideJobs.race = null;
          missions.sideJobs.raceCooldown = 45;
        } else {
          race.target = { x: -300 + race.checkpoint * 280, z: 520 - race.checkpoint * 240 };
        }
      }
    }
    if (race.time <= 0) { world.hud.showToast('RACE LOST', true); missions.sideJobs.race = null; }
  }
}

let missionSidebar = null;
export function setSidebar(hud) { missionSidebar = hud; }

export function startRace(missions, world) {
  if (missions.sideJobs.race || missions.sideJobs.raceCooldown > 0) return;
  missions.sideJobs.race = { time: 70, target: { x: -220, z: 500 }, checkpoint: 0 };
  world.hud.showToast('STREET RACE: three checkpoints', true);
}

/** The interact action E: start missions at a giver, garage, robberies, side jobs. */
export function handleInteract(world) {
  const p = world.player.position;
  const missions = world.missions;
  const near = (loc, r) => Math.hypot(p.x - loc.x, p.z - loc.z) < r;
  // Garage and pay-and-spray.
  if (near(LOCATIONS.garage, 8)) {
    return { open: 'garage' };
  }
  if (near(LOCATIONS.safehouse, 8)) {
    return { save: true };
  }
  const m = missions.current();
  if (missions.state === 'idle' && m && m.start && Math.hypot(p.x - m.start.x, p.z - m.start.z) < 10) {
    startMission(missions, world);
    return null;
  }
  const robbery = tryRobbery(world);
  if (robbery) return null;
  // Side jobs near the garage.
  if (near(LOCATIONS.cienaga, 30)) {
    startDelivery(missions, world);
    return null;
  }
  if (near(LOCATIONS.plaza, 20)) {
    startRace(missions, world);
    return null;
  }
  return null;
}

export { STORY };
