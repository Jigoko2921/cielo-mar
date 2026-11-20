// The HUD: a circular minimap on a 2D canvas (roads, blocks, water, north marker, the player
// arrow, the mission waypoint, police blips and the search ring), five wanted stars that flash
// while the level is rising, cash with a slow count-up, the respect bar and rank, weapon and ammo,
// health/armour/stamina, the speedometer with vehicle damage and the radio station, subtitles,
// toasts, the police-response panel, the weapon wheel and the damage vignette.

import { RANKS, RADIO, WEAPONS, PALETTE, LOCATIONS } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = {
    root: el('hud'),
    minimap: el('minimap'),
    stars: el('stars'),
    cashVal: el('cash-val'),
    cashShown: 0,
    cashTarget: 0,
    mJob: el('m-job'),
    mTitle: el('m-title'),
    mObj: el('m-obj'),
    mDist: el('m-dist'),
    missionCard: el('mission-card'),
    policePanel: el('police-panel'),
    policeList: el('police-list'),
    policeLevel: el('police-level'),
    hp: el('hp-fill'),
    ar: el('ar-fill'),
    st: el('st-fill'),
    weaponName: el('weapon-name'),
    weaponIcon: el('weapon-icon'),
    ammoClip: el('ammo-clip'),
    ammoRes: el('ammo-res'),
    vehicleBlock: el('vehicle-block'),
    speedVal: el('speed-val'),
    vehDamage: el('veh-damage').firstElementChild,
    radio: el('radio'),
    subs: el('subs'),
    subWho: el('sub-who'),
    subLine: el('sub-line'),
    toasts: el('toasts'),
    reticle: el('reticle'),
    wheel: el('wheel'),
    respectFill: el('respect-fill'),
    respectNum: el('respect-num'),
    rank: el('rank'),
    hurt: el('hurt'),
    minimapCtx: el('minimap').getContext('2d'),
    weaponCtx: el('weapon-icon').getContext('2d'),
    starsBuilt: 0,
    flashTimer: 0,
    subtitleTimer: 0,
    toastList: [],
    cache: {},
  };

  // Five wanted stars, always present but dim until earned.
  for (let i = 0; i < 5; i += 1) {
    const star = document.createElement('div');
    star.className = 'star';
    hud.stars.appendChild(star);
  }
  // Weapon-wheel slots.
  for (let i = 0; i < WEAPONS.length; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const ang = (i / WEAPONS.length) * Math.PI * 2 - Math.PI / 2;
    slot.style.left = `${150 + Math.cos(ang) * 120 - 60}px`;
    slot.style.top = `${150 + Math.sin(ang) * 120 - 16}px`;
    slot.textContent = `${i === 0 ? '0' : i} ${WEAPONS[i].name.toUpperCase()}`;
    hud.wheel.appendChild(slot);
  }

  hud.show = () => hud.root.classList.remove('hidden');
  hud.hide = () => hud.root.classList.add('hidden');

  hud.drawMinimap = (world) => {
    const ctx = hud.minimapCtx;
    const size = 180;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(90, 90, 88, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1b2b2c';
    ctx.fillRect(0, 0, size, size);
    const player = world.player;
    const pos = player.inVehicle && world.playerCar ? world.playerCar.position : player.position;
    const heading = player.inVehicle && world.playerCar ? world.playerCar.heading : player.facing;
    const zoom = 0.32; // pixels per metre
    const cx = pos.x, cz = pos.z;
    const toMap = (x, z) => {
      const dx = x - cx;
      const dz = z - cz;
      // North up: world -z is up on the map.
      return [90 + dx * zoom, 90 + dz * zoom];
    };

    // Water south.
    ctx.fillStyle = '#235f6b';
    const seaY = toMap(cx, 600)[1];
    ctx.fillRect(0, seaY, size, size - seaY);

    // Road grid.
    ctx.strokeStyle = '#4b4b4e';
    ctx.lineWidth = 5;
    const roads = world.city.roads;
    for (const r of roads) {
      let p = toMap(r, cz - 300);
      let q = toMap(r, cz + 300);
      if (p[0] < 0 || p[0] > size) { if (p[0] < -40 || p[0] > size + 40) continue; }
      ctx.beginPath(); ctx.moveTo(p[0], 0); ctx.lineTo(q[0], size); ctx.stroke();
      p = toMap(cx - 300, r);
      q = toMap(cx + 300, r);
      ctx.beginPath(); ctx.moveTo(0, p[1]); ctx.lineTo(size, q[1]); ctx.stroke();
    }
    // Buildings as beige blocks (sample the colliders).
    ctx.fillStyle = '#5d5548';
    for (const c of world.city.colliders) {
      if (c.height < 4) continue;
      const [ax, ay] = toMap(c.minX, c.minZ);
      const [bx, by] = toMap(c.maxX, c.maxZ);
      if (bx < 0 || ax > size || by < 0 || ay > size) continue;
      ctx.fillRect(ax, ay, Math.max(1, bx - ax), Math.max(1, by - ay));
    }
    // Beach sand strip.
    ctx.fillStyle = 'rgba(230,211,174,0.5)';
    ctx.fillRect(0, seaY - 6, size, 6);

    // Police search ring, centered on last seen.
    if (world.police.wanted > 0 && world.police.searchRadius > 0) {
      const [sx, sy] = toMap(
        world.police.lastSeen?.x ?? cx,
        world.police.lastSeen?.z ?? cz,
      );
      ctx.strokeStyle = 'rgba(228,87,46,0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, world.police.searchRadius * zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Police blips.
    for (const car of world.police.cars) {
      if (!car.position || (!car.visible && !car.isHeli)) continue;
      const [px, py] = toMap(car.position.x, car.position.z);
      ctx.fillStyle = car.isHeli ? '#ffb347' : '#3aa6ff';
      ctx.beginPath(); ctx.arc(px, py, car.isHeli ? 3 : 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#08121c'; ctx.lineWidth = 1; ctx.stroke();
    }
    for (const ped of world.peds.peds) {
      if (!ped.group.visible || ped.dead) continue;
      const [px, py] = toMap(ped.position.x, ped.position.z);
      if (px < 0 || px > size || py < 0 || py > size) continue;
      ctx.fillStyle = 'rgba(240,230,210,0.35)';
      ctx.fillRect(px, py, 1.5, 1.5);
    }
    // Traffic blips (small turquoise dots).
    ctx.fillStyle = 'rgba(53,208,192,0.5)';
    for (const car of world.vehicles) {
      if (car.police || car.exploded || car === world.playerCar) continue;
      const [px, py] = toMap(car.position.x, car.position.z);
      if (px < 0 || px > size || py < 0 || py > size) continue;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }

    // Mission waypoint: an amber diamond with a distance ring.
    if (world.waypoint) {
      const [wx, wy] = toMap(world.waypoint.x, world.waypoint.z);
      const clampedX = Math.max(8, Math.min(172, wx));
      const clampedY = Math.max(8, Math.min(172, wy));
      ctx.fillStyle = PALETTE.amber;
      ctx.save();
      ctx.translate(clampedX, clampedY);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    // Safehouse / garage icons.
    const icons = [
      [LOCATIONS.safehouse, '#9be06f'], [LOCATIONS.garage, '#35d0c0'],
    ];
    for (const [loc, color] of icons) {
      const [ix, iy] = toMap(loc.x, loc.z);
      if (ix < 4 || ix > 176 || iy < 4 || iy > 176) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ix - 3, iy - 3, 6, 6);
    }

    // Player arrow at centre, rotated by heading.
    ctx.save();
    ctx.translate(90, 90);
    ctx.rotate(-heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // A ring and a soft inner shade for the border.
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(90, 90, 87, 0, Math.PI * 2); ctx.stroke();
  };

  hud.drawWeaponIcon = (index) => {
    const ctx = hud.weaponCtx;
    ctx.clearRect(0, 0, 54, 30);
    ctx.fillStyle = '#e8e0cf';
    ctx.strokeStyle = '#e8e0cf';
    const y = 15;
    if (index === 0) {
      ctx.beginPath(); ctx.arc(20, y, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(34, y, 8, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    if (index === 1) {
      ctx.fillRect(6, y - 5, 30, 8);
      ctx.fillRect(28, y + 2, 8, 14);
      ctx.fillRect(4, y - 3, 6, 10);
    } else if (index === 2) {
      ctx.fillRect(4, y - 4, 40, 7);
      ctx.fillRect(24, y + 1, 9, 15);
      ctx.fillStyle = '#8a8174';
      ctx.fillRect(10, y + 3, 10, 12);
    } else {
      ctx.fillRect(4, y - 3, 48, 6);
      ctx.fillRect(8, y + 1, 14, 10);
      ctx.fillStyle = '#9b6b3a';
      ctx.fillRect(12, y + 8, 12, 5);
    }
  };
  hud.drawWeaponIcon(1);

  hud.setStars = (want, rising) => {
    const stars = hud.stars.children;
    for (let i = 0; i < stars.length; i += 1) {
      stars[i].classList.toggle('on', i < want);
    }
    hud.stars.classList.toggle('flash', !!rising);
  };

  hud.setCash = (value, instant = false) => {
    hud.cashTarget = value;
    if (instant) { hud.cashShown = value; hud.cashVal.textContent = Math.round(value).toLocaleString('en-US'); }
  };

  hud.updateCash = (dt) => {
    if (hud.cashShown === hud.cashTarget) return;
    const diff = hud.cashTarget - hud.cashShown;
    hud.cashShown += diff * Math.min(1, dt * 3) + Math.sign(diff) * Math.min(Math.abs(diff), 8);
    hud.cashVal.textContent = Math.round(hud.cashShown).toLocaleString('en-US');
  };

  hud.setRespect = (value) => {
    hud.cache.respect = value;
    hud.respectFill.style.width = `${Math.min(100, value)}%`;
    hud.respectNum.textContent = `${Math.round(value)}%`;
    let rank = RANKS[0].name;
    for (const r of RANKS) if (value >= r.at) rank = r.name;
    hud.rank.textContent = rank;
  };

  hud.setVitals = (p) => {
    hud.hp.style.transform = `scaleX(${Math.max(0, p.health / 100)})`;
    hud.ar.style.transform = `scaleX(${Math.max(0, p.armour / 100)})`;
    hud.st.style.transform = `scaleX(${Math.max(0, p.stamina / 100)})`;
  };

  hud.setWeapon = (weapon, state) => {
    hud.weaponName.textContent = weapon.name.toUpperCase();
    if (weapon.clip === 0) {
      hud.ammoClip.textContent = '--';
      hud.ammoRes.textContent = '';
    } else {
      hud.ammoClip.textContent = String(state.clip);
      hud.ammoRes.textContent = ` / ${state.reserve}`;
    }
    hud.drawWeaponIcon(WEAPONS.indexOf(weapon));
  };

  hud.setVehicle = (car) => {
    if (!car) { hud.vehicleBlock.classList.add('hidden'); return; }
    hud.vehicleBlock.classList.remove('hidden');
    const kmh = Math.round(Math.abs(car.speed) * 3.6);
    hud.speedVal.textContent = String(kmh);
    hud.vehDamage.style.width = `${Math.round(car.damage)}%`;
    hud.radio.textContent = RADIO[car.radioStation ?? 0].name;
  };

  hud.setMission = (job, title, objective, distance) => {
    hud.mJob.textContent = `JOB ${String(job).padStart(2, '0')}`;
    hud.mTitle.textContent = title;
    hud.mObj.textContent = objective;
    hud.mDist.textContent = distance != null ? `${Math.round(distance)} m` : '-- m';
  };

  hud.setPolice = (police, visible) => {
    if (!police || police.wanted <= 0 || !visible) { hud.policePanel.classList.add('hidden'); return; }
    hud.policePanel.classList.remove('hidden');
    hud.policeLevel.textContent = `L${police.wanted}`;
    const rows = police.response.slice(0, 5);
    let html = '';
    for (const row of rows) {
      html += `<li class="${row.air ? 'air' : ''}"><span class="cs">${row.cs}</span><span class="tactic">${row.tactic}</span><span class="ds">${row.dist}m</span></li>`;
    }
    if (!rows.length) html = '<li><span class="cs">NO UNITS</span><span class="tactic">DISPATCHING</span><span class="ds">--</span></li>';
    hud.policeList.innerHTML = html;
  };

  hud.say = (who, line, seconds = 4) => {
    hud.subWho.textContent = who ?? '';
    hud.subLine.textContent = line;
    hud.subs.classList.remove('hidden');
    hud.subtitleTimer = seconds;
    hud.audioLine = line;
  };

  hud.clearSubtitle = () => { hud.subs.classList.add('hidden'); hud.subtitleTimer = 0; };

  hud.showToast = (text, big = false) => {
    const div = document.createElement('div');
    div.className = `toast${big ? ' big' : ''}`;
    div.textContent = text;
    hud.toasts.appendChild(div);
    hud.toastList.push({ div, life: big ? 3.4 : 2.4 });
    while (hud.toastList.length > 4) { const t = hud.toastList.shift(); t.div.remove(); }
  };

  hud.setReticle = (visible) => hud.reticle.classList.toggle('hidden', !visible);

  hud.setWheel = (open, selected) => {
    hud.wheel.classList.toggle('hidden', !open);
    const slots = hud.wheel.children;
    for (let i = 0; i < slots.length; i += 1) slots[i].classList.toggle('sel', i === selected);
  };

  hud.flashHurt = () => {
    hud.hurt.classList.add('on');
    clearTimeout(hud.hurtTimer);
    hud.hurtTimer = setTimeout(() => hud.hurt.classList.remove('on'), 220);
  };

  hud.tick = (dt) => {
    hud.updateCash(dt);
    if (hud.subtitleTimer > 0) {
      hud.subtitleTimer -= dt;
      if (hud.subtitleTimer <= 0) hud.clearSubtitle();
    }
    for (let i = hud.toastList.length - 1; i >= 0; i -= 1) {
      const t = hud.toastList[i];
      t.life -= dt;
      if (t.life <= 0) { t.div.remove(); hud.toastList.splice(i, 1); }
    }
  };

  return hud;
}

/** Full refresh of the bars, weapons and vehicle readout each frame, cheaply with cached values. */
export function updateHud(hud, world, dt) {
  const p = world.player;
  hud.setVitals(p);
  hud.setWeapon(WEAPONS[p.current], p.weapons[p.current]);
  hud.setVehicle(p.inVehicle ? world.playerCar : null);
  hud.setStars(world.police?.wanted ?? 0, world.police?.wanted > (hud.cache.lastWanted ?? 0));
  hud.cache.lastWanted = world.police?.wanted ?? 0;
  hud.setRespect(world.respect);
  hud.setPolice(world.police, world.police?.wanted > 0);
  hud.setReticle(p.aiming && !p.inVehicle);
  hud.drawMinimap(world);
  hud.tick(dt);
}
