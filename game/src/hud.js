// Diegetic-styled HUD and live circular 2D minimap, driven by actual world state.
import { LOCATIONS, WORLD, WEAPONS, METRES_PER_UNIT, clamp } from './config.js';

export class GameHUD {
  constructor() {
    const byId = (id) => document.getElementById(id);
    this.root = byId('hud');
    this.missionKicker = byId('mission-kicker');
    this.missionTitle = byId('mission-title');
    this.objective = byId('mission-objective');
    this.distance = byId('mission-distance');
    this.district = byId('district-name');
    this.cash = byId('cash');
    this.stars = byId('wanted-stars');
    this.health = byId('health-fill');
    this.armour = byId('armour-fill');
    this.stamina = byId('stamina-fill');
    this.weapon = byId('weapon-name');
    this.weaponIcon = byId('weapon-icon');
    this.ammo = byId('ammo');
    this.speed = byId('speed');
    this.speedometer = byId('speedometer');
    this.subtitles = byId('subtitles');
    this.speaker = byId('subtitle-speaker');
    this.subtitleLine = byId('subtitle-line');
    this.toastStack = byId('toast-stack');
    this.interaction = byId('interaction');
    this.crosshair = byId('crosshair');
    this.weaponWheel = byId('weapon-wheel');
    this.minimap = byId('minimap');
    this.mapContext = this.minimap.getContext('2d');
    this.policePanel = byId('police-panel');
    this.policeList = byId('police-list');
    this.respectFill = byId('respect-fill');
    this.respectRank = byId('respect-rank');
    this.damageFill = byId('damage-fill');
    this.radioName = byId('radio-name');
    this.policeSignature = '';
    this.displayCash = 0;
    this.subtitleTime = 0;
    this.toasts = [];
    this.mapFrame = 0;
    this.lastDistrict = '';
  }

  setVisible(visible) { this.root.classList.toggle('hidden', !visible); }

  showSubtitle(speaker, line, duration = 4.2) {
    this.speaker.textContent = speaker.toUpperCase();
    this.subtitleLine.textContent = line;
    this.subtitles.classList.remove('hidden');
    this.subtitleTime = duration;
  }

  toast(title, detail = '', duration = 3) {
    const duplicate = this.toasts.find((item) => item.title === title && item.detail === detail);
    if (duplicate) { duplicate.life = duration; return; }
    const element = document.createElement('div');
    element.className = 'toast';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const small = document.createElement('span');
    small.textContent = detail;
    element.append(strong, small);
    this.toastStack.append(element);
    this.toasts.push({ element, life: duration, title, detail });
    while (this.toasts.length > 4) {
      const oldest = this.toasts.shift();
      oldest.element.remove();
    }
  }

  setInteraction(text = '') {
    this.interaction.textContent = text;
    this.interaction.classList.toggle('hidden', !text);
  }

  update(deltaTime, game) {
    this.subtitleTime -= deltaTime;
    if (this.subtitleTime <= 0) this.subtitles.classList.add('hidden');
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const toast = this.toasts[i];
      toast.life -= deltaTime;
      toast.element.style.opacity = clamp(toast.life, 0, 1);
      if (toast.life <= 0) { toast.element.remove(); this.toasts.splice(i, 1); }
    }
    this.displayCash += (game.cash - this.displayCash) * Math.min(1, deltaTime * 5);
    if (Math.abs(game.cash - this.displayCash) < 0.6) this.displayCash = game.cash;
    this.cash.textContent = `$${Math.round(this.displayCash).toLocaleString('en-US')}`;
    const level = game.police.displayWanted;
    this.stars.innerHTML = Array.from({ length: 5 }, (_, index) => `<span class="${index < level ? 'earned' : ''}">★</span>`).join('');
    this.stars.classList.toggle('rising', game.police.rising);
    this.health.style.width = `${game.player.health}%`;
    this.armour.style.width = `${game.player.armour}%`;
    this.stamina.style.width = `${game.player.stamina}%`;
    const weapon = game.player.weapon;
    this.weapon.textContent = weapon.name.toUpperCase();
    this.weaponIcon.textContent = weapon.short;
    const current = game.player.ammo[game.player.currentWeapon];
    const reserve = game.player.reserves[game.player.currentWeapon];
    this.ammo.textContent = game.player.currentWeapon === 0 ? '—' : `${String(current).padStart(2, '0')} / ${String(reserve).padStart(3, '0')}`;
    this.crosshair.classList.toggle('hidden', !game.player.aiming || !!game.player.vehicle);
    this.weaponWheel.classList.toggle('hidden', !game.input.down('Tab') || !!game.player.vehicle);
    const vehicle = game.player.vehicle;
    this.speedometer.classList.toggle('hidden', !vehicle);
    if (vehicle) {
      this.speed.textContent = String(Math.round(Math.abs(vehicle.speed) * 6.2)).padStart(3, '0');
      this.damageFill.style.width = `${clamp(100 - vehicle.damage * 0.83, 0, 100)}%`;
    }
    const station = ['RADIO BRISA — BOLERO', 'FM OLAS — NIGHT SYNTH', 'PCM VOZ — TALK'][game.audio?.radioStation ?? 0];
    if (this.radioName.textContent !== station) this.radioName.textContent = station;
    const respect = Math.min(100, Math.round(game.respect * 2.5));
    this.respectFill.style.width = `${respect}%`;
    const rank = respect >= 90 ? 'KINGPIN' : respect >= 65 ? 'SHOT CALLER' : respect >= 40 ? 'CONNECTED' : respect >= 18 ? 'KNOWN' : 'UNKNOWN';
    if (this.respectRank.textContent !== rank) this.respectRank.textContent = rank;
    this.updatePolicePanel(game);
    const position = vehicle?.position || game.player.position;
    const district = game.city.districtNameAt(position.x, position.z);
    if (district !== this.lastDistrict) {
      this.district.textContent = district;
      this.lastDistrict = district;
    }
    const info = game.missions.getObjectiveInfo(game);
    this.missionKicker.textContent = info.kicker;
    this.missionTitle.textContent = info.title;
    this.objective.textContent = info.objective;
    if (info.target) {
      const targetDistance = Math.hypot(position.x - info.target.x, position.z - info.target.z) * METRES_PER_UNIT;
      this.distance.textContent = `${Math.round(targetDistance)} M`;
    } else this.distance.textContent = info.distance || '';
    if (++this.mapFrame % 2 === 0 || game.state === 'shot') this.drawMinimap(game);
  }

  updatePolicePanel(game) {
    const level = game.police.displayWanted;
    const origin = game.player.vehicle?.position || game.player.position;
    const units = game.police.units
      .filter((car) => !car.destroyed && !car.retiring)
      .map((car) => ({ car, metres: Math.hypot(car.position.x - origin.x, car.position.z - origin.z) * METRES_PER_UNIT }))
      .sort((a, b) => a.metres - b.metres)
      .slice(0, 4);
    const active = level > 0 && units.length > 0;
    this.policePanel.classList.toggle('hidden', !active);
    if (!active) { this.policeSignature = ''; return; }
    const rows = units.map(({ car, metres }) => {
      const call = `PCM-${String(10 + (car.id % 89)).padStart(2, '0')}`;
      const tactic = car.speed > 16 && metres < 30 ? 'RAMMING' : game.police.searching ? 'SEARCH GRID' : metres < 26 ? 'CLOSING' : 'PURSUIT';
      return `<div class="police-unit"><b>${call}</b><em>${tactic}</em><span>${Math.round(metres)}M</span></div>`;
    });
    if (game.police.helicopter && game.police.helicopter.visible) {
      const metres = Math.hypot(game.police.helicopter.position.x - origin.x, game.police.helicopter.position.z - origin.z) * METRES_PER_UNIT;
      rows.push(`<div class="police-unit"><b>AIR-1</b><em>SPOTLIGHT</em><span>${Math.round(metres)}M</span></div>`);
    }
    if (!rows.length) rows.push('<div class="police-unit"><b>DISPATCH</b><em>NO UNITS IN RANGE</em><span></span></div>');
    const markup = rows.join('');
    if (markup !== this.policeSignature) { this.policeList.innerHTML = markup; this.policeSignature = markup; }
  }

  drawMinimap(game) {
    const context = this.mapContext;
    const width = this.minimap.width, height = this.minimap.height;
    const cx = width / 2, cy = height / 2;
    const scale = 0.285;
    const position = game.player.vehicle?.position || game.player.position;
    const project = (x, z) => [cx + (x - position.x) * scale, cy + (z - position.z) * scale];
    context.clearRect(0, 0, width, height);
    context.save();
    context.beginPath();
    context.arc(cx, cy, width * 0.48, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#236876';
    context.fillRect(0, 0, width, height);
    const [landLeft, landTop] = project(-450, -470);
    const [landRight, landBottom] = project(450, WORLD.seaStart);
    context.fillStyle = '#c1b396';
    context.fillRect(landLeft, landTop, landRight - landLeft, landBottom - landTop);
    context.fillStyle = '#a0957f';
    for (const box of game.city.colliders) {
      if (box.tag === 'container' || box.tag === 'crane') continue;
      const [x, y] = project(box.minX, box.minZ);
      const [right, bottom] = project(box.maxX, box.maxZ);
      if (right < 0 || bottom < 0 || x > width || y > height) continue;
      context.fillRect(x, y, right - x, bottom - y);
    }
    context.lineCap = 'butt';
    for (const road of game.city.roads) {
      context.strokeStyle = road.axis === 'diagonal' || road.fixed === 285 ? '#dcc175' : '#535c5c';
      context.lineWidth = road.axis === 'diagonal' ? 4 : road.axis === 'x' && road.fixed === 285 ? 5 : 3.1;
      context.beginPath();
      if (road.axis === 'z') {
        context.moveTo(...project(road.fixed, road.start));
        context.lineTo(...project(road.fixed, road.end));
      } else if (road.axis === 'x') {
        context.moveTo(...project(road.start, road.fixed));
        context.lineTo(...project(road.end, road.fixed));
      } else {
        const dx = Math.cos(road.angle) * 210, dz = -Math.sin(road.angle) * 210;
        context.moveTo(...project(road.cx - dx, road.cz - dz));
        context.lineTo(...project(road.cx + dx, road.cz + dz));
      }
      context.stroke();
    }
    // Local service and activity marks.
    const mapIcons = [
      { point: LOCATIONS.safehouse, colour: '#65c6a8', label: 'S' },
      { point: LOCATIONS.garage, colour: '#f2bd65', label: 'G' },
      { point: LOCATIONS.delivery, colour: '#e9bd53', label: 'D' },
    ];
    context.font = 'bold 9px monospace';
    context.textAlign = 'center';
    for (const icon of mapIcons) {
      const [x, y] = project(icon.point.x, icon.point.z);
      context.fillStyle = '#15272a';
      context.fillRect(x - 6, y - 6, 12, 12);
      context.fillStyle = icon.colour;
      context.fillText(icon.label, x, y + 3);
    }
    if (game.police.wanted > 0 && game.police.searching) {
      const [x, y] = project(game.police.lastKnown.x, game.police.lastKnown.z);
      context.strokeStyle = 'rgba(228,87,46,0.75)';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(x, y, game.police.searchRadius * scale, 0, Math.PI * 2);
      context.stroke();
    }
    for (const car of game.vehicles.vehicles) {
      if (!car.police || car.destroyed || car.retiring) continue;
      const [x, y] = project(car.position.x, car.position.z);
      context.fillStyle = car.id % 2 ? '#ec6652' : '#60b5d0';
      context.fillRect(x - 2.8, y - 2.8, 5.6, 5.6);
    }
    const info = game.missions.getObjectiveInfo(game);
    if (info.target) {
      const [x, y] = project(info.target.x, info.target.z);
      context.save();
      context.translate(x, y);
      context.rotate(Math.PI / 4);
      context.fillStyle = '#ffba47';
      context.fillRect(-5, -5, 10, 10);
      context.strokeStyle = '#1b2425';
      context.lineWidth = 1;
      context.strokeRect(-5, -5, 10, 10);
      context.restore();
    }
    const [px, py] = project(position.x, position.z);
    const heading = game.player.vehicle?.heading ?? game.player.heading;
    context.save();
    context.translate(px, py);
    context.rotate(heading + Math.PI);
    context.fillStyle = '#f8f0d7';
    context.strokeStyle = '#18282c';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(5.5, 6);
    context.lineTo(0, 3.5);
    context.lineTo(-5.5, 6);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
    context.restore();
    context.strokeStyle = '#e7d7b8';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, width * 0.477, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#ffbb4b';
    context.font = 'bold 11px monospace';
    context.textAlign = 'center';
    context.fillText('N', cx, 15);
    context.beginPath();
    context.moveTo(cx, 20);
    context.lineTo(cx - 4, 27);
    context.lineTo(cx + 4, 27);
    context.fill();
  }
}
