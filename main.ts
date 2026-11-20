// CIELO MAR — a third-person open-world crime game in a sun-soaked coastal city: a city you
// cross on foot and by car, traffic and pedestrians, a five-star police response, eight story
// missions, combat, a live minimap and a save. Original everywhere: city, people, cars, story,
// art and sound; plain static files under game/ with three.js vendored and nothing on the wire.
//
// This program is only the plumbing a browser cannot do: it copies game/ and screenshots/ beside
// itself into /output and writes /output/dossier.json, the summary the judge reads. Serve the game
// locally with `node serve.ts` and open http://localhost:8080. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps (reference/gate.json): text_max_bytes shapes the bytes; the rest only refuse
// an entry the scorer would refuse. The dossier is rebuilt by the gate from game/ and compared.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
