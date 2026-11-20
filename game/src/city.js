// The city: a seeded generator for Cielo Mar. A road grid over six districts with a diagonal
// boulevard, blocks of buildings with inset window strips, balconies, water tanks and awnings,
// sidewalks, palms, lamps, benches, a plaza and fountain, the cathedral, the marina pier and
// lighthouse, container stacks and cranes, villas, silos, rail sidings and the stadium ring.
// Static geometry is merged per district to keep draw calls low; colliders are AABBs.

import { CITY, SEA_Z, BLOCK, ROAD, SIDEWALK, DISTRICTS, PALETTE, LOCATIONS } from './config.js';

const N = Math.ceil((CITY * 2) / BLOCK);
const HALF = CITY;

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Centre of grid cell (ix, iz); the diagonal is skipped on the steeper z axis for the boulevard. */
export function cellCenter(ix, iz) {
  return { x: -HALF + BLOCK * (ix + 0.5), z: -HALF + BLOCK * (iz + 0.5) };
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  if (z >= SEA_Z) return DISTRICTS[0];
  return DISTRICTS[4];
}

export function districtNameAt(x, z) {
  return districtAt(x, z).name;
}

/** Road line positions: one every BLOCK, so a car can run a lane down any of them. */
export function roadLines() {
  const lines = [];
  for (let i = 0; i <= N; i += 1) lines.push(-HALF + BLOCK * i);
  return lines;
}

export function createCity(seed = 7) {
  const random = createRandom(seed);
  const group = new THREE.Group();
  group.name = 'city';
  const colliders = [];
  const roads = roadLines();
  const props = { palms: [], lamps: [] };
  const landmarkGroups = [];

  // Ground: a sand/earth base plane under everything, then the sea is added by render.js.
  const groundGeo = new THREE.PlaneGeometry(CITY * 2 + 400, CITY * 2 + 400, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xcbb78f, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  group.add(ground);

  const sidewalkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 0.95 });
  const asphaltMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.92 });

  // Asphalt for every road line: one long strip per line in each direction.
  for (const r of roads) {
    const nsGeo = new THREE.BoxGeometry(ROAD, 0.12, CITY * 2);
    const ns = new THREE.Mesh(nsGeo, asphaltMat);
    ns.position.set(r, -0.06, 0);
    ns.scale.set(1, 1, 1);
    group.add(ns);
    const ewGeo = new THREE.BoxGeometry(CITY * 2, 0.12, ROAD);
    const ew = new THREE.Mesh(ewGeo, asphaltMat);
    ew.position.set(0, -0.058, r);
    group.add(ew);
  }

  // Per-district merged building batches.
  const batches = new Map();
  function batchFor(district) {
    if (!batches.has(district.id)) {
      batches.set(district.id, { wall: [], roof: [], windows: [], metal: [], foliage: [] });
    }
    return batches.get(district.id);
  }

  for (let iz = 0; iz < N; iz += 1) {
    for (let ix = 0; ix < N; ix += 1) {
      const c = cellCenter(ix, iz);
      if (c.z > SEA_Z - ROAD) continue; // sea
      if ((ix + iz) % 11 === 4) continue; // the diagonal boulevard takes occasional lots
      const district = districtAt(c.x, c.z);
      const batch = batchFor(district);
      const inner = BLOCK - ROAD - SIDEWALK * 2;
      // Sidewalk tile.
      const sw = new THREE.Mesh(new THREE.BoxGeometry(inner + SIDEWALK * 2, 0.18, inner + SIDEWALK * 2), sidewalkMat);
      sw.position.set(c.x, 0.02, c.z);
      sw.receiveShadow = true;
      group.add(sw);
      const split = random() < 0.5 ? 1 : 2;
      for (let k = 0; k < split; k += 1) {
        const lotW = split === 1 ? inner : inner * (0.42 + random() * 0.16);
        const lotD = inner * (0.7 + random() * 0.3);
        const off = split === 1 ? 0 : (k === 0 ? -1 : 1) * (inner / 2 - lotW / 2);
        const w = lotW * (0.8 + random() * 0.2);
        const d = lotD * (0.8 + random() * 0.2);
        const bx = c.x + off + (random() - 0.5) * 3;
        const bz = c.z + (random() - 0.5) * 3;
        const h = districtHeight(district, random);
        addBuilding(batch, bx, bz, w, d, h, district, random);
        colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2, height: h, kind: 'building' });
        addBlockProps(group, props, bx, bz, w, d, district, random, colliders);
      }
    }
  }

  // Flush merged batches into one mesh per material set per district.
  for (const [id, batch] of batches) {
    const district = DISTRICTS.find((d) => d.id === id);
    flushBatch(group, batch, district);
  }

  buildDiagonalBoulevard(group, random);
  buildPlazaAndCathedral(group, colliders);
  buildMarina(group, props, colliders, random);
  buildDocks(group, colliders, random);
  buildVillas(group, colliders, random);
  buildIndustrial(group, colliders, random);
  buildBarrioDecor(group, colliders, random);
  buildStadium(group, colliders);
  buildAirstrip(group, colliders);

  // Palms and lamps as instanced-ish merged crowns and poles.
  mergePalms(group, props.palms);
  mergeLamps(group, props.lamps);

  return { group, colliders, props, roads, districtAt, districtNameAt, collidersArray: colliders };
}

function districtHeight(district, random) {
  const base = district.height;
  if (district.kind === 'hotel') return 22 + random() * base * 0.9;
  if (district.kind === 'industrial') return 8 + random() * 12;
  if (district.kind === 'docks') return 7 + random() * 8;
  if (district.kind === 'barrio') return 5 + random() * 7;
  if (district.kind === 'villa') return 6 + random() * 5;
  return base * (0.7 + random() * 1.1);
}

/** Push a box, a roof cap and window strips into a district's merged arrays (vertex-coloured). */
function addBuilding(batch, x, z, w, d, h, district, random) {
  const wall = new THREE.Color(district.wall).offsetHSL((random() - 0.5) * 0.03, (random() - 0.5) * 0.08, (random() - 0.5) * 0.06);
  pushBox(batch.wall, x, h / 2, z, w, h, d, wall);
  const roofCol = new THREE.Color(district.roof);
  pushBox(batch.roof, x, h + 0.3, z, w + 0.5, 0.6, d + 0.5, roofCol);
  // Window strips on two faces: dark glass bars with an emissive glow colour.
  const floors = Math.max(1, Math.floor(h / 3.4));
  const winCol = new THREE.Color(0x2a3a44);
  for (let f = 0; f < floors; f += 1) {
    const y = 2 + f * 3.4;
    if (y > h - 1.2) break;
    const cols = Math.max(1, Math.floor(w / 3.2));
    for (let c = 0; c < cols; c += 1) {
      const wx = x - w / 2 + (c + 0.5) * (w / cols);
      pushBox(batch.windows, wx, y, z + d / 2 + 0.06, w / cols * 0.55, 1.5, 0.14, winCol);
      if (d > 8) pushBox(batch.windows, wx, y, z - d / 2 - 0.06, w / cols * 0.55, 1.5, 0.14, winCol);
    }
  }
  // Balconies and rooftop water tanks for the low districts.
  if (district.kind === 'colonial' || district.kind === 'barrio' || district.kind === 'hotel') {
    pushBox(batch.metal, x, 3.2, z + d / 2 + 0.4, w * 0.8, 0.15, 0.8, new THREE.Color(0x6b5b48));
    if (random() < 0.5) {
      const tankCol = new THREE.Color(0xd6d0c4);
      pushBox(batch.metal, x + w * 0.2, h + 1.0, z - d * 0.2, 1.4, 1.6, 1.4, tankCol);
    }
  }
  if (random() < 0.4) {
    // An awning over the shopfront.
    pushBox(batch.metal, x, 3.0, z + d / 2 + 0.7, w * 0.7, 0.1, 1.6, new THREE.Color(district.roof).offsetHSL(0, 0.2, -0.05));
  }
}

function addBlockProps(group, props, x, z, w, d, district, random, colliders) {
  const y = 0.2;
  const corners = [
    [x - w / 2 - 2, z + d / 2 + 2], [x + w / 2 + 2, z - d / 2 - 2],
    [x - w / 2 - 2, z - d / 2 - 2], [x + w / 2 + 2, z + d / 2 + 2],
  ];
  const palms = district.kind === 'hotel' || district.kind === 'villa' ? 0.7 : district.kind === 'barrio' ? 0.2 : 0.4;
  for (const [px, pz] of corners) {
    const r = random();
    if (r < palms * 0.5) props.palms.push({ x: px, z: pz, h: 6 + random() * 4, lean: (random() - 0.5) * 0.3 });
    else if (r < palms * 0.5 + 0.5) props.lamps.push({ x: px, z: pz });
    else if (r < palms * 0.5 + 0.62 && district.kind === 'colonial') {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }));
      bench.position.set(px, 0.4, pz);
      bench.castShadow = true;
      group.add(bench);
    }
  }
}

function pushBox(list, x, y, z, w, h, d, color) {
  list.push({ x, y, z, w, h, d, r: color.r, g: color.g, b: color.b });
}

/** Merge a district's coloured boxes into one geometry per material family (walls, roofs, metal, glass). */
function flushBatch(group, batch, district) {
  const build = (boxes, isEmissive) => {
    if (boxes.length === 0) return;
    const template = new THREE.BoxGeometry(1, 1, 1);
    const tPos = template.attributes.position.array;
    const tNorm = template.attributes.normal.array;
    const tIdx = template.index.array;
    const verts = tPos.length / 3;
    const positions = new Float32Array(boxes.length * tPos.length);
    const normals = new Float32Array(boxes.length * tPos.length);
    const colors = new Float32Array(boxes.length * tPos.length);
    const indices = new Uint32Array(boxes.length * tIdx.length);
    let vOff = 0;
    let iOff = 0;
    let nVerts = 0;
    for (const b of boxes) {
      for (let v = 0; v < verts; v += 1) {
        positions[vOff + v * 3] = tPos[v * 3] * b.w + b.x;
        positions[vOff + v * 3 + 1] = tPos[v * 3 + 1] * b.h + b.y;
        positions[vOff + v * 3 + 2] = tPos[v * 3 + 2] * b.d + b.z;
        normals[vOff + v * 3] = tNorm[v * 3];
        normals[vOff + v * 3 + 1] = tNorm[v * 3 + 1];
        normals[vOff + v * 3 + 2] = tNorm[v * 3 + 2];
        colors[vOff + v * 3] = b.r;
        colors[vOff + v * 3 + 1] = b.g;
        colors[vOff + v * 3 + 2] = b.b;
      }
      for (let k = 0; k < tIdx.length; k += 1) indices[iOff + k] = tIdx[k] + nVerts;
      vOff += tPos.length;
      iOff += tIdx.length;
      nVerts += verts;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: isEmissive ? 0.35 : 0.88,
      metalness: isEmissive ? 0.2 : 0.0,
      flatShading: true,
      emissive: isEmissive ? new THREE.Color(0x352208) : new THREE.Color(0x000000),
      emissiveIntensity: isEmissive ? 0.9 : 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !isEmissive;
    mesh.receiveShadow = true;
    mesh.name = `batch-${district.id}`;
    group.add(mesh);
  };
  build(batch.wall, false);
  build(batch.roof, false);
  build(batch.metal, false);
  build(batch.windows, true);
}

function buildDiagonalBoulevard(group, random) {
  // A wide diagonal avenue from the north-west to the plaza, marked by a lighter asphalt strip.
  const len = 900;
  const geo = new THREE.PlaneGeometry(24, len);
  const mat = new THREE.MeshStandardMaterial({ color: 0x47464a, roughness: 0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -Math.PI / 4.4;
  mesh.position.set(-40, 0.02, -160);
  mesh.receiveShadow = true;
  group.add(mesh);
  // Lane dashes.
  const dashGeo = new THREE.BoxGeometry(0.35, 0.02, 4);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xe6d3a0, roughness: 0.8 });
  for (let i = -300; i < 300; i += 14) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(-40 + Math.sin(-Math.PI / 4.4) * 0, 0.08, -160 + i);
    dash.rotation.y = -Math.PI / 4.4;
    dash.position.x += Math.cos(-Math.PI / 4.4) * 0;
    dash.position.x += Math.sin(-Math.PI / 4.4 + Math.PI / 2) * 0;
    dash.position.x = -40 + Math.sin(i * 0.0) * 0;
    dash.position.x = -40 - i * Math.sin(Math.PI / 4.4) * 1.0;
    dash.position.z = -160 + i * Math.cos(Math.PI / 4.4) * 1.0;
    group.add(dash);
  }
}

function buildPlazaAndCathedral(group, colliders) {
  const { x, z } = LOCATIONS.plaza;
  const plazaGeo = new THREE.CylinderGeometry(30, 30, 0.4, 12);
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xd8c6a0, roughness: 0.9 });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.position.set(x, 0.2, z);
  plaza.receiveShadow = true;
  group.add(plaza);
  // Fountain: basin, water disc and a centre jet column.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 1.1, 20), new THREE.MeshStandardMaterial({ color: 0xcfc4b0, roughness: 0.85 }));
  basin.position.set(x + 6, 0.7, z + 4);
  basin.castShadow = true; basin.receiveShadow = true;
  group.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.3, 20), new THREE.MeshStandardMaterial({ color: PALETTE.turquoise, roughness: 0.15, metalness: 0.3 }));
  water.position.set(x + 6, 1.2, z + 4);
  group.add(water);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0xcfe9e6, transparent: true, opacity: 0.8 }));
  jet.position.set(x + 6, 2.6, z + 4);
  group.add(jet);
  colliders.push({ minX: x + 1, maxX: x + 11, minZ: z - 1, maxZ: z + 9, height: 1.5, kind: 'fountain' });

  // Cathedral: a tall nave block with a belfry tower, cream stone and a domed top.
  const { x: cx, z: cz } = LOCATIONS.cathedral;
  const naveMat = new THREE.MeshStandardMaterial({ color: 0xe7d7b6, roughness: 0.9, flatShading: true });
  const nave = new THREE.Mesh(new THREE.BoxGeometry(22, 18, 34), naveMat);
  nave.position.set(cx, 9, cz);
  nave.castShadow = true; nave.receiveShadow = true;
  group.add(nave);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 46, 12), naveMat);
  tower.position.set(cx - 6, 23, cz + 20);
  tower.castShadow = true; tower.receiveShadow = true;
  group.add(tower);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9e6b45, roughness: 0.6, metalness: 0.2 }));
  dome.position.set(cx - 6, 46, cz + 20);
  dome.castShadow = true;
  group.add(dome);
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
  cross.position.set(cx - 6, 54, cz + 20);
  group.add(cross);
  colliders.push({ minX: cx - 11, maxX: cx + 11, minZ: cz - 17, maxZ: cz + 17, height: 18, kind: 'cathedral' });
  colliders.push({ minX: cx - 12, maxX: cx, minZ: cz + 14, maxZ: cz + 26, height: 46, kind: 'tower' });
}

function buildMarina(group, props, colliders, random) {
  // The promenade: a long sand-coloured curb at the beach edge, umbrellas and a wooden pier.
  const promenade = new THREE.Mesh(new THREE.BoxGeometry(CITY * 2, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0xd9c8a2, roughness: 1 }));
  promenade.position.set(-200, 0.2, SEA_Z - 8);
  promenade.receiveShadow = true;
  group.add(promenade);

  // Beach sand.
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2 + 300, 40), new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-100, -0.05, SEA_Z + 16);
  beach.receiveShadow = true;
  group.add(beach);

  // Beach umbrellas.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xe7dcc4 });
  const canopyColors = [0xe4572e, 0x35d0c0, 0xffb347, 0xf4e8d2];
  for (let i = 0; i < 20; i += 1) {
    const ux = -700 + i * 70 + random() * 20;
    const uz = SEA_Z + 10 + random() * 22;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 5), poleMat);
    pole.position.set(ux, 1.5, uz);
    group.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.0, 8), new THREE.MeshStandardMaterial({ color: canopyColors[i % 4], roughness: 0.9, flatShading: true }));
    canopy.position.set(ux, 3.1, uz);
    canopy.castShadow = true;
    group.add(canopy);
  }

  // Pier: deck boards extending south into the water.
  const pier = LOCATIONS.pier;
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 140), deckMat);
  deck.position.set(pier.x, 1.0, SEA_Z + 60);
  deck.castShadow = true; deck.receiveShadow = true;
  group.add(deck);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b503b });
  for (let i = 0; i < 12; i += 1) {
    for (const sx of [-8, 8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 6), postMat);
      post.position.set(pier.x + sx, -1.5, SEA_Z + 10 + i * 11);
      group.add(post);
    }
  }
  colliders.push({ minX: pier.x - 9, maxX: pier.x + 9, minZ: SEA_Z + 6, maxZ: SEA_Z + 130, height: 0.3, kind: 'pier' });

  // Lighthouse at the end of the pier: banded tower and a glowing lamp.
  const lhX = pier.x;
  const lhZ = SEA_Z + 132;
  const lhMat = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 });
  const lhBand = new THREE.MeshStandardMaterial({ color: 0xd9443a, roughness: 0.8 });
  for (let i = 0; i < 4; i += 1) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.4 - i * 0.35, 2.6 - i * 0.35, 6, 12), i % 2 === 0 ? lhMat : lhBand);
    seg.position.set(lhX, 4 + i * 6, lhZ);
    seg.castShadow = true;
    group.add(seg);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd27a, emissiveIntensity: 2 }));
  lamp.position.set(lhX, 27, lhZ);
  group.add(lamp);
  colliders.push({ minX: lhX - 3, maxX: lhX + 3, minZ: lhZ - 3, maxZ: lhZ + 3, height: 28, kind: 'lighthouse' });

  // Hotels along the promenade: a few tall cream blocks set behind the beach.
  for (let i = 0; i < 5; i += 1) {
    const hx = -640 + i * 110;
    const hz = SEA_Z - 30;
    const hh = 30 + random() * 22;
    const hotel = new THREE.Mesh(new THREE.BoxGeometry(62, hh, 30), new THREE.MeshStandardMaterial({ color: 0xf1e6cf, roughness: 0.8, flatShading: true }));
    hotel.position.set(hx, hh / 2, hz);
    hotel.castShadow = true; hotel.receiveShadow = true;
    group.add(hotel);
    // Turquoise balcony bands.
    for (let f = 2; f < hh; f += 4) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(63, 0.5, 31), new THREE.MeshStandardMaterial({ color: 0x9fc9c4, roughness: 0.7 }));
      band.position.set(hx, f, hz);
      group.add(band);
    }
    colliders.push({ minX: hx - 31, maxX: hx + 31, minZ: hz - 15, maxZ: hz + 15, height: hh, kind: 'hotel' });
  }
  for (let i = 0; i < 14; i += 1) {
    props.palms.push({ x: -700 + i * 55, z: SEA_Z - 18 + random() * 4, h: 9 + random() * 5, lean: (random() - 0.5) * 0.4 });
  }
}

function buildDocks(group, colliders, random) {
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x6c7378, roughness: 0.95 });
  // Docks apron: a wide paved yard.
  const apron = new THREE.Mesh(new THREE.BoxGeometry(400, 0.2, 320), dockMat);
  apron.position.set(-560, 0.05, 160);
  apron.receiveShadow = true;
  group.add(apron);
  // Container stacks with bright primary colours.
  const colors = [0xb53a2a, 0x2f6f9d, 0x3f8a52, 0xd9a02a, 0x8a4a86, 0xc25a34];
  const containerGeo = new THREE.BoxGeometry(12, 3, 2.6);
  const containerMats = colors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.2, flatShading: true }));
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const cx = -720 + row * 22 + random() * 3;
      const cz = 90 + col * 16 + random() * 3;
      const stack = 1 + Math.floor(random() * 3);
      for (let s = 0; s < stack; s += 1) {
        const box = new THREE.Mesh(containerGeo, containerMats[Math.floor(random() * containerMats.length)]);
        box.position.set(cx, 1.7 + s * 3.1, cz);
        box.rotation.y = (random() - 0.5) * 0.05;
        box.castShadow = true; box.receiveShadow = true;
        group.add(box);
      }
      colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 1.4, maxZ: cz + 1.4, height: 9, kind: 'container' });
    }
  }
  // Two gantry cranes: tall legs and a long horizontal boom with a trolley.
  for (const gx of [-660, -500]) {
    const steel = new THREE.MeshStandardMaterial({ color: 0xd9772e, roughness: 0.6, metalness: 0.4 });
    for (const dz of [-9, 9]) {
      for (const dx of [-9, 9]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 40, 1.6), steel);
        leg.position.set(gx + dx, 20, 220 + dz);
        leg.castShadow = true;
        group.add(leg);
      }
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 20), steel);
    cross.position.set(gx, 40, 220);
    cross.castShadow = true;
    group.add(cross);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 90), steel);
    boom.position.set(gx, 44, 200);
    boom.castShadow = true;
    group.add(boom);
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
    trolley.position.set(gx, 41, 186);
    group.add(trolley);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 14, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    cable.position.set(gx, 34, 186);
    group.add(cable);
    colliders.push({ minX: gx - 10, maxX: gx + 10, minZ: 211, maxZ: 229, height: 42, kind: 'crane' });
  }
  // Warehouse shell (Almacen 14) — walls with a wide open front.
  const wh = LOCATIONS.warehouse;
  const whMat = new THREE.MeshStandardMaterial({ color: 0x7d8388, roughness: 0.9, flatShading: true });
  const whW = 46, whD = 34, whH = 12;
  const walls = [
    [wh.x, wh.z - whD / 2, whW, 0.8, whH], [wh.x - whW / 2, wh.z, 0.8, whD, whH], [wh.x + whW / 2, wh.z, 0.8, whD, whH],
  ];
  for (const [wx, wz, ww, wd, h] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, h, wd), whMat);
    wall.position.set(wx, h / 2, wz);
    wall.castShadow = true; wall.receiveShadow = true;
    group.add(wall);
    colliders.push({ minX: wx - ww / 2, maxX: wx + ww / 2, minZ: wz - wd / 2, maxZ: wz + wd / 2, height: h, kind: 'wall' });
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(whW, 0.8, whD), new THREE.MeshStandardMaterial({ color: 0x4a4f52, roughness: 0.9 }));
  roof.position.set(wh.x, whH, wh.z);
  roof.castShadow = true;
  group.add(roof);
  // Crates inside and out for the shootout cover.
  for (let i = 0; i < 10; i += 1) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9, flatShading: true }));
    crate.position.set(wh.x - 16 + random() * 32, 1.2, wh.z + 8 + random() * 10);
    crate.castShadow = true; crate.receiveShadow = true;
    group.add(crate);
    colliders.push({ minX: crate.position.x - 1.2, maxX: crate.position.x + 1.2, minZ: crate.position.z - 1.2, maxZ: crate.position.z + 1.2, height: 2.4, kind: 'crate' });
  }
  // Chain-link fence line.
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9aa3a3, roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 8; i += 1) {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 24), fenceMat);
    fence.position.set(-740 + i * 26, 1.3, 18);
    group.add(fence);
  }
}

function buildVillas(group, colliders, random) {
  // Hillside villas: cream blocks with terracotta roofs, pool rectangles and garden walls.
  for (let i = 0; i < 7; i += 1) {
    const vx = 220 + i * 70;
    const vz = 200 + (i % 3) * 90;
    const w = 20 + random() * 8;
    const d = 16 + random() * 6;
    const h = 6 + random() * 3;
    const villa = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0xf2e7d0, roughness: 0.85, flatShading: true }));
    villa.position.set(vx, h / 2, vz);
    villa.castShadow = true; villa.receiveShadow = true;
    group.add(villa);
    const roofV = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 4, 4), new THREE.MeshStandardMaterial({ color: 0xb4593c, roughness: 0.8, flatShading: true }));
    roofV.position.set(vx, h + 2, vz);
    roofV.rotation.y = Math.PI / 4;
    roofV.castShadow = true;
    group.add(roofV);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 5), new THREE.MeshStandardMaterial({ color: PALETTE.turquoise, roughness: 0.1, metalness: 0.3 }));
    pool.position.set(vx + w * 0.7, 0.2, vz + d * 0.4);
    group.add(pool);
    colliders.push({ minX: vx - w / 2, maxX: vx + w / 2, minZ: vz - d / 2, maxZ: vz + d / 2, height: h, kind: 'villa' });
  }
  // The Coronel's estate: a large white mansion behind a gate, on the hill to the east.
  const v = LOCATIONS.villa;
  const mansion = new THREE.Mesh(new THREE.BoxGeometry(48, 16, 32), new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.85, flatShading: true }));
  mansion.position.set(v.x, 8, v.z);
  mansion.castShadow = true; mansion.receiveShadow = true;
  group.add(mansion);
  const mroof = new THREE.Mesh(new THREE.BoxGeometry(50, 1, 34), new THREE.MeshStandardMaterial({ color: 0x9e4b34, roughness: 0.8 }));
  mroof.position.set(v.x, 16.5, v.z);
  group.add(mroof);
  colliders.push({ minX: v.x - 24, maxX: v.x + 24, minZ: v.z - 16, maxZ: v.z + 16, height: 16, kind: 'mansion' });
  for (let i = 0; i < 16; i += 1) {
    const px = v.x - 40 + i * 5.5;
    const palm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0x7a5a3a }));
    palm.position.set(px, 4, v.z + 30);
    group.add(palm);
  }
}

function buildIndustrial(group, colliders, random) {
  // Silos: three tall cylinders.
  for (let i = 0; i < 3; i += 1) {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 26, 14), new THREE.MeshStandardMaterial({ color: 0xc9c7bf, roughness: 0.7, metalness: 0.3, flatShading: true }));
    silo.position.set(-260 + i * 34, 13, -300);
    silo.castShadow = true; silo.receiveShadow = true;
    group.add(silo);
    colliders.push({ minX: -265 + i * 34, maxX: -255 + i * 34, minZ: -305, maxZ: -295, height: 26, kind: 'silo' });
  }
  // Rail siding: sleepers and rails.
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x5b4a36, roughness: 1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, metalness: 0.7, roughness: 0.4 });
  for (let i = 0; i < 60; i += 1) {
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 0.6), sleeperMat);
    sleeper.position.set(20 + i * 4 - 120, 0.1, -560);
    group.add(sleeper);
  }
  for (const rz of [-561.4, -558.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(240, 0.18, 0.12), railMat);
    rail.position.set(0, 0.3, rz);
    group.add(rail);
  }
  // Scrap heaps.
  for (let i = 0; i < 5; i += 1) {
    const heap = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + random() * 2, 0), new THREE.MeshStandardMaterial({ color: 0x6a635a, roughness: 1, flatShading: true }));
    heap.position.set(180 + i * 26, 2, -640 + random() * 20);
    heap.rotation.set(random(), random(), random());
    group.add(heap);
  }
}

function buildBarrioDecor(group, colliders, random) {
  // Laundry lines and taco stands: bright cloth rectangles strung between poles.
  const clothColors = [0xe4572e, 0x35d0c0, 0xffb347, 0xf4e8d2, 0x8a4a86];
  for (let i = 0; i < 16; i += 1) {
    const bx = 460 + random() * 280;
    const bz = -620 + random() * 620;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.05), new THREE.MeshStandardMaterial({ color: clothColors[i % 5], roughness: 0.9, side: THREE.DoubleSide }));
    cloth.position.set(bx, 5.5, bz);
    cloth.rotation.y = random();
    group.add(cloth);
  }
  // Taco stands: small awnings with a warm sign.
  for (let i = 0; i < 4; i += 1) {
    const sx = 480 + i * 60;
    const sz = -80 + random() * 20;
    const cart = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x9a5a3a, roughness: 0.9 }));
    cart.position.set(sx, 0.9, sz);
    cart.castShadow = true;
    group.add(cart);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 3), new THREE.MeshStandardMaterial({ color: 0xe4572e }));
    awning.position.set(sx, 2.8, sz);
    group.add(awning);
    colliders.push({ minX: sx - 1.6, maxX: sx + 1.6, minZ: sz - 1.1, maxZ: sz + 1.1, height: 1.6, kind: 'cart' });
  }
}

function buildStadium(group, colliders) {
  const s = LOCATIONS.stadium;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(42, 9, 8, 32), new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.9, flatShading: true }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(s.x, 6, s.z);
  ring.castShadow = true; ring.receiveShadow = true;
  group.add(ring);
  const field = new THREE.Mesh(new THREE.CircleGeometry(34, 32), new THREE.MeshStandardMaterial({ color: 0x4a7a44, roughness: 1 }));
  field.rotation.x = -Math.PI / 2;
  field.position.set(s.x, 0.3, s.z);
  group.add(field);
  colliders.push({ minX: s.x - 50, maxX: s.x - 32, minZ: s.z - 50, maxZ: s.z + 50, height: 12, kind: 'stadium' });
  colliders.push({ minX: s.x + 32, maxX: s.x + 50, minZ: s.z - 50, maxZ: s.z + 50, height: 12, kind: 'stadium' });
}

function buildAirstrip(group, colliders) {
  const a = LOCATIONS.airstrip;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(140, 26), new THREE.MeshStandardMaterial({ color: 0x44443f, roughness: 0.95 }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(a.x, 0.06, a.z);
  strip.rotation.z = 0.6;
  group.add(strip);
  for (let i = 0; i < 20; i += 1) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0xf0e8d0 }));
    dash.position.set(a.x - 60 + i * 6.4, 0.1, a.z + (i - 10) * 3.6);
    dash.rotation.y = 0.6;
    group.add(dash);
  }
  // A hangar shell near the strip.
  const hangar = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 26, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8a8f8c, roughness: 0.8, flatShading: true, side: THREE.DoubleSide }));
  hangar.rotation.z = Math.PI / 2;
  hangar.position.set(a.x + 30, 0, a.z + 20);
  hangar.castShadow = true;
  group.add(hangar);
}

function mergePalms(group, palms) {
  if (!palms.length) return;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palms.length);
  const crownGeo = new THREE.ConeGeometry(1.8, 1.2, 7);
  const crownMat = new THREE.MeshStandardMaterial({ color: PALETTE.foliage, roughness: 0.9, flatShading: true });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palms.length * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  palms.forEach((palm, i) => {
    p.set(palm.x, palm.h / 2, palm.z);
    q.setFromEuler(new THREE.Euler(palm.lean * 0.5, 0, palm.lean));
    s.set(1, palm.h, 1);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    p.set(palm.x + Math.sin(palm.lean) * palm.h * 0.5, palm.h, palm.z);
    s.set(1, 1, 1);
    q.setFromEuler(new THREE.Euler(0, i, 0));
    m.compose(p, q, s);
    crowns.setMatrixAt(i * 2, m);
    p.set(palm.x + Math.sin(palm.lean) * palm.h * 0.5, palm.h - 0.6, palm.z);
    q.setFromEuler(new THREE.Euler(0, i + 1, 0.6));
    m.compose(p, q, s);
    crowns.setMatrixAt(i * 2 + 1, m);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  group.add(trunks);
  group.add(crowns);
}

function mergeLamps(group, lamps) {
  if (!lamps.length) return;
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 7, 5);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.5 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd27a, emissiveIntensity: 1.4 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lamps.length);
  const m = new THREE.Matrix4();
  lamps.forEach((lamp, i) => {
    m.makeTranslation(lamp.x, 3.5, lamp.z);
    poles.setMatrixAt(i, m);
    m.makeTranslation(lamp.x, 7.1, lamp.z);
    heads.setMatrixAt(i, m);
  });
  group.add(poles);
  group.add(heads);
}
