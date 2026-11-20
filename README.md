# CIELO MAR

An original open-world crime game for the desktop browser: a sun-soaked coastal city you cross on foot and by car, with traffic, pedestrians, a five-star police response, eight story missions, combat, a live minimap and a save. Everything in it is original — city, characters, vehicles, story, art and sound — and it runs from static files with no network request.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Jigoko2921/cielo-mar/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Jigoko2921/cielo-mar/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

## Play

```
node serve.ts
```

Then open http://localhost:8080. WASD moves, the mouse looks, F enters a car, E interacts, right mouse aims, left mouse fires, R reloads, Tab opens the weapon wheel, Esc pauses.

## Structure

- `game/` — the game: `index.html`, ES modules under `game/src/`, three.js under `game/vendor/`
- `main.ts` — the entry program, which copies `game/` and `screenshots/` to the output and writes `dossier.json`
- `screenshots/` — real renders of the game
