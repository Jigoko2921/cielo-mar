// Deterministic Cielo Mar: six districts, roads, architecture, landmarks and collision data.
import { WORLD, PALETTE, LOCATIONS, createRandom, choose, districtAt, clamp } from './config.js';
import { GeometryBatch } from './render.js';

const cylinder6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const cylinder10 = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const palmCrown = new THREE.ConeGeometry(1.4, 6, 4);
const sphere8 = new THREE.SphereGeometry(1, 8, 5);

function groundPlane(width, depth, colour, x, z, y = -0.12) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ color: colour, roughness: 1 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

function addBeam(batch, from, to, radius, colour, sides = 6) {
  const direction = to.clone().sub(from);
  const length = direction.length();
  const midpoint = from.clone().add(to).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  const matrix = new THREE.Matrix4().compose(midpoint, quaternion, new THREE.Vector3(radius * 2, length, radius * 2));
  batch.addGeometry(sides === 10 ? cylinder10 : cylinder6, colour, matrix);
}

export class City {
  constructor(renderer, seed = 1) {
    this.renderer = renderer;
    this.seed = seed;
    this.random = createRandom(seed);
    this.group = new THREE.Group();
    this.group.name = 'Cielo Mar — six authored districts';
    this.colliders = [];
    this.roads = [];
    this.roadGraph = [];
    this.districtMeshes = [];
    this.palms = [];
    this.elapsed = 0;
    this.location = LOCATIONS;
    this.buildGroundAndSea();
    this.buildRoadNetwork();
    this.buildDistricts();
    this.buildLandmarks();
    this.buildCoastAndCountryside();
    this.buildRoadGraph();
    renderer.scene.add(this.group);
  }

  buildGroundAndSea() {
    this.group.add(groundPlane(940, 820, 0xb7a888, 0, -65));
    this.group.add(groundPlane(940, 132, PALETTE.sand, 0, 328, -0.035));
    const waterGeometry = new THREE.PlaneGeometry(1800, 1050, 70, 35);
    const waterMaterial = new THREE.ShaderMaterial({
      transparent: false,
      uniforms: { time: { value: 0 }, shallow: { value: new THREE.Color(PALETTE.sea) }, deep: { value: new THREE.Color(PALETTE.deepSea) }, sun: { value: new THREE.Color(0xf7c98b) } },
      vertexShader: 'uniform float time; varying float vWave; varying vec3 vPos; void main(){ vec3 p=position; float w=sin(p.x*0.055+time*0.7)*0.18+sin(p.y*0.074-time*0.52)*0.12; p.z+=w; vWave=w; vec4 world=modelMatrix*vec4(p,1.0); vPos=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }',
      fragmentShader: 'uniform vec3 shallow; uniform vec3 deep; uniform vec3 sun; varying float vWave; varying vec3 vPos; void main(){ float stripes=pow(max(0.0,sin(vPos.x*0.19+vPos.z*0.11+vWave*9.0)),18.0); float depth=clamp((vPos.z-340.0)/500.0,0.0,1.0); vec3 c=mix(shallow,deep,depth); c=mix(c,sun,stripes*0.28); gl_FragColor=vec4(c,1.0); }',
    });
    this.sea = new THREE.Mesh(waterGeometry, waterMaterial);
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.set(0, -0.45, 820);
    this.sea.receiveShadow = true;
    this.group.add(this.sea);
    const foam = new GeometryBatch();
    for (let x = -450; x < 450; x += 9) {
      foam.box(x + this.random() * 3, -0.02, 349 + this.random() * 3, 5 + this.random() * 4, 0.035, 0.28, 0xd7e6d9, this.random() * 0.4);
    }
    this.group.add(foam.finish('Fine Pacific foam', { unlit: true, castShadow: false }));
  }

  buildRoadNetwork() {
    const asphalt = new GeometryBatch();
    const markings = new GeometryBatch();
    const pavement = new GeometryBatch();
    const roads = WORLD.roadCoords;
    for (const x of roads) {
      asphalt.box(x, 0.015, -10, WORLD.roadWidth, 0.07, 830, PALETTE.asphalt);
      pavement.box(x - 10.1, 0.09, -10, 4.6, 0.18, 830, PALETTE.pavement);
      pavement.box(x + 10.1, 0.09, -10, 4.6, 0.18, 830, PALETTE.pavement);
      this.roads.push({ axis: 'z', fixed: x, start: -425, end: 340, width: WORLD.roadWidth });
      for (let z = -414; z < 335; z += 13) {
        markings.box(x, 0.065, z, 0.19, 0.018, 5.2, 0xd2b978);
        if (Math.abs(z % 95) < 7) {
          for (let offset = -6; offset <= 6; offset += 2) markings.box(x + offset, 0.067, z + 7, 1.05, 0.02, 3.5, 0xe4dfcf);
        }
      }
    }
    for (const z of roads) {
      if (z > 285) continue;
      asphalt.box(0, 0.018, z, 840, 0.075, WORLD.roadWidth, PALETTE.asphalt);
      pavement.box(0, 0.09, z - 10.1, 840, 0.18, 4.6, PALETTE.pavement);
      pavement.box(0, 0.09, z + 10.1, 840, 0.18, 4.6, PALETTE.pavement);
      this.roads.push({ axis: 'x', fixed: z, start: -420, end: 420, width: WORLD.roadWidth });
      for (let x = -414; x < 415; x += 13) markings.box(x, 0.067, z, 5.2, 0.018, 0.19, 0xd2b978);
    }
    // A broad diagonal boulevard cuts through the old city toward the water.
    const diagonalLength = 430;
    asphalt.box(54, 0.072, 72, diagonalLength, 0.07, 12.5, 0x424143, -0.56);
    for (let n = -190; n < 190; n += 13) {
      const x = 54 + Math.cos(-0.56) * n;
      const z = 72 - Math.sin(-0.56) * n;
      markings.box(x, 0.116, z, 5, 0.02, 0.18, 0xd9c58e, -0.56);
    }
    this.roads.push({ axis: 'diagonal', fixed: 0, start: -200, end: 260, width: 12.5, angle: -0.56, cx: 54, cz: 72 });
    // Coastal boulevard shares the southern road boundary, south of every hotel.
    asphalt.box(0, 0.09, 285, 845, 0.09, 17.5, 0x36383b);
    for (let x = -410; x < 410; x += 14) markings.box(x, 0.145, 285, 5.8, 0.02, 0.22, 0xf0c765);
    this.group.add(pavement.finish('Continuous kerbs and sidewalks'), asphalt.finish('Road grid and diagonal boulevard'), markings.finish('Lane paint and crosswalks', { unlit: true, castShadow: false }));
  }

  addCollider(x, z, width, depth, height, tag = 'building') {
    this.colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, height, tag });
  }

  buildDistricts() {
    const districtBatches = new Map();
    const props = new GeometryBatch();
    const windows = new GeometryBatch();
    const roads = WORLD.roadCoords;
    for (let xi = 0; xi < roads.length - 1; xi++) {
      for (let zi = 0; zi < roads.length - 2; zi++) {
        const left = roads[xi] + 13;
        const right = roads[xi + 1] - 13;
        const near = roads[zi] + 13;
        const far = roads[zi + 1] - 13;
        const cx = (left + right) / 2;
        const cz = (near + far) / 2;
        if (cz > 286 || (cx > 130 && cz > 90) || (cx < -205 && cz < -165) || (cx > 80 && cz < -220)) continue;
        const district = districtAt(cx, cz);
        if (!districtBatches.has(district.id)) districtBatches.set(district.id, new GeometryBatch());
        const batch = districtBatches.get(district.id);
        for (let bx = 0; bx < 2; bx++) {
          for (let bz = 0; bz < 2; bz++) {
            const x = left + (right - left) * (bx === 0 ? 0.25 : 0.75);
            const z = near + (far - near) * (bz === 0 ? 0.25 : 0.75);
            if (Math.abs(z - (0.65 * x + 37)) < 12 || Math.hypot(x - LOCATIONS.plaza.x, z - LOCATIONS.plaza.z) < 30) continue;
            if (Math.hypot(x + 62, z + 25) < 34 || Math.hypot(x - 48, z + 64) < 24) continue;
            const width = (right - left) * (0.34 + this.random() * 0.1);
            const depth = (far - near) * (0.34 + this.random() * 0.1);
            let height = district.minHeight + this.random() * (district.maxHeight - district.minHeight);
            if (district.id === 'marina') height *= 1.15;
            this.addBuilding(batch, windows, x, z, width, depth, height, choose(this.random, district.colours), district.id);
          }
        }
      }
    }
    for (const [id, batch] of districtBatches) {
      const mesh = batch.finish(`${id} architecture, balconies and rooftop detail`);
      this.districtMeshes.push(mesh);
      this.group.add(mesh);
    }
    this.group.add(windows.finish('Inset teal windows and warm interiors', { unlit: true, castShadow: false }));
    this.addStreetLife(props);
    this.group.add(props.finish('Palms, lamps, benches, umbrellas and street clutter'));
  }

  addBuilding(batch, windows, x, z, width, depth, height, colour, district) {
    batch.box(x, height / 2 + 0.15, z, width, height, depth, colour);
    batch.box(x, height + 0.35, z, width + 0.6, 0.55, depth + 0.6, 0xe7cfab);
    batch.box(x, 0.6, z + depth / 2 + 0.08, width + 0.3, 1.2, 0.18, 0xc39a70);
    const floors = Math.floor((height - 2) / 3);
    const columns = Math.max(2, Math.floor(width / 4.2));
    for (let floor = 0; floor < floors; floor++) {
      const y = 2.6 + floor * 3;
      for (let col = 0; col < columns; col++) {
        const wx = x - width * 0.37 + col * (width * 0.74 / Math.max(1, columns - 1));
        const glow = this.random() > 0.84 ? 0xf2bd72 : 0x34565c;
        windows.box(wx, y, z + depth / 2 + 0.015, 1.65, 1.55, 0.07, glow);
        windows.box(wx, y, z - depth / 2 - 0.015, 1.65, 1.55, 0.07, 0x314d52);
        batch.box(wx, y - 0.86, z + depth / 2 + 0.13, 1.95, 0.16, 0.34, 0xe8d8bd);
        if (floor % 2 === 1 && district !== 'puerto') {
          batch.box(wx, y - 0.85, z + depth / 2 + 0.75, 2.3, 0.18, 1.35, 0xdecaac);
          batch.box(wx, y - 0.3, z + depth / 2 + 1.3, 2.3, 0.55, 0.08, 0x586661);
        }
      }
      const sideColumns = Math.max(1, Math.floor(depth / 5));
      for (let col = 0; col < sideColumns; col++) {
        const wz = z - depth * 0.3 + col * (depth * 0.6 / Math.max(1, sideColumns - 1));
        windows.box(x + width / 2 + 0.016, y, wz, 0.07, 1.55, 1.65, 0x3c6266);
        windows.box(x - width / 2 - 0.016, y, wz, 0.07, 1.55, 1.65, 0x3b565b);
      }
    }
    if (district === 'cienaga') {
      batch.box(x, 2.2, z + depth / 2 + 0.3, width * 0.65, 1.5, 0.18, choose(this.random, [0x4f8e88, 0xb95643, 0xd8ac47]));
      // Laundry cords and cloth are geometry, not textures.
      addBeam(batch, new THREE.Vector3(x - width / 2, height * 0.7, z), new THREE.Vector3(x + width / 2, height * 0.7, z), 0.025, 0x574d43);
      for (let i = 0; i < 4; i++) batch.box(x - 3 + i * 2, height * 0.7 - 0.65, z, 1.15, 1.25, 0.055, choose(this.random, [0xe3c88e, 0x608b88, 0xae5f54]));
    }
    if (district === 'marina' || district === 'palmas') {
      batch.box(x - width * 0.23, 2.1, z + depth / 2 + 1.1, width * 0.45, 0.25, 2.2, 0x497e79);
    }
    if (height > 15 && this.random() > 0.4) {
      batch.primitive(cylinder10, x + width * 0.22, height + 1.65, z, 0x776856, [2.1, 2.5, 2.1]);
      batch.box(x + width * 0.22, height + 3, z, 2.4, 0.18, 2.4, 0x4e5d5d);
    }
    this.addCollider(x, z, width, depth, height);
  }

  addStreetLife(batch) {
    for (let x = -390; x <= 390; x += 28) {
      this.addPalm(batch, x, 276 + (Math.floor(x / 28) % 2) * 5, 7.5 + this.random() * 3.5);
      if (Math.floor(x / 28) % 2 === 0) this.addLamp(batch, x + 12, 264);
    }
    for (const roadX of WORLD.roadCoords) {
      for (let z = -360; z < 230; z += 47) {
        if (this.random() > 0.52) this.addPalm(batch, roadX + 11.8, z, 6.5 + this.random() * 2.5);
        else this.addLamp(batch, roadX - 11, z);
      }
    }
    for (let i = 0; i < 36; i++) {
      const x = -390 + this.random() * 780;
      const z = 300 + this.random() * 34;
      const colour = choose(this.random, [0xca6948, 0xe9bd5f, 0x3d8e88, 0xe9dbc0]);
      batch.primitive(new THREE.ConeGeometry(2.5, 1.1, 8), x, 2.75, z, colour);
      batch.primitive(cylinder6, x, 1.25, z, 0x8a6c4d, [0.12, 2.5, 0.12]);
      batch.box(x - 1.4, 0.28, z + 2.4, 1.5, 0.22, 3, colour, this.random() - 0.5);
    }
    for (let x = -320; x < 340; x += 84) {
      batch.box(x, 0.6, 292, 3.5, 0.16, 1.1, 0x78583e);
      batch.box(x, 1.15, 292.45, 3.5, 0.9, 0.14, 0x78583e);
      batch.box(x - 1.4, 0.32, 292, 0.16, 0.65, 1.1, 0x333c3d);
      batch.box(x + 1.4, 0.32, 292, 0.16, 0.65, 1.1, 0x333c3d);
    }
    // Inés's food cart and the safehouse courtyard form a recognisable home base.
    batch.box(LOCATIONS.foodCart.x, 1.05, LOCATIONS.foodCart.z, 3.1, 1.65, 1.8, 0x2e8c83);
    batch.primitive(new THREE.ConeGeometry(2.6, 1, 4), LOCATIONS.foodCart.x, 3.1, LOCATIONS.foodCart.z, 0xf2bd62, [1, 1, 0.75], [0, Math.PI / 4, 0]);
    for (const sx of [-1.25, 1.25]) batch.primitive(cylinder6, LOCATIONS.foodCart.x + sx, 1.9, LOCATIONS.foodCart.z, 0x685343, [0.09, 2.5, 0.09]);
  }

  addPalm(batch, x, z, height) {
    const lean = (this.random() - 0.5) * 0.9;
    addBeam(batch, new THREE.Vector3(x, 0, z), new THREE.Vector3(x + lean, height, z + lean * 0.4), 0.26, 0x8e6d45, 10);
    for (let leaf = 0; leaf < 7; leaf++) {
      const angle = leaf / 7 * Math.PI * 2;
      batch.primitive(palmCrown, x + lean + Math.sin(angle) * 2.15, height - 0.25 - (leaf % 2) * 0.25, z + lean * 0.4 + Math.cos(angle) * 2.15, leaf % 2 ? 0x496e45 : 0x3f6b4a, [0.7, 1.0, 0.24], [Math.PI / 2.4, angle, 0]);
    }
    batch.primitive(sphere8, x + lean, height - 0.4, z + lean * 0.4, 0x69583a, [0.48, 0.48, 0.48]);
  }

  addLamp(batch, x, z) {
    batch.primitive(cylinder6, x, 3.3, z, 0x394647, [0.12, 6.6, 0.12]);
    batch.box(x, 6.6, z, 1.2, 0.22, 0.55, 0x394647);
    batch.box(x, 6.45, z, 0.8, 0.08, 0.4, 0xffd890);
  }

  buildLandmarks() {
    const historic = new GeometryBatch();
    const marine = new GeometryBatch();
    const industry = new GeometryBatch();
    const hills = new GeometryBatch();
    this.buildCathedral(historic);
    this.buildPierAndLighthouse(marine);
    this.buildPort(industry);
    this.buildVilla(hills);
    this.buildStadiumAndIndustrialNorth(industry);
    this.buildCentralPlaza(historic);
    this.group.add(historic.finish('Centro Viejo cathedral, arcade and fountain'), marine.finish('Marina pier and lighthouse'), industry.finish('Puerto Azul cranes and Zona Norte stadium'), hills.finish('Coronel estate above Las Palmas'));
  }

  buildCathedral(batch) {
    const x = -64, z = -29;
    batch.box(x, 8, z, 27, 16, 39, 0xe5cfaa);
    batch.box(x, 20, z + 12, 10, 25, 10, 0xd6b78a);
    batch.box(x, 34, z + 12, 8, 4, 8, 0xc89465);
    batch.primitive(new THREE.ConeGeometry(6, 11, 4), x, 41.5, z + 12, 0xa9593e, [1, 1, 1], [0, Math.PI / 4, 0]);
    batch.box(x, 49, z + 12, 0.55, 6, 0.55, 0x5e5648);
    batch.box(x, 50.3, z + 12, 3.6, 0.5, 0.55, 0x5e5648);
    for (const dx of [-8, 0, 8]) {
      batch.box(x + dx, 4.2, z + 19.55, 4.5, 7.6, 0.25, 0x476268);
      batch.primitive(new THREE.SphereGeometry(2.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), x + dx, 8, z + 19.5, 0x476268, [1, 1, 0.13]);
    }
    for (let y = 24; y < 34; y += 5) batch.box(x, y, z + 17.05, 2.3, 3.2, 0.18, 0x344a4c);
    this.addCollider(x, z, 27, 39, 20, 'cathedral');
    this.landmarkCathedral = new THREE.Vector3(x, 30, z);
  }

  buildPierAndLighthouse(batch) {
    const x = LOCATIONS.pier.x;
    for (let z = 336; z <= 465; z += 4) {
      batch.box(x, 0.36, z, 9, 0.55, 3.85, z % 8 ? 0x866345 : 0x987354);
      if (z % 12 === 0) {
        for (const dx of [-4, 4]) batch.primitive(cylinder6, x + dx, -0.4, z, 0x574b3e, [0.34, 4.2, 0.34]);
      }
    }
    const z = 454;
    batch.primitive(new THREE.CylinderGeometry(3.2, 4.4, 17, 16), x + 8, 8.8, z, 0xe8dfc6);
    batch.primitive(new THREE.CylinderGeometry(3.35, 3.65, 3.2, 16), x + 8, 11.7, z, 0xb9563e);
    batch.primitive(new THREE.CylinderGeometry(2.8, 2.8, 3, 12), x + 8, 18.2, z, 0x314b50);
    batch.primitive(new THREE.ConeGeometry(3.5, 3, 12), x + 8, 21.2, z, 0xb9563e);
    batch.box(x + 8, 18.4, z + 2.6, 1.5, 1.35, 0.15, 0xffda86);
    this.landmarkLighthouse = new THREE.Vector3(x + 8, 18, z);
  }

  addContainer(batch, x, z, colour, stacked = 0, rotation = 0) {
    const y = 1.55 + stacked * 3.15;
    batch.box(x, y, z, 12, 3, 3.1, colour, rotation);
    for (let rib = -5; rib <= 5; rib += 1.7) batch.box(x + rib * Math.cos(rotation), y, z - rib * Math.sin(rotation), 0.12, 2.7, 3.18, 0xffffff * 0 + new THREE.Color(colour).multiplyScalar(0.72).getHex(), rotation);
    if (!stacked) this.addCollider(x, z, rotation ? 3.5 : 12, rotation ? 12 : 3.5, 3.2, 'container');
  }

  addCrane(batch, x, z, rotation = 0) {
    const colour = 0xc06b3f;
    for (const dx of [-9, 9]) {
      batch.box(x + dx, 16, z, 1.4, 32, 1.5, colour);
      batch.box(x + dx, 5, z + 12, 1.2, 10, 1.3, colour);
      addBeam(batch, new THREE.Vector3(x + dx, 1, z + 12), new THREE.Vector3(x + dx, 27, z), 0.35, colour);
    }
    batch.box(x, 31, z, 27, 2, 3, colour);
    batch.box(x + 12, 32.8, z, 52, 1.2, 2, 0xe1a04c);
    batch.box(x - 8, 34, z, 6, 3, 4, 0x3c5558);
    addBeam(batch, new THREE.Vector3(x + 27, 33, z), new THREE.Vector3(x + 27, 7, z), 0.09, 0x303638);
    batch.box(x + 27, 6.6, z, 2.4, 0.65, 1, 0x303638);
    this.addCollider(x - 9, z, 2, 2, 32, 'crane');
    this.addCollider(x + 9, z, 2, 2, 32, 'crane');
  }

  buildPort(batch) {
    this.addCrane(batch, 278, 134);
    this.addCrane(batch, 363, 186);
    const colours = [0x9a4e38, 0x376b70, 0xc29a48, 0x596c52, 0xb7a881];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = 173 + col * 16;
        const z = 219 + row * 15;
        this.addContainer(batch, x, z, colours[(row + col) % colours.length]);
        if ((row + col) % 3 !== 0) this.addContainer(batch, x, z, colours[(row + col + 2) % colours.length], 1);
      }
    }
    const w = LOCATIONS.warehouse;
    batch.box(w.x, 6.2, w.z, 55, 12, 38, 0x87918a);
    batch.box(w.x, 12.7, w.z, 57, 1.2, 40, 0x675f53);
    batch.box(w.x, 4.2, w.z + 19.1, 13, 8, 0.3, 0x31464b);
    for (let x = w.x - 22; x <= w.x + 22; x += 11) batch.box(x, 8.5, w.z + 19.25, 5, 1.2, 0.25, 0x314e52);
    // Warehouse side walls leave a real central combat yard open.
    this.addCollider(w.x - 19, w.z, 17, 38, 12, 'warehouse');
    this.addCollider(w.x + 19, w.z, 17, 38, 12, 'warehouse');
    for (let z = 105; z < 295; z += 8) {
      batch.box(395, 1.6, z, 0.12, 3.2, 0.12, 0x626961);
      addBeam(batch, new THREE.Vector3(395, 3, z), new THREE.Vector3(395, 3, z + 8), 0.045, 0x626961);
    }
  }

  buildVilla(batch) {
    const v = LOCATIONS.villa;
    batch.primitive(sphere8, v.x, -7, v.z, 0x6d8055, [78, 25, 68]);
    batch.box(v.x, 16.5, v.z, 44, 10, 26, 0xeee0c6);
    batch.box(v.x - 15, 22.5, v.z, 15, 5, 20, 0xd3a074);
    batch.box(v.x, 22.1, v.z, 46, 1.1, 28, 0xb65b3e);
    for (let x = v.x - 17; x < v.x + 19; x += 7) {
      batch.box(x, 17.3, v.z + 13.05, 3.2, 5.4, 0.22, 0x34565a);
      batch.box(x, 13.2, v.z + 14.2, 4.4, 0.35, 2.4, 0xe8cda9);
    }
    batch.box(v.x + 4, 11.95, v.z + 28, 22, 0.35, 12, 0xd9d0b7);
    batch.box(v.x + 4, 12.16, v.z + 28, 18, 0.12, 8, 0x3c9caa);
    for (const dx of [-29, 29]) batch.box(v.x + dx, 13, v.z + 5, 2.2, 6, 2.2, 0xd8bb8f);
    batch.box(v.x, 14.5, v.z + 38, 57, 1, 1.4, 0xa7825f);
    this.addCollider(v.x, v.z, 44, 26, 25, 'villa');
    this.landmarkVilla = new THREE.Vector3(v.x, 24, v.z);
  }

  buildStadiumAndIndustrialNorth(batch) {
    const x = 164, z = -307;
    batch.primitive(new THREE.CylinderGeometry(35, 42, 10, 40, 1, true), x, 5, z, 0xb5a386);
    const ring = new THREE.TorusGeometry(37, 3.5, 6, 40);
    batch.primitive(ring, x, 11, z, 0xe0cda8, [1, 1, 1], [Math.PI / 2, 0, 0]);
    batch.primitive(new THREE.CylinderGeometry(31, 31, 0.35, 40), x, 0.4, z, 0x52774f);
    batch.box(x, 0.64, z, 0.18, 0.04, 50, 0xe2d8b9);
    for (let i = 0; i < 4; i++) {
      const sx = 315 + (i % 2) * 24;
      const sz = -176 - Math.floor(i / 2) * 29;
      batch.primitive(new THREE.CylinderGeometry(7, 7, 22, 16), sx, 11, sz, 0x9b9b86);
      batch.primitive(new THREE.ConeGeometry(7.4, 5, 16), sx, 24.5, sz, 0x737b72);
    }
    // Rail sidings and scrap heaps make the north readable from street level.
    for (const rx of [235, 242, 249]) batch.box(rx, 0.12, -310, 0.16, 0.2, 220, 0x555753);
    for (let i = 0; i < 26; i++) batch.box(268 + this.random() * 37, 0.5 + this.random(), -265 + this.random() * 26, 2 + this.random() * 4, 1 + this.random() * 2, 2 + this.random() * 3, choose(this.random, [0x695c4e, 0x80533d, 0x4a6460]), this.random() * 3);
    // Airstrip used by the final pursuit.
    batch.box(281, 0.09, -379, 26, 0.12, 175, 0x424446);
    for (let z = -450; z < -300; z += 13) batch.box(281, 0.17, z, 0.35, 0.03, 6, 0xe1dbc8);
  }

  buildCentralPlaza(batch) {
    const p = LOCATIONS.plaza;
    batch.box(p.x, 0.18, p.z, 48, 0.28, 48, 0xc5ae8b);
    batch.primitive(new THREE.CylinderGeometry(7, 8, 1.2, 20), p.x, 0.8, p.z, 0xad9270);
    batch.primitive(new THREE.CylinderGeometry(6.3, 6.3, 0.3, 20), p.x, 1.45, p.z, 0x48989a);
    batch.primitive(cylinder10, p.x, 3.6, p.z, 0xcfb891, [0.55, 5.1, 0.55]);
    batch.primitive(sphere8, p.x, 6.4, p.z, 0xd6bf99, [1.4, 1.4, 1.4]);
    for (let a = 0; a < 8; a++) {
      const angle = a / 8 * Math.PI * 2;
      this.addPalm(batch, p.x + Math.sin(angle) * 19, p.z + Math.cos(angle) * 19, 8);
    }
  }

  buildCoastAndCountryside() {
    const hills = new GeometryBatch();
    // A terracotta-inlaid pedestrian promenade separates the boulevard from the sand.
    hills.box(0, 0.045, 303, 840, 0.12, 18, 0xc7b18d);
    hills.box(0, 0.12, 294.2, 840, 0.025, 0.45, 0xa8674e);
    hills.box(0, 0.12, 311.8, 840, 0.025, 0.45, 0xa8674e);
    for (let x = -415; x < 420; x += 5) hills.box(x, 0.125, 303, 0.07, 0.02, 17, 0xa99b82);
    for (let x = -420; x < 420; x += 13) {
      if (Math.abs(x - LOCATIONS.pier.x) < 9) continue;
      hills.box(x, 0.65, 340, 0.22, 1.3, 0.22, 0xdac8a9);
    }
    hills.box(0, 1.13, 340, 840, 0.14, 0.14, 0xdac8a9);
    for (let i = 0; i < 19; i++) {
      const x = -630 + i * 70;
      const height = 50 + this.random() * 65;
      hills.primitive(sphere8, x, -15, -535 - this.random() * 70, choose(this.random, [0x7c8865, 0x92906c, 0x6c7b5f]), [70 + this.random() * 30, height, 65]);
    }
    // A small flat-head sign, garage doors and service props anchor pay-and-spray.
    hills.box(LOCATIONS.garage.x, 4, LOCATIONS.garage.z, 25, 8, 17, 0xc49b70);
    hills.box(LOCATIONS.garage.x, 3.2, LOCATIONS.garage.z + 8.6, 14, 6, 0.2, 0x314f52);
    hills.box(LOCATIONS.garage.x, 7.2, LOCATIONS.garage.z + 8.9, 16, 1.3, 0.3, 0xd8a644);
    this.addCollider(LOCATIONS.garage.x, LOCATIONS.garage.z, 25, 17, 8, 'garage');
    this.group.add(hills.finish('Northern hills, garage and airstrip context'));
  }

  buildRoadGraph() {
    const roads = WORLD.roadCoords;
    for (let i = 0; i < roads.length; i++) {
      this.roadGraph[i] = [];
      for (let j = 0; j < roads.length - 1; j++) {
        const node = { i, j, x: roads[i], z: roads[j], neighbours: [] };
        this.roadGraph[i][j] = node;
        if (i > 0) node.neighbours.push([i - 1, j]);
        if (i < roads.length - 1) node.neighbours.push([i + 1, j]);
        if (j > 0) node.neighbours.push([i, j - 1]);
        if (j < roads.length - 2) node.neighbours.push([i, j + 1]);
      }
    }
  }

  heightAt(x, z) {
    const dx = (x - LOCATIONS.villa.x) / 68;
    const dz = (z - LOCATIONS.villa.z) / 58;
    const hill = Math.max(0, 1 - dx * dx - dz * dz);
    if (hill > 0) return hill * 14;
    if (x > LOCATIONS.pier.x - 4.6 && x < LOCATIONS.pier.x + 4.6 && z > 333 && z < 468) return 0.64;
    return 0.18;
  }

  update(deltaTime) {
    this.elapsed += deltaTime;
    this.sea.material.uniforms.time.value = this.elapsed;
  }

  isWater(x, z) {
    const onPier = x > LOCATIONS.pier.x - 4.8 && x < LOCATIONS.pier.x + 4.8 && z < 468;
    return z > WORLD.seaStart && !onPier;
  }

  resolveCollision(position, radius = 0.5, allowWater = false) {
    position.x = clamp(position.x, -424, 424);
    if (!allowWater && position.z > WORLD.seaStart && !(Math.abs(position.x - LOCATIONS.pier.x) < 4.4 && position.z < 468)) position.z = WORLD.seaStart;
    if (position.z < -463) position.z = -463;
    for (const collider of this.colliders) {
      const nearestX = clamp(position.x, collider.minX, collider.maxX);
      const nearestZ = clamp(position.z, collider.minZ, collider.maxZ);
      const dx = position.x - nearestX;
      const dz = position.z - nearestZ;
      if (dx * dx + dz * dz >= radius * radius) continue;
      if (dx === 0 && dz === 0) {
        const left = Math.abs(position.x - collider.minX);
        const right = Math.abs(collider.maxX - position.x);
        const near = Math.abs(position.z - collider.minZ);
        const far = Math.abs(collider.maxZ - position.z);
        const minimum = Math.min(left, right, near, far);
        if (minimum === left) position.x = collider.minX - radius;
        else if (minimum === right) position.x = collider.maxX + radius;
        else if (minimum === near) position.z = collider.minZ - radius;
        else position.z = collider.maxZ + radius;
      } else {
        const length = Math.hypot(dx, dz) || 1;
        position.x = nearestX + dx / length * radius;
        position.z = nearestZ + dz / length * radius;
      }
    }
    return position;
  }

  cameraClearance(focus, desired) {
    const previous = focus.clone();
    for (let step = 1; step <= 14; step++) {
      const point = focus.clone().lerp(desired, step / 14);
      for (const box of this.colliders) {
        if (point.y > box.height + 0.5) continue;
        if (point.x > box.minX - 0.3 && point.x < box.maxX + 0.3 && point.z > box.minZ - 0.3 && point.z < box.maxZ + 0.3) return previous;
      }
      previous.copy(point);
    }
    return desired;
  }

  hasLineOfSight(from, to) {
    for (let step = 1; step < 14; step++) {
      const point = from.clone().lerp(to, step / 14);
      for (const box of this.colliders) {
        if (point.y < box.height && point.x > box.minX && point.x < box.maxX && point.z > box.minZ && point.z < box.maxZ) return false;
      }
    }
    return true;
  }

  randomSidewalkPoint(random = this.random) {
    const road = choose(random, this.roads.filter((item) => item.axis !== 'diagonal'));
    const along = road.start + 20 + random() * (road.end - road.start - 40);
    const side = random() > 0.5 ? 1 : -1;
    if (road.axis === 'z') return { x: road.fixed + side * 10.2, z: along };
    return { x: along, z: road.fixed + side * 10.2 };
  }

  districtNameAt(x, z) { return districtAt(x, z).name; }
}
