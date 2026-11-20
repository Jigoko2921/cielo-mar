// The screens: the title (CONTINUE / NEW GAME / OPTIONS / SIDE JOBS), pause, the save slots, the
// options, the mission-complete and wasted cards, and the mission briefing. Each screen is plain
// DOM inside #screen, driven by the keyboard or mouse, and reports the chosen action back to the
// loop through a callback. The world keeps rendering behind dimmed overlays.

import { slotSummaries, hasAnySave } from './save.js';
import { STORY } from './missions.js';
import { RANKS } from './config.js';

export const SCREEN = {
  none: 'none',
  title: 'title',
  pause: 'pause',
  slots: 'slots',
  options: 'options',
  complete: 'complete',
  wasted: 'wasted',
  briefing: 'briefing',
  garage: 'garage',
};

export function createScreens(world) {
  const root = document.getElementById('screen');
  const screens = {
    root,
    active: SCREEN.none,
    index: 0,
    items: [],
    onClick: null,
    slotsMode: 'load',
    lastResult: null,
  };

  screens.show = (name) => {
    screens.active = name;
    root.classList.remove('hidden');
    root.classList.add('dim');
    screens.render();
  };
  screens.hide = () => {
    screens.active = SCREEN.none;
    root.classList.add('hidden');
    root.innerHTML = '';
    root.onclick = null;
  };

  screens.render = () => {
    switch (screens.active) {
      case SCREEN.title: return renderTitle(screens, world);
      case SCREEN.pause: return renderPause(screens, world);
      case SCREEN.slots: return renderSlots(screens, world);
      case SCREEN.options: return renderOptions(screens, world);
      case SCREEN.complete: return renderComplete(screens, world);
      case SCREEN.wasted: return renderWasted(screens, world);
      case SCREEN.briefing: return renderBriefing(screens, world);
      case SCREEN.garage: return renderGarage(screens, world);
      default: return undefined;
    }
  };

  screens.moveSelection = (delta) => {
    if (!screens.items.length) return;
    screens.index = (screens.index + delta + screens.items.length) % screens.items.length;
    screens.updateSelection();
  };

  screens.updateSelection = () => {
    const rows = root.querySelectorAll('[data-sel]');
    rows.forEach((row, i) => row.classList.toggle('sel', i === screens.index));
  };

  screens.activate = (i = screens.index) => {
    const item = screens.items[i];
    if (item && item.action) { world.audio?.play.ui?.(); item.action(); }
  };

  return screens;
}

function settings(world) {
  return world.settings ?? { music: 40, sfx: 70, invertY: false, subtitles: true };
}

function renderTitle(screens, world) {
  const root = screens.root;
  const mission = STORY[world.missions.index];
  const hasSave = hasAnySave();
  const s = settings(world);
  screens.items = [
    { label: hasSave ? 'Continue' : 'Continue  · no save', action: () => { if (hasSave) { world.loadAutosave(); } else { world.newGame(); } } },
    { label: 'New Game', action: () => world.newGame() },
    { label: 'Missions', action: () => world.openBriefing(world.missions.index) },
    { label: 'Options', action: () => screens.show('options') },
  ];
  screens.index = 0;
  const lines = screens.items.map((it, i) => `<div class="menu-item${i === 0 ? ' sel' : ''}" data-sel data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${it.label}</span></div>`).join('');
  root.innerHTML = `
    <div class="menu">
      <div class="logo">Cielo Mar<span>cielo mar</span></div>
      <div class="tag">A crime story on the Costa Dorada · Rafa Quintero</div>
      ${lines}
      <div class="menu-note">Golden hour, 1.6 km of coast. Traffic, police, eight jobs.<br>
      ${mission ? `Next: ${mission.title} · ${world.missions.index + 1} of ${STORY.length}` : 'All jobs complete. The city is yours.'} · Cash $${(world.cash ?? 0).toLocaleString('en-US')} · Music ${s.music}%</div>
      <div class="menu-foot">WASD move · Mouse look · F enter car · E interact · RMB aim · LMB fire · Tab wheel</div>
    </div>`;
  wireRows(screens);
}
function wireRows(screens) {
  screens.root.querySelectorAll('[data-sel]').forEach((row) => {
    row.addEventListener('mouseenter', () => { screens.index = Number(row.dataset.i ?? 0); screens.updateSelection(); });
    row.addEventListener('click', () => screens.activate(Number(row.dataset.i ?? 0)));
  });
}

function renderPause(screens, world) {
  const root = screens.root;
  const m = world.missions.current();
  screens.items = [
    { label: 'Resume', action: () => world.resume() },
    { label: 'Missions', action: () => world.openBriefing(world.missions.index) },
    { label: 'Save Game', action: () => { screens.slotsMode = 'save'; screens.show('slots'); } },
    { label: 'Load Game', action: () => { screens.slotsMode = 'load'; screens.show('slots'); } },
    { label: 'Options', action: () => screens.show('options') },
    { label: 'Quit to Title', action: () => world.toTitle() },
  ];
  screens.index = 0;
  const lines = screens.items.map((it, i) => `<div class="menu-item${i === 0 ? ' sel' : ''}" data-sel data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${it.label}</span></div>`).join('');
  root.innerHTML = `
    <div class="menu">
      <div class="kicker" style="font-family:var(--mono);color:var(--amber);letter-spacing:.3em;font-size:12px">PAUSED · ${world.city.districtNameAt(world.player.position.x, world.player.position.z).toUpperCase()}</div>
      <div class="logo" style="font-size:44px;margin:6px 0 14px">Cielo Mar</div>
      ${lines}
      <div class="menu-note">${m ? `Job ${world.missions.index + 1}: ${m.title}` : 'No active job'} · $${world.cash.toLocaleString('en-US')} · Respect ${Math.round(world.respect)}%</div>
    </div>`;
  wireRows(screens);
}

function renderSlots(screens, world) {
  const root = screens.root;
  const rows = slotSummaries();
  screens.items = [];
  const saving = screens.slotsMode === 'save';
  let html = `<div class="menu"><div class="logo" style="font-size:38px">${saving ? 'Save Game' : 'Load Game'}</div><div class="tag">A save is explicit. Autosave happens on mission complete.</div><div class="slots">`;
  rows.forEach((row, i) => {
    const label = row.slot === 'autosave' ? 'Autosave' : `Slot ${row.slot.replace('slot', '')}`;
    const desc = row.summary ? `Job ${row.summary.missionIndex + 1} · $${row.summary.cash.toLocaleString('en-US')} · ${row.summary.district}` : '— empty —';
    if (row.slot !== 'autosave' || !saving) {
      screens.items.push({ slot: row.slot, action: () => { if (saving) world.saveToSlot(row.slot); else world.loadFromSlot(row.slot); screens.show(saving ? 'pause' : 'pause'); } });
    }
    html += `<div class="slot-row" data-sel data-i="${screens.items.length - 1}"><span><span class="sl">${label}</span> · ${desc}</span><span>${row.summary ? new Date(row.summary.savedAt).toLocaleTimeString() : ''}</span></div>`;
  });
  html += `</div><div class="menu-foot">Esc back</div></div>`;
  root.innerHTML = html;
  screens.index = 0;
  wireRows(screens);
}

function renderOptions(screens, world) {
  const root = screens.root;
  const s = settings(world);
  screens.items = [
    { action: () => { s.music = (s.music + 10) % 110; applySettings(world); screens.render(); } },
    { action: () => { s.sfx = (s.sfx + 10) % 110; applySettings(world); screens.render(); } },
    { action: () => { s.invertY = !s.invertY; applySettings(world); screens.render(); } },
    { action: () => { s.subtitles = !s.subtitles; applySettings(world); screens.render(); } },
    { action: () => screens.show(world.state === 'paused' ? 'pause' : 'title') },
  ];
  const rows = [
    ['Music', `${s.music}%`],
    ['Effects', `${s.sfx}%`],
    ['Invert look', s.invertY ? 'On' : 'Off'],
    ['Subtitles', s.subtitles ? 'On' : 'Off'],
    ['Back', ''],
  ];
  const html = rows.map((r, i) => `<div class="opt${i === 0 ? ' sel' : ''}" data-sel data-i="${i}"><span>${r[0]}</span><span class="val">${r[1]}</span></div>`).join('');
  root.innerHTML = `<div class="menu"><div class="logo" style="font-size:38px">Options</div><div class="tag">Sound is all synthesised. Nothing is downloaded.</div><div class="slots">${html}</div></div>`;
  screens.index = 0;
  wireRows(screens);
}

function applySettings(world) {
  const s = settings(world);
  world.audio?.setMusicVolume?.(s.music / 100);
  world.audio?.setVolume?.(s.sfx / 100);
  world.settings = s;
}

function renderBriefing(screens, world) {
  const root = screens.root;
  const m = STORY[world.missions.index];
  screens.items = m ? [
    { label: 'Begin', action: () => { world.startMission(); } },
    { label: 'Back', action: () => screens.show(world.state === 'paused' ? 'pause' : 'title') },
  ] : [{ label: 'Back', action: () => screens.show('title') }];
  const lines = screens.items.map((it, i) => `<div class="menu-item${i === 0 ? ' sel' : ''}" data-sel data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${it.label}</span></div>`).join('');
  if (!m) {
    root.innerHTML = `<div class="menu"><div class="logo" style="font-size:40px">Jobs</div><div class="tag">All eight are done. The city remembers.</div>${lines}</div>`;
    wireRows(screens);
    return;
  }
  const done = world.missions.index > 0 ? STORY.slice(0, world.missions.index).map((s) => `<li>${s.title}</li>`).join('') : '<li>None yet.</li>';
  root.innerHTML = `
    <div class="menu">
      <div class="kicker" style="font-family:var(--mono);color:var(--amber);letter-spacing:.3em;font-size:12px">JOB ${String(world.missions.index + 1).padStart(2, '0')} · ${m.giver.toUpperCase()}</div>
      <div class="logo" style="font-size:44px;margin:6px 0 8px">${m.title}</div>
      <div class="tag" style="text-transform:none;letter-spacing:.02em;font-size:14px;color:#e8ddc8">${m.brief}</div>
      <div class="menu-note" style="color:var(--cream)">Steps:<br>${m.steps.map((st, i) => `${i + 1}. ${st.objective}`).join('<br>')}</div>
      <div class="menu-note">Reward: $${m.reward.toLocaleString('en-US')} · Prior jobs: <ul style="margin:4px 0 0 18px;color:#9fb4b0">${done}</ul></div>
      ${lines}
    </div>`;
  wireRows(screens);
}

function renderComplete(screens, world) {
  const root = screens.root;
  const r = world.lastMissionResult ?? { title: 'Mission', payout: 0 };
  screens.items = [
    { label: 'Continue', action: () => world.resume() },
    { label: 'View Map', action: () => world.resume() },
  ];
  root.innerHTML = `
    <div class="menu bigcard">
      <div class="kicker">Mission Passed</div>
      <h1>${r.title.toUpperCase()}</h1>
      <div class="sub">Payout $${(r.payout ?? 0).toLocaleString('en-US')} · Respect ${Math.round(world.respect)}% · Rank ${rankName(world.respect)}</div>
      <div class="btn sel" data-sel data-i="0">Continue</div>
    </div>`;
  screens.items = [{ action: () => world.resume() }];
  wireRows(screens);
}

function renderWasted(screens, world) {
  const rootEl = screens.root;
  screens.items = [{ action: () => { if (screens.respawn) screens.respawn(); } }];
  rootEl.innerHTML = `
    <div class="menu bigcard" style="filter:saturate(.6)">
      <div class="kicker" style="color:var(--danger)">${screens.wastedReason ?? 'You were wasted.'}</div>
      <h1 style="color:var(--danger)">WASTED</h1>
      <div class="sub">Hospital fee $250 · respawning at the safehouse</div>
      <div class="btn" data-sel data-i="0">Continue</div>
    </div>`;
  wireRows(screens);
}

function renderGarage(screens, world) {
  const root = screens.root;
  const items = [
    ['Repair vehicle', '$350', 'repair'],
    ['Bulletproof vest', '$400', 'armour'],
    ['Extended magazines', '$1200', 'mag'],
    ['Tuned barrels', '$900', 'spread'],
    ['Respray', '$600', 'respray'],
    ['Pay-and-spray (clear heat)', '$600', 'pay-spray'],
    ['Leave', '', 'leave'],
  ];
  screens.items = items.map(([label, , id]) => ({
    id,
    action: () => {
      if (id === 'leave') { world.resume(); return; }
      const result = world.garagePurchase(id);
      world.hud.showToast(result);
      screens.render();
    },
  }));
  const html = items.map(([label, price, id], i) => `<div class="opt${i === 0 ? ' sel' : ''}" data-sel data-i="${i}"><span>${label}</span><span class="val">${price}</span></div>`).join('');
  root.innerHTML = `<div class="menu"><div class="logo" style="font-size:34px">Taller Sánchez</div><div class="tag">Cash $${world.cash.toLocaleString('en-US')} · ${rankName(world.respect)}</div><div class="slots">${html}</div><div class="menu-foot">Esc leave</div></div>`;
  screens.index = 0;
  wireRows(screens);
}

function rankName(respect) {
  let name = RANKS[0].name;
  for (const r of RANKS) if (respect >= r.at) name = r.name;
  return name;
}
