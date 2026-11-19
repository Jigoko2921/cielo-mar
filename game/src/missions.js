// Eight connected Rafa Quintero missions, dialogue, objectives, rewards and side jobs.
import { LOCATIONS, clamp, distance2D } from './config.js';

export const MISSION_DEFINITIONS = Object.freeze([
  { title: 'EL PRIMER VUELO', contact: 'TAVO — THE FIRST JOB', reward: 450, brief: 'A Vela GT waits in the Marina Verde hotel lot. Borrow it quietly and put it on a boat at Puerto Azul.', lines: [['TAVO', 'Vela GT. Marina hotel. Red like an unpaid bill.'], ['RAFA', 'I just buried my father, Tavo.'], ['TAVO', 'Then consider this a distraction with wheels.'], ['RAFA', 'Give me the dock. I will bring the car.']] },
  { title: 'PAN COMIDO', contact: 'INÉS — A BAD DELIVERY', reward: 650, brief: 'A courier took Inés’s ledger through Centro Viejo. Ram his Brisa, recover the case and keep the contents dry.', lines: [['INÉS', 'The man with my ledger drives a grey Brisa.'], ['RAFA', 'You kept a ledger on those men?'], ['INÉS', 'Someone in this family had to write things down.'], ['RAFA', 'Stay by the cart. I will bring back the pages.']] },
  { title: 'LA DEUDA', contact: 'TAVO — THREE SMALL FAVOURS', reward: 900, brief: 'Three debts around La Ciénaga. Ask twice at most. The third debtor has hired men and no intention of paying.', lines: [['TAVO', 'Three doors. Three envelopes. Easy arithmetic.'], ['RAFA', 'Your arithmetic usually leaves someone bleeding.'], ['TAVO', 'Only the last address. Probably.'], ['INÉS', 'Bring the money home, not the trouble.']] },
  { title: 'RUTA NOCTURNA', contact: 'LA SIRENA — NIGHT FREIGHT', reward: 1200, brief: 'Take the Panera at Puerto Azul to the lighthouse pier. The PCM knows the cargo. Arrive alive, then lose two stars.', lines: [['LA SIRENA', 'The tan van is yours. Do not open the crates.'], ['RAFA', 'That rule means you already opened them.'], ['LA SIRENA', 'Twice. Coastal police are waiting for the road.'], ['RAFA', 'Keep the pier dark until I lose them.']] },
  { title: 'EL SOPLÓN', contact: 'LA SIRENA — QUIET COMPANY', reward: 1450, brief: 'Tail the informant to the Zona Norte motel. Stay close enough to see him, far enough to be forgotten. Finish the meeting.', lines: [['LA SIRENA', 'Blue Brisa. Do not crowd the driver.'], ['RAFA', 'And when he stops?'], ['LA SIRENA', 'He plans to sell our names to Vidal.'], ['RAFA', 'Then he gets one last conversation.']] },
  { title: 'TORMENTA', contact: 'TAVO — TAKE THE WAREHOUSE', reward: 1800, brief: 'Hit Vidal’s Puerto Azul warehouse. Survive three guard waves, reach La Sirena’s boat and disappear into open water.', lines: [['TAVO', 'Vidal keeps his retirement fund in that warehouse.'], ['RAFA', 'How many men?'], ['TAVO', 'Enough to make a pessimist of you.'], ['LA SIRENA', 'My boat is at the pier. I only wait for winners.']] },
  { title: 'TRAICIÓN', contact: 'INÉS — AN EMPTY HANDSHAKE', reward: 2300, brief: 'Meet the supposed defector at Las Palmas. It is a trap. Fight out of the estate and shake a four-star pursuit.', lines: [['RAFA', 'Your defector chose an expensive place to surrender.'], ['INÉS', 'Vidal paid for the view with our neighbourhood.'], ['TAVO', 'Cars on the hill. Too many cars.'], ['RAFA', 'Trap, then. Keep the line open.']] },
  { title: 'CIELO CAYENDO', contact: 'LA SIRENA — THE COLONEL FALLS', reward: 4000, brief: 'Assault Coronel Vidal Márquez’s villa. Chase him to the north airstrip and end his hold on Cielo Mar on the runway.', lines: [['VIDAL', 'You think this city belongs to whoever survives it?'], ['RAFA', 'No. But it stops belonging to you tonight.'], ['VIDAL', 'Your father said something similarly brief.'], ['INÉS', 'Rafa. Bring yourself home after this.'], ['RAFA', 'One runway left, Inés. Then breakfast.']] },
]);

const DEBTS = [{ x: -151, z: 87 }, { x: -151, z: 179 }, { x: -241, z: 89 }];
const TAIL_ROUTE = [{ x: 0, z: -95 }, { x: 0, z: -190 }, { x: 95, z: -190 }, { x: 95, z: -285 }, { x: 82, z: -292 }];
const CORONEL_ROUTE = [{ x: -220, z: -285 }, { x: -95, z: -285 }, { x: 0, z: -285 }, { x: 95, z: -285 }, { x: 190, z: -285 }, { x: 281, z: -350 }];

export class MissionManager {
  constructor(renderer, city) {
    this.renderer = renderer;
    this.city = city;
    this.missionIndex = 0;
    this.unlockedIndex = 0;
    this.completedCount = 0;
    this.active = false;
    this.phase = 0;
    this.data = {};
    this.dialogueQueue = [];
    this.currentDialogue = null;
    this.dialogueTimer = 0;
    this.waypoint = renderer.createWaypoint();
    this.waypoint.visible = false;
    this.target = null;
    this.sideActivity = null;
    this.sideStats = {};
    this.lastResult = null;
  }

  resetProgress(missionIndex = 0, completedCount = missionIndex) {
    this.missionIndex = clamp(missionIndex, 0, 7);
    this.unlockedIndex = this.missionIndex;
    this.completedCount = completedCount;
    this.active = false;
    this.phase = 0;
    this.data = {};
    this.target = null;
    this.waypoint.visible = false;
    this.dialogueQueue = [];
    this.currentDialogue = null;
  }

  setTarget(point) {
    this.target = point ? { x: point.x, z: point.z } : null;
    this.waypoint.visible = !!point;
    if (point) this.waypoint.position.set(point.x, this.city.heightAt(point.x, point.z), point.z);
  }

  queueDialogue(lines, game) {
    for (const [speaker, line] of lines) this.dialogueQueue.push({ speaker, line });
    if (!this.currentDialogue) this.advanceDialogue(game);
  }

  advanceDialogue(game) {
    const next = this.dialogueQueue.shift();
    this.currentDialogue = next || null;
    this.dialogueTimer = next ? 4.4 : 0;
    if (next) {
      game.hud.showSubtitle(next.speaker, next.line, 4.4);
      game.audio.setDialogueDuck(true);
    } else game.audio.setDialogueDuck(false);
  }

  startMission(index, game) {
    if (index > this.unlockedIndex || index < 0 || index > 7 || this.active) return false;
    this.missionIndex = index;
    this.phase = 0;
    this.data = { kills: 0, wave: 0, timer: 0, suspicion: 0, routeIndex: 0, reference: null };
    this.active = true;
    this.dialogueQueue = [];
    const definition = MISSION_DEFINITIONS[index];
    game.screens.showBriefing(definition, index);
    this.queueDialogue(definition.lines, game);
    game.hud.toast(`MISSION ${index + 1}`, definition.title);
    if (index === 0) {
      this.data.reference = game.vehicles.vehicles.find((car) => car.missionTag === 'hotelVela');
      this.setTarget(this.data.reference?.position || LOCATIONS.marinaHotel);
    } else if (index === 1) {
      const car = game.vehicles.spawnVehicle('brisa', 32, 3, Math.PI / 2, { missionTag: 'courier', colour: 0x56646a, occupied: true });
      car.route = [{ x: 92, z: 3 }, { x: 92, z: 96 }, { x: 3, z: 96 }, { x: 3, z: 3 }, { x: -88, z: 3 }, { x: -88, z: -88 }];
      this.data.reference = car;
      this.setTarget(car.position);
    } else if (index === 2) {
      this.setTarget(DEBTS[0]);
    } else if (index === 3) {
      const van = game.vehicles.vehicles.find((car) => car.missionTag === 'contrabandVan');
      this.data.reference = van;
      game.night = 0.78;
      game.renderer.setNight(game.night);
      this.setTarget(van.position);
    } else if (index === 4) {
      const car = game.vehicles.spawnVehicle('brisa', -44, -88, Math.PI / 2, { missionTag: 'informant', colour: 0x375c78, occupied: true });
      this.data.reference = car;
      this.setTarget(car.position);
    } else if (index === 5) {
      this.setTarget(LOCATIONS.warehouse);
    } else if (index === 6 || index === 7) {
      this.setTarget(LOCATIONS.villa);
    }
    return true;
  }

  spawnWarehouseWave(game) {
    this.data.wave++;
    const centre = LOCATIONS.warehouse;
    const count = 2;
    for (let i = 0; i < count; i++) {
      const guard = game.peds.spawnGuard(centre.x - 14 + i * 28, centre.z + 26 + this.data.wave * 2 - (i % 2) * 5, { missionTag: 'warehouse' });
      this.data[`waveGuard${i}`] = guard.id;
    }
    this.data.waveIds = this.peopleWaveIds(game, 'warehouse');
    game.hud.toast(`WAVE ${this.data.wave} / 3`, 'Warehouse guards incoming');
  }

  peopleWaveIds(game, tag) { return game.peds.people.filter((p) => p.missionTag === tag && !p.down).map((p) => p.id); }

  spawnTrapGuards(game, final = false) {
    const centre = LOCATIONS.villa;
    const count = final ? 8 : 6;
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      game.peds.spawnGuard(centre.x + Math.sin(angle) * 25, centre.z + 40 + Math.cos(angle) * 12, { missionTag: final ? 'villa' : 'trap' });
    }
    this.phase++;
    this.setTarget({ x: centre.x, z: centre.z + 15 });
    game.police.raiseWanted(final ? 2 : 1, 'Estate gunfight');
  }

  onVehicleEntered(car, game = this.game) {
    if (!this.active) return;
    if (this.missionIndex === 0 && this.phase === 0 && car.missionTag === 'hotelVela') {
      this.phase = 1;
      this.setTarget({ x: 239, z: 275 });
    } else if (this.missionIndex === 3 && this.phase === 0 && car.missionTag === 'contrabandVan') {
      this.phase = 1;
      this.setTarget(LOCATIONS.pier);
      game.police.raiseWanted(2, 'Contraband reported');
    } else if (this.missionIndex === 5 && this.phase === 4 && car.missionTag === 'escapeBoat') {
      this.phase = 5;
      this.setTarget({ x: -229, z: 520 });
    }
  }

  onVehicleRam(car, amount) {
    if (!this.active) return;
    if (this.missionIndex === 1 && car.missionTag === 'courier' && this.phase === 0 && (car.damage > 28 || amount > 16)) {
      this.phase = 1;
      car.speed = 0;
      car.velocity.set(0, 0, 0);
      car.traffic = false;
      this.data.casePosition = { x: car.position.x + 2.6, z: car.position.z + 1.4 };
      this.setTarget(this.data.casePosition);
      this.game.hud.toast('COURIER STOPPED', 'Take the ledger case');
    }
    if (this.missionIndex === 7 && car.missionTag === 'coronelCar' && this.phase === 2 && car.damage > 32) this.putCoronelOnRunway(this.game);
  }

  onEnemyDown(person, game = this.game) {
    if (!this.active) return;
    if (this.missionIndex === 2 && person.missionTag === 'debtGuards') {
      this.data.kills++;
      if (this.data.kills >= 4) this.completeMission(game);
    } else if (this.missionIndex === 4 && person.missionTag === 'informant' && this.phase === 1) {
      this.completeMission(game);
    } else if (this.missionIndex === 5 && person.missionTag === 'warehouse') {
      this.data.kills++;
      const remaining = game.peds.people.filter((p) => p.missionTag === 'warehouse' && !p.down).length;
      if (remaining === 0) {
        if (this.data.wave < 3) { this.data.timer = 1.5; this.phase = 2; }
        else {
          this.phase = 4;
          const boat = game.vehicles.vehicles.find((car) => car.missionTag === 'escapeBoat');
          this.setTarget(boat.position);
          this.queueDialogue([['LA SIRENA', 'The warehouse is quiet. The sea is not. Get to my boat.'], ['TAVO', 'I counted six down. I am choosing not to ask about the rest.'], ['RAFA', 'Warm the engine. I am coming.']], game);
        }
      }
    } else if (this.missionIndex === 6 && person.missionTag === 'trap') {
      this.data.kills++;
      if (game.peds.people.filter((p) => p.missionTag === 'trap' && !p.down).length === 0) {
        this.phase = 2;
        this.setTarget(null);
        game.police.raiseWanted(4, 'Vidal calls the cavalry');
      }
    } else if (this.missionIndex === 7 && person.missionTag === 'villa') {
      this.data.kills++;
      if (game.peds.people.filter((p) => p.missionTag === 'villa' && !p.down).length === 0) {
        this.phase = 2;
        const car = game.vehicles.spawnVehicle('vela', LOCATIONS.villa.x + 34, LOCATIONS.villa.z + 27, Math.PI / 2, { missionTag: 'coronelCar', occupied: true, colour: 0x263c43 });
        this.data.reference = car;
        this.data.routeIndex = 0;
        this.setTarget(car.position);
        this.queueDialogue([['VIDAL', 'My aircraft is fuelled. Your little war ends as a rumour.'], ['INÉS', 'North airstrip, Rafa. He is running.'], ['RAFA', 'Then he already knows how this ends.']], game);
      }
    } else if (this.missionIndex === 7 && person.missionTag === 'coronel' && this.phase === 3) this.completeMission(game);
  }

  onPoliceEvaded() {
    if (!this.active) return;
    if (this.missionIndex === 3 && this.phase === 2) this.completeMission(this.game);
    if (this.missionIndex === 6 && this.phase === 2) this.completeMission(this.game);
  }

  onGunshot() {}

  putCoronelOnRunway(game) {
    if (this.phase === 3) return;
    this.phase = 3;
    const car = this.data.reference;
    if (car) { car.speed = 0; car.velocity.set(0, 0, 0); car.mesh.visible = false; }
    const person = game.peds.spawnGuard(LOCATIONS.airstrip.x, LOCATIONS.airstrip.z, { role: 'coronel', missionTag: 'coronel' });
    this.data.reference = person;
    this.setTarget(person.position);
    this.queueDialogue([['VIDAL', 'Go on, Quintero. Make a headline.'], ['RAFA', 'No headline. Just an empty chair.']], game);
  }

  updateMissionVehicle(deltaTime, route, speed) {
    const car = this.data.reference;
    if (!car || car.destroyed || !route?.length) return;
    const target = route[this.data.routeIndex % route.length];
    if (!target) return;
    const dx = target.x - car.position.x, dz = target.z - car.position.z;
    const desired = Math.atan2(dx, dz);
    car.heading += Math.atan2(Math.sin(desired - car.heading), Math.cos(desired - car.heading)) * Math.min(1, deltaTime * 2.2);
    car.speed += (speed - car.speed) * Math.min(1, deltaTime * 1.5);
    car.position.x += Math.sin(car.heading) * car.speed * deltaTime;
    car.position.z += Math.cos(car.heading) * car.speed * deltaTime;
    if (Math.hypot(dx, dz) < 8) this.data.routeIndex = (this.data.routeIndex + 1) % route.length;
    this.setTarget(car.position);
  }

  update(deltaTime, game) {
    this.game = game;
    this.dialogueTimer -= deltaTime;
    if (this.currentDialogue && this.dialogueTimer <= 0) this.advanceDialogue(game);
    if (!this.active) { this.updateSideActivity(deltaTime, game); return; }
    const position = game.player.vehicle?.position || game.player.position;
    const index = this.missionIndex;
    if (index === 0 && this.phase === 1 && distance2D(position, { x: 239, z: 275 }) < 15 && game.player.vehicle === this.data.reference) this.completeMission(game);
    else if (index === 1) {
      if (this.phase === 0) {
        this.updateMissionVehicle(deltaTime, this.data.reference.route, 15);
        if (distance2D(position, this.data.reference.position) > 190) this.data.timer += deltaTime;
        else this.data.timer = Math.max(0, this.data.timer - deltaTime * 2);
        if (this.data.timer > 12) this.failMission(game, 'The courier disappeared with the ledger.');
      } else if (distance2D(position, this.data.casePosition) < 3.5) {
        game.cash += 80;
        this.completeMission(game);
      }
    } else if (index === 2) {
      if (this.phase < 3) {
        const debt = DEBTS[this.phase];
        if (distance2D(position, debt) < 5.5) {
          if (this.phase < 2) {
            game.cash += 90;
            game.hud.toast(`DEBT ${this.phase + 1} COLLECTED`, '$90 moved off the books');
            this.queueDialogue([[this.phase ? 'DEBTOR' : 'RAFA', this.phase ? 'Tell Tavo this makes us even. No more visits.' : 'Envelope. Now. Your bartender can explain the interest.'], ['INÉS', this.phase ? 'One more. Keep your voice low.' : 'That is food for a week. Thank you.']], game);
            this.phase++;
            this.setTarget(DEBTS[this.phase]);
          } else {
            this.phase = 3;
            for (let i = 0; i < 4; i++) game.peds.spawnGuard(debt.x + 8 + i * 2.2, debt.z + (i % 2) * 7, { missionTag: 'debtGuards' });
            this.setTarget({ x: debt.x + 10, z: debt.z });
            this.queueDialogue([['DEBTOR', 'I paid Vidal instead. His men accept ammunition.'], ['RAFA', 'Bad accounting.']], game);
          }
        }
      } else this.setTarget(game.peds.people.find((p) => p.missionTag === 'debtGuards' && !p.down)?.position || null);
    } else if (index === 3) {
      if (this.phase === 1 && game.player.vehicle === this.data.reference && distance2D(position, LOCATIONS.pier) < 18) {
        this.phase = 2;
        this.setTarget(null);
        this.queueDialogue([['LA SIRENA', 'Cargo received. Now become boring. Lose the police.'], ['RAFA', 'Boring I can do. Quiet is another matter.']], game);
      }
      if (this.data.reference?.destroyed) this.failMission(game, 'The contraband burned on the road.');
    } else if (index === 4) {
      if (this.phase === 0) {
        this.updateMissionVehicle(deltaTime, TAIL_ROUTE, 8.5);
        const distance = distance2D(position, this.data.reference.position);
        this.data.suspicion = clamp(this.data.suspicion + deltaTime * ((distance < 9 || distance > 65) ? 1 : -0.8), 0, 6);
        if (this.data.suspicion >= 5.8) this.failMission(game, 'The informant made you before the motel.');
        if (distance2D(this.data.reference.position, LOCATIONS.motel) < 15) {
          this.phase = 1;
          this.data.reference.speed = 0;
          const informant = game.peds.spawnGuard(LOCATIONS.motel.x + 4, LOCATIONS.motel.z + 3, { missionTag: 'informant' });
          informant.health = 35;
          this.data.reference = informant;
          this.setTarget(informant.position);
        }
      } else this.setTarget(this.data.reference.position);
    } else if (index === 5) {
      if (this.phase === 0 && distance2D(position, LOCATIONS.warehouse) < 32) {
        this.phase = 1;
        this.spawnWarehouseWave(game);
        this.setTarget({ x: LOCATIONS.warehouse.x, z: LOCATIONS.warehouse.z + 10 });
      } else if (this.phase === 2) {
        this.data.timer -= deltaTime;
        if (this.data.timer <= 0) { this.phase = 1; this.spawnWarehouseWave(game); }
      } else if (this.phase === 1) this.setTarget(game.peds.people.find((p) => p.missionTag === 'warehouse' && !p.down)?.position || LOCATIONS.warehouse);
      if (this.phase === 5 && game.player.vehicle?.type === 'boat' && position.z > 500) this.completeMission(game);
    } else if (index === 6) {
      if (this.phase === 0 && distance2D(position, { x: LOCATIONS.villa.x, z: LOCATIONS.villa.z + 30 }) < 25) this.spawnTrapGuards(game, false);
      else if (this.phase === 1) this.setTarget(game.peds.people.find((p) => p.missionTag === 'trap' && !p.down)?.position || null);
    } else if (index === 7) {
      if (this.phase === 0 && distance2D(position, { x: LOCATIONS.villa.x, z: LOCATIONS.villa.z + 30 }) < 28) this.spawnTrapGuards(game, true);
      else if (this.phase === 1) this.setTarget(game.peds.people.find((p) => p.missionTag === 'villa' && !p.down)?.position || null);
      else if (this.phase === 2) {
        this.updateMissionVehicle(deltaTime, CORONEL_ROUTE, 24);
        if (distance2D(this.data.reference.position, LOCATIONS.airstrip) < 18) this.putCoronelOnRunway(game);
        if (distance2D(position, this.data.reference.position) > 260) this.data.timer += deltaTime;
        else this.data.timer = 0;
        if (this.data.timer > 9) this.failMission(game, 'Vidal escaped beyond the coastal hills.');
      } else if (this.phase === 3) this.setTarget(this.data.reference.position);
    }
    this.updateSideActivity(deltaTime, game);
  }

  getObjectiveInfo(game) {
    if (this.sideActivity) {
      const side = this.sideStats;
      if (this.sideActivity === 'delivery') return { kicker: 'SIDE JOB — YELLOW VAN', title: 'CITY COURIER', objective: `Deliver the package — ${Math.ceil(side.timer)}s`, target: side.target };
      return { kicker: 'NIGHT STREET RACE', title: 'BOULEVARD RUN', objective: `Checkpoint ${side.checkpoint + 1}/${side.route.length} — ${Math.ceil(side.timer)}s`, target: side.route[side.checkpoint] };
    }
    if (!this.active) {
      if (this.completedCount >= 8) return { kicker: 'CIELO MAR — FREE ROAM', title: 'THE CITY IS YOURS', objective: 'Delivery runs and night races remain open', target: LOCATIONS.foodCart };
      return { kicker: `STORY ${Math.min(8, this.completedCount + 1)} / 8`, title: 'INÉS’S FOOD CART', objective: `Start ${MISSION_DEFINITIONS[Math.min(7, this.completedCount)].title}`, target: LOCATIONS.foodCart };
    }
    const title = MISSION_DEFINITIONS[this.missionIndex].title;
    const base = { kicker: `MISSION ${this.missionIndex + 1} / 8`, title };
    const phase = this.phase;
    const objectives = [
      [phase ? 'Deliver the Vela GT to Puerto Azul' : 'Steal the Vela GT at the Marina hotel'],
      [phase ? 'Pick up the ledger case' : 'Ram the fleeing courier'],
      [phase < 3 ? `Collect debt ${phase + 1} of 3` : `Eliminate the debt guards ${this.data.kills}/4`],
      [phase === 0 ? 'Steal the contraband Panera' : phase === 1 ? 'Deliver the cargo to the pier' : 'Lose the two-star pursuit'],
      [phase === 0 ? `Tail the informant — suspicion ${Math.round(this.data.suspicion / 6 * 100)}%` : 'Silence the informant at the motel'],
      [phase === 0 ? 'Enter the Puerto Azul warehouse' : phase < 4 ? `Eliminate the guards ${this.data.kills}/6 — wave ${this.data.wave}/3` : phase === 4 ? 'Escape to La Sirena’s boat' : 'Reach open water'],
      [phase === 0 ? 'Meet the defector in Las Palmas' : phase === 1 ? `Fight out of the trap ${this.data.kills}/6` : 'Lose the four-star pursuit'],
      [phase === 0 ? 'Assault the Coronel’s villa' : phase === 1 ? `Eliminate the villa guards ${this.data.kills}/8` : phase === 2 ? 'Chase Vidal to the airstrip' : 'End it on the runway'],
    ];
    return { ...base, objective: objectives[this.missionIndex][0], target: this.target };
  }

  completeMission(game) {
    if (!this.active) return;
    const index = this.missionIndex;
    const definition = MISSION_DEFINITIONS[index];
    const reward = Math.round(definition.reward * (1 + game.respect * 0.008));
    game.cash += reward;
    game.respect += 10 + index * 2;
    this.completedCount = Math.max(this.completedCount, index + 1);
    this.unlockedIndex = Math.min(7, Math.max(this.unlockedIndex, index + 1));
    this.missionIndex = Math.min(7, index + 1);
    this.active = false;
    this.phase = 0;
    this.data = {};
    this.setTarget(null);
    this.lastResult = { title: definition.title, reward, index };
    game.police.clearWanted('The job is done');
    game.audio.missionComplete();
    game.screens.showMissionResult(definition, reward, index === 7);
    game.save.autosave(game);
    game.state = 'result';
    game.input.releasePointerLock();
  }

  failMission(game, reason) {
    if (!this.active) return;
    this.active = false;
    this.phase = 0;
    this.data = {};
    this.setTarget(null);
    game.police.clearWanted('Mission reset');
    game.hud.toast('MISSION FAILED', reason, 5);
    game.screens.showMissionFailed(reason);
    game.state = 'result';
    game.input.releasePointerLock();
  }

  startDelivery(game) {
    if (this.active || this.sideActivity) return;
    this.sideActivity = 'delivery';
    this.sideStats = { timer: 75, target: { x: -281, z: 228 } };
    this.setTarget(this.sideStats.target);
    game.hud.toast('CITY COURIER', '75 seconds to Marina Verde');
    game.audio.uiClick();
  }

  startRace(game) {
    if (this.active || this.sideActivity) return;
    const route = [{ x: 95, z: 285 }, { x: 190, z: 285 }, { x: 285, z: 190 }, { x: 190, z: 95 }, { x: 95, z: 0 }];
    this.sideActivity = 'race';
    this.sideStats = { timer: 65, checkpoint: 0, route };
    this.setTarget(route[0]);
    game.night = 0.8;
    game.renderer.setNight(game.night);
    game.hud.toast('BOULEVARD RUN', 'Five checkpoints. No trophies for second.');
  }

  updateSideActivity(deltaTime, game) {
    if (!this.sideActivity) return;
    const stats = this.sideStats;
    stats.timer -= deltaTime;
    const position = game.player.vehicle?.position || game.player.position;
    if (this.sideActivity === 'delivery') {
      if (distance2D(position, stats.target) < 10) {
        game.cash += 240;
        game.respect += 2;
        game.hud.toast('DELIVERY COMPLETE', '$240 / +2 respect');
        this.sideActivity = null;
        this.setTarget(LOCATIONS.foodCart);
      }
    } else {
      if (distance2D(position, stats.route[stats.checkpoint]) < 13) {
        stats.checkpoint++;
        game.audio.pickup();
        if (stats.checkpoint >= stats.route.length) {
          game.cash += 400;
          game.respect += 4;
          game.hud.toast('RACE WON', '$400 / +4 respect');
          this.sideActivity = null;
          this.setTarget(LOCATIONS.foodCart);
        } else this.setTarget(stats.route[stats.checkpoint]);
      }
    }
    if (this.sideActivity && stats.timer <= 0) {
      game.hud.toast('TIME EXPIRED', 'The activity can be restarted');
      this.sideActivity = null;
      this.setTarget(LOCATIONS.foodCart);
    }
  }
}

function itemIs(value, expected) { return value === expected; }
