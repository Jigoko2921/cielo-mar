# CIELO MAR

An original open-world crime game that runs in a desktop browser from its own files.
No network, no build step, no borrowed assets — a sun-soaked coastal city, its own
characters, its own story.

[![Make GTA 6 entry](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Jigoko2921/cielo-mar/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Jigoko2921/cielo-mar/reward.svg)](https://make.fun/bounty/gta6-01)

## Play

```
node serve.ts        # serves game/ at http://localhost:8080
```

WASD to move, mouse to look, F to enter or leave a car, E to interact, Shift to sprint,
Space to jump or handbrake, right mouse to aim, left mouse to fire, R to reload,
Tab for the weapon wheel, Esc to pause.

## Structure

- `game/` — the game itself: `index.html`, ES modules under `game/src/`, three.js under `game/vendor/`
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output and writes `dossier.json`
- `screenshots/` — four real renders of the game
- `BRIEF.md` — the design brief the build follows
