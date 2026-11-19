# CIELO MAR — design brief

Read this whole file before writing code. It is the design the build must reach. Follow it
closely: the judge scores completeness, depth, feel, look and source structure, in that order,
and it sees the game mostly through four screenshots and a short outline of the source.

## 1. What is being built

A third-person open-world crime game in the spirit of a modern coastal-city crime saga, running
in desktop Chrome from static files under `game/`, with no network request of any kind. The city
is **Cielo Mar**, a fictional sun-soaked Latin-American coastal metropolis. Everything is
original: city, districts, characters, vehicles, factions, story, art, sound and music. Never use
a name, logo, character, map, vehicle or piece of music from any commercial game.

The game is played with keyboard and mouse, has a start screen, a save, and a story of eight
missions that can be played from beginning to end.

## 2. Non-negotiable technical constraints

- `game/index.html` opens from any static server and plays offline. Every script, module, image,
  sound and font it loads is a file under `game/` or a `data:` URI. No `http`/`https` URL anywhere
  in the HTML or in any module the page reaches. No fetch, no XHR, no external font.
- `game/vendor/three.min.js` is the vendored library and must not be edited. It is loaded by a
  classic `<script src="./vendor/three.min.js"></script>` before the module entry, so modules use
  the global `THREE`. Do not import it as a module.
- All game code is native ES modules under `game/src/`, imported with relative paths from
  `game/src/main.js`. Everything must parse as an ES module.
- No build step, no bundler, no TypeScript in `game/`, no source maps. Plain `.js` and `.css` only.
- Budget: 993 files and 48 MiB under `game/` in total, `index.html` at most 1 MiB. Stay far under.
- Every file must be your own writing. Do not paste a library, a tutorial dump or a template.
- Deterministic: the same seed must produce the same city and the same traffic.
- Must run at 30+ fps at 1280x720 with the full city, traffic, pedestrians and police active.

## 3. Art direction — hold this line everywhere

Golden hour on a Mediterranean-Caribbean coast: warm cream and terracotta facades, deep
turquoise water, long amber shadows, a hazy apricot sky. High contrast, saturated but not
candy. Think film still, not toy.

- Palette: sky `#f7c98b` to `#7fb7c9`, haze `#e8c9a0`, sea `#2f8f9d` / `#1d6b78`,
  sand `#e6d3ae`, terracotta `#b4593c`, cream `#efe2c8`, foliage `#3f6b4a`,
  asphalt `#3a3a3c`, accent amber `#ffb347`, accent turquoise `#35d0c0`, danger `#e4572e`.
- Sun low in the west, warm directional light, cool blue shadows, mild exponential fog so far
  buildings dissolve into haze. No bloom pass — fake the glow with additive sprites only where
  it is cheap.
- Buildings: flat-shaded boxes with inset window strips, balconies, rooftop water tanks and
  awnings; varied heights per district; no textures at all — use vertex colours, emissive window
  materials and small geometric detail. This keeps the download tiny and the look coherent.
- No purple gradient UI. No emoji in the game UI. No rounded white cards.
- UI type: system stack with condensed uppercase headings (`Oswald`, `Impact`, `Arial Narrow`
  fallbacks), monospaced numerals for money and ammo. Angular clip-path panels, 1px rules,
  letter-spaced labels, dark translucent charcoal `rgba(16,18,20,0.82)`.

## 4. The city

A grid of districts on a coastal plain, about 1.6 km x 1.6 km, bounded by hills to the north and
the sea to the south. Road network is a grid with a diagonal boulevard; blocks are 60-90 m with
sidewalks, palms, street lamps, benches and parked cars.

Districts (each with its own height, colour and props):
1. **Marina Verde** — beachfront hotels, promenade, palms, beach umbrellas, pier.
2. **Centro Viejo** — low colonial blocks, arcades, plaza with a fountain, cathedral tower.
3. **Puerto Azul** — docks, container stacks, cranes, warehouses, chain-link fences.
4. **Las Palmas** — hillside villas, gates, pools, winding road, the Coronel's estate.
5. **Zona Norte** — industrial yards, silos, rail sidings, scrap heaps.
6. **La Ciénaga** — dense low-rise barrio, murals, laundry lines, taco stands.

Landmarks that must exist and be visible: the cathedral tower in Centro Viejo, the pier and
lighthouse at Marina Verde, two gantry cranes at Puerto Azul, the hill villa in Las Palmas,
a stadium ring in Zona Norte, and the ocean horizon.

Vehicles: 8 original models built from boxes and wedges — a muscle coupe (`Vela GT`), a sedan
(`Brisa 4`), a pickup (`Mulo`), a van (`Panera`), a taxi (`Amarillo`), a police cruiser
(`PCM Unidad`), a police SUV (`PCM Fuerte`), and a speedboat at the marina. Each has a colour
palette, working headlights/brake lights and an engine sound.

## 5. Systems

**On foot.** WASD relative to camera, mouse look with pointer lock, sprint (Shift, stamina),
jump (Space), crouch (C), cover-lean is not required. Capsule collision against buildings,
kerbs, props and vehicles. Third-person camera behind the shoulder with mouse orbit, gentle
spring, collision pull-in, and a slight FOV kick when sprinting.

**Combat.** Four weapons: fists, `Pistola` (12 rounds), `Subfusil` (30), `Escopeta` (8).
Hitscan with tracers, muzzle flash sprite, impact sparks, shell casings, recoil and camera
shake. Right mouse aims (tighter spread, closer camera), left fires, R reloads, 1-4 or Tab
opens the weapon wheel. Player has health and armour bars; health regenerates only out of
combat after 8 seconds and only to the nearest third. Death fades to a "wasted" card and
respawns at the nearest safehouse with a hospital fee.

**Vehicles.** Arcade physics on a flat plane: engine force, rolling drag, steering that scales
with speed, handbrake drift with lateral slip, suspension bob, body roll and pitch, wheel
rotation. Damage accumulates from impacts; smoke then fire then explosion. Enter and exit with
F near a car, steal parked and occupied cars (the driver flees), radio with R while driving.
The camera pulls back and up with speed. Hitting a pedestrian knocks them down.

**Traffic.** Cars spawn on the road graph out of view, follow lane centrelines, slow for
corners, stop for the player and for each other, honk when blocked, and despawn behind the
player. At night their headlights are on.

**Pedestrians.** Walk the sidewalks in both directions, idle at benches and stands, cross at
corners, flee from gunfire, crashes and speeding cars, and react to the player aiming at them.
A crowd density that stays believable without tanking the frame rate.

**Police and wanted level.** Five stars. Star 1-2: patrol cruisers investigate and pursue on
sight. Star 3: roadblocks and two cruisers. Star 4: a helicopter with a searchlight and
SUV units. Star 5: aggressive pursuit, ramming and spike strips. Police use line-of-sight,
a last-known-position search, and give up after the player breaks sight for long enough while
outside the search radius. Crimes that raise heat: assault, gunfire, carjacking, hitting an
officer, destroying a cruiser. Pay-and-spray at a garage in Centro Viejo clears the level for
a fee.

**Missions and story.** Eight missions, each with a cinematic-free but clear briefing card,
objective markers, waypoints on the minimap, dialogue subtitles, fail conditions and a reward.
Progress unlocks the next mission. Missions:
1. *El Primer Vuelo* — steal the Vela GT from the Marina Verde hotel lot and deliver it to Puerto Azul.
2. *Pan Comido* — chase and ram a fleeing courier through Centro Viejo, then take his case.
3. *La Deuda* — collect three debts around La Ciénaga; the third turns into a shootout.
4. *Ruta Nocturna* — drive a van of contraband to the pier while two stars of police hunt you; lose them.
5. *El Soplón* — tail an informant to a motel in Zona Norte without being spotted, then silence him.
6. *Tormenta* — assault the Puerto Azul warehouse: three waves of guards, then escape by boat.
7. *Traición* — a meet in Las Palmas is a trap; fight out and lose a four-star pursuit.
8. *Cielo Cayendo* — assault the Coronel's villa, chase him to the airstrip, and end it on the runway.

Story voice: terse, dry, Latin-American noir. Protagonist **Rafa Quintero**, a wheelman who
came home to bury his father; his sister **Inés** runs a food cart in La Ciénaga; his crew is
**Tavo** (a jumpy fixer) and **La Sirena** (a smuggler with a boat). The antagonist is
**Coronel Vidal Márquez** of the Policía Costera Municipal. Mission dialogue is 3-6 lines
per beat, subtitles at the bottom of the screen, speaker name in amber caps.

**Progression.** Cash from missions, robberies and side jobs. Spend it at the garage on repairs,
armour, weapon upgrades (extended mag, better spread) and two car resprays. A respect meter
rises with missions and raises mission payouts. Side activities: timed delivery runs (marked
with a yellow van icon), and a street race along the boulevard at night.

**HUD.** Bottom-left: circular minimap rendered on a 2D canvas — roads, blocks, water, a north
marker, the player arrow, mission waypoint, police blips and a search radius ring. Bottom-right:
weapon icon, ammo in mono numerals, health and armour bars. Top-right: cash with a slow count-up
animation, and the five wanted stars that flash while the level is rising. Top-left: a compact
mission card with the objective and a distance in metres. Centre-bottom: subtitles. Transient
toasts for pickups and mission results.

**Audio.** All synthesised with the Web Audio API — no audio files. Engine loop pitched to speed,
siren with a two-tone sweep, gunshots from filtered noise bursts, footsteps, UI clicks, gulls,
surf, and a three-station radio of simple sequenced synth loops (a bolero-ish station, a
synthwave station, a news/talk station with a filtered voice-like formant). Music must duck
under dialogue.

**Save.** `localStorage` keeps three slots plus an autosave: mission index, cash, respect,
weapons and ammo, health and armour, the player's position and the current vehicle. A "Continue"
entry on the title screen loads the autosave. Saving is explicit at a safehouse and automatic
on mission complete.

## 6. Screenshot mode — this decides the score

The judge sees a contact sheet first: the cover large and three small ones beneath. Every
screenshot must show several systems at once and stay legible when shrunk to a third.

Implement `?shot=<mode>&seed=<n>` which boots straight into a deterministic staged scene, hides
the cursor, pauses the simulation at a chosen frame and sets `window.__shotReady = true` once the
frame is drawn. Modes:

- `cover` — third-person on foot on the Marina Verde promenade at golden hour: palms, traffic on
  the boulevard, pedestrians on the sidewalk, a mission marker ahead, the full HUD with three
  wanted stars, minimap, cash and objective card.
- `chase` — behind the wheel of the Vela GT at speed on the coastal boulevard, two PCM cruisers
  close behind with lights, the helicopter above with its searchlight, four wanted stars, the
  minimap full of police blips, speed readout.
- `shootout` — at the Puerto Azul warehouse: muzzle flash, tracers, two guards down, containers
  and cranes behind, ammo and armour on the HUD, objective "Eliminate the guards 3/6".
- `title` — the title screen over a slow aerial shot of the skyline at sunset, with the game's
  logo, "CONTINUE / NEW GAME / OPTIONS" and a small mission-count line.

The staged scenes must be the real systems running, not painted mock-ups.

## 7. File layout — one clear job per file

```
game/index.html          markup, CSS for the HUD frame, canvas
game/src/config.js       tunables, palette, district and vehicle tables
game/src/input.js        keyboard, mouse, pointer lock
game/src/audio.js        Web Audio synthesis: engine, siren, guns, radio, ambience
game/src/city.js         city generation: districts, roads, buildings, props, colliders
game/src/render.js       renderer, lights, sky, fog, camera rig, particles
game/src/player.js       on-foot movement, camera, weapons, combat, health
game/src/vehicles.js     car physics, damage, traffic AI, carjacking
game/src/peds.js         pedestrian simulation and crowd reactions
game/src/police.js       wanted level, officer AI, helicopter, roadblocks
game/src/missions.js     the eight missions, objectives, dialogue, progression
game/src/hud.js          minimap canvas, stars, bars, money, subtitles, toasts
game/src/screens.js      title, pause, save slots, options, mission results
game/src/save.js         localStorage serialisation
game/src/main.js         boot, game loop, state machine, wiring
game/src/shots.js        deterministic ?shot= staging
```

Name functions for what they do (`spawnTraffic`, `raiseWanted`, `drawMinimap`, `stealVehicle`).
The judge reads the outline of names, so the names must tell the story of the game.

## 8. Build order and quality bar

1. `main.ts` first: add a short header comment naming the game and tighten the output copy so the
   entrypoint carries your own lines.
2. `config.js`, `input.js`, `render.js`, `city.js` — get a driveable camera over a lit city.
3. `player.js`, `vehicles.js`, `peds.js` — movement, driving, traffic, crowd.
4. `police.js`, `hud.js` — wanted level and the full HUD.
5. `missions.js`, `screens.js`, `save.js`, `audio.js` — story, menus, sound.
6. `shots.js` last, and only after the modes look right in a real screenshot.

Test as you go: serve `game/` with `node serve.ts`, open a shot URL in headless Chrome, and read
the DOM. `main.js` must catch `window.onerror` and `unhandledrejection`, set
`document.title = 'ERR ' + message`, and draw the message into `#status`, so a headless dump
shows a failure instead of a blank canvas. Fix every error before moving on. Check the frame
rate and keep the draw calls low by merging static geometry per district.

Write the file, run it, then improve it: at least one file must be revised in a later step, and
`main.ts` must carry your own authored lines.
