// Rendering: the WebGL renderer, the golden-hour sky shader, the low sun with 2048 shadows, fog
// that dissolves the far city into haze, the third-person camera rig with collision pull-in, and
// the particle pools (tracers, sparks, muzzle flashes, smoke, blood, dust) plus the waypoint.
// Nothing here simulates: it takes positions from the other modules and puts pixels on screen.

import { PALETTE, CITY } from './config.js';

export const CAMERA = {
  yaw: 0,
  pitch: -0.12,
  distance: 5.4,
  aimDistance: 2.6,
  pos: new THREE.Vector3(),
  look: new THREE.Vector3(),
  shake: 0,
};

/** Deterministic particle spark pool: preallocated sprites, no allocation per shot. */
function makeSpriteTexture(kind) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (kind === 'soft') {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,220,160,0.6)');
    g.addColorStop(1, 'rgba(255,150,60,0)');
  } else if (kind === 'smoke') {
    g.addColorStop(0, 'rgba(80,76,70,0.9)');
    g.addColorStop(1, 'rgba(60,58,54,0)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

let rendererStateSeaBase = null;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PALETTE.haze, 0.0016);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.4, 3200);

  // Sky: a large inverted dome with a vertical gradient, the sun disc and a band of haze.
  const skyGeo = new THREE.SphereGeometry(2600, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      haze: { value: new THREE.Color(PALETTE.haze) },
      sunDir: { value: new THREE.Vector3(-0.6, 0.26, -0.55).normalize() },
      sunTone: { value: new THREE.Color(0xffe0a8) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 haze; uniform vec3 sunDir; uniform vec3 sunTone;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 1.15 + 0.06, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.62));
        float band = exp(-abs(vDir.y) * 7.5);
        col = mix(col, haze, band * 0.55);
        float sd = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunTone * pow(sd, 90.0) * 1.5;
        col += sunTone * pow(sd, 6.0) * 0.22;
        float ground = smoothstep(0.02, -0.12, vDir.y);
        col = mix(col, haze * 0.82, ground);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xcfe0e6, 0x4a3a2a, 0.62));
  const ambient = new THREE.AmbientLight(0xffe3bd, 0.18);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.5);
  sun.position.set(-420, 260, -300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 1500;
  const shadowSize = 220;
  sun.shadow.camera.left = -shadowSize;
  sun.shadow.camera.right = shadowSize;
  sun.shadow.camera.top = shadowSize;
  sun.shadow.camera.bottom = -shadowSize;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);

  const rim = new THREE.DirectionalLight(0x7fb7c9, 0.35);
  rim.position.set(300, 180, 400);
  scene.add(rim);

  // The sea: a big plane with a slow vertex ripple and a turquoise gradient material.
  const seaGeo = new THREE.PlaneGeometry(4000, 1600, 40, 16);
  const seaMat = new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.22, metalness: 0.15, transparent: true, opacity: 0.96 });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.35, 1400);
  sea.receiveShadow = false;
  scene.add(sea);
  const seaBase = seaGeo.attributes.position.array.slice();
  rendererStateSeaBase = seaBase;

  // Sprite particle systems: sparks glow, smoke billows, tracers are thin stretched sprites.
  const sparkTex = makeSpriteTexture('soft');
  const smokeTex = makeSpriteTexture('smoke');
  const dotTex = makeSpriteTexture('dot');
  const sparks = makeParticlePool(scene, sparkTex, 240, THREE.AdditiveBlending);
  const smokes = makeParticlePool(scene, smokeTex, 120, THREE.NormalBlending);
  const tracers = makeParticlePool(scene, dotTex, 80, THREE.AdditiveBlending);
  const casings = makeCasingPool(scene);

  // Waypoint: a tall amber beam plus a rotating ring at ground level, shown when a mission lives.
  const wpGroup = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 16, 1, true), beamMat);
  beam.position.y = 30;
  wpGroup.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.0, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  wpGroup.add(ring);
  wpGroup.visible = false;
  scene.add(wpGroup);

  const searchLight = new THREE.SpotLight(0xfff5dd, 0, 260, 0.34, 0.5, 1.2);
  searchLight.castShadow = false;
  scene.add(searchLight);
  scene.add(searchLight.target);

  const state = {
    renderer, scene, camera, sun, sky, sea, sparks, smokes, tracers, casings, wpGroup, searchLight,
    time: 0, width: window.innerWidth, height: window.innerHeight,
  };

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    state.width = window.innerWidth;
    state.height = window.innerHeight;
  });

  return state;
}

function makeParticlePool(scene, texture, count, blending) {
  const group = new THREE.Group();
  scene.add(group);
  const items = [];
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending, color: 0xffffff });
  for (let i = 0; i < count; i += 1) {
    const sprite = new THREE.Sprite(material.clone());
    sprite.visible = false;
    sprite.renderOrder = 3;
    group.add(sprite);
    items.push({ sprite, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, gravity: 0, size: 1, grow: 0, color: new THREE.Color(1, 1, 1) });
  }
  let cursor = 0;
  return {
    spawn(x, y, z, vx, vy, vz, life, size, color, gravity = 0, grow = 0, opacity = 1) {
      const p = items[cursor];
      cursor = (cursor + 1) % items.length;
      p.sprite.position.set(x, y, z);
      p.sprite.visible = true;
      p.sprite.scale.set(size, size, 1);
      p.sprite.material.opacity = opacity;
      p.sprite.material.color.set(color);
      p.life = life; p.maxLife = life; p.vx = vx; p.vy = vy; p.vz = vz;
      p.gravity = gravity; p.size = size; p.grow = grow; p.opacity = opacity;
    },
    update(dt) {
      for (const p of items) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.sprite.visible = false; continue; }
        p.vy -= p.gravity * dt;
        p.sprite.position.x += p.vx * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;
        const s = p.size + p.grow * (1 - p.life / p.maxLife);
        p.sprite.scale.set(s, s, 1);
        p.sprite.material.opacity = p.opacity * Math.min(1, p.life / p.maxLife * 1.6);
      }
    },
    clear() { for (const p of items) { p.life = 0; p.sprite.visible = false; } },
  };
}

function makeCasingPool(scene) {
  const geo = new THREE.BoxGeometry(0.09, 0.09, 0.18);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.8, roughness: 0.4 });
  const group = new THREE.Group();
  scene.add(group);
  const items = [];
  for (let i = 0; i < 48; i += 1) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    items.push({ mesh, life: 0, vy: 0 });
  }
  let cursor = 0;
  return {
    spawn(x, y, z, vx, vz) {
      const c = items[cursor];
      cursor = (cursor + 1) % items.length;
      c.mesh.position.set(x, y, z);
      c.mesh.visible = true;
      c.vx = vx; c.vz = vz; c.vy = 3 + Math.random() * 2; c.life = 1.4;
      c.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    },
    update(dt) {
      for (const c of items) {
        if (c.life <= 0) continue;
        c.life -= dt;
        c.vy -= 18 * dt;
        c.mesh.position.x += c.vx * dt;
        c.mesh.position.y = Math.max(0.04, c.mesh.position.y + c.vy * dt);
        c.mesh.position.z += c.vz * dt;
        c.mesh.rotation.x += dt * 9;
        c.mesh.rotation.z += dt * 6;
        if (c.life <= 0) c.mesh.visible = false;
      }
    },
  };
}

/** Fire a single tracer from a to b that lives just long enough to read as a streak. */
export function drawTracer(rendererState, from, to, color = 0xffd27a) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const steps = Math.min(7, Math.max(2, Math.floor(dist / 4)));
  rendererState.tracers.spawn(from.x, from.y, from.z, dx / dist * 6, dy / dist * 6, dz / dist * 6, 0.06, 0.5, color, 0, 2.6, 0.95);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    rendererState.tracers.spawn(
      from.x + dx * t, from.y + dy * t, from.z + dz * t,
      dx / dist * 2, dy / dist * 2, dz / dist * 2, 0.05, 0.28, color, 0, 0, 0.6,
    );
  }
}

export function drawImpact(rendererState, point, normal, blood = false) {
  const color = blood ? 0xa3241a : 0xffcf87;
  for (let i = 0; i < 8; i += 1) {
    rendererState.sparks.spawn(
      point.x, point.y, point.z,
      (Math.random() - 0.5) * 7 + (normal?.x ?? 0) * 2,
      Math.random() * 5 + (normal?.y ?? 0) * 2,
      (Math.random() - 0.5) * 7 + (normal?.z ?? 0) * 2,
      0.25 + Math.random() * 0.25, 0.22 + Math.random() * 0.15, color, 9, 0.1,
    );
  }
  if (!blood) rendererState.smokes.spawn(point.x, point.y, point.z, 0, 1.2, 0, 0.6, 0.5, 0xc7bda7, 0, 1.4, 0.5);
}

export function drawMuzzle(rendererState, point, direction) {
  rendererState.sparks.spawn(point.x, point.y, point.z, direction.x * 6, direction.y * 6, direction.z * 6, 0.09, 1.1, 0xffd98a, 0, 0.6, 1);
  rendererState.spawnFlash = 0.05;
}

export function showWaypoint(rendererState, position, visible = true) {
  rendererState.wpGroup.visible = visible;
  if (visible && position) rendererState.wpGroup.position.set(position.x, 0, position.z);
}

/** Place the camera by hand for a staged shot: position, look-at and vertical field of view. */
export function snapCamera(rendererState, position, lookAt, fov = 60) {
  const cam = rendererState.camera;
  cam.position.copy(position);
  cam.lookAt(lookAt);
  cam.fov = fov;
  cam.updateProjectionMatrix();
  CAMERA.yaw = Math.atan2(position.x - lookAt.x, position.z - lookAt.z);
  CAMERA.pitch = Math.atan2(lookAt.y - position.y, Math.hypot(position.x - lookAt.x, position.z - lookAt.z));
}

/** Follow rig: behind the shoulder, orbit by mouse, springs toward the target, pulls in on walls. */
export function updateCameraRig(rendererState, target, input, options = {}) {
  const { distance = CAMERA.distance, aiming = false, sprint = false, collision = null } = options;
  CAMERA.yaw -= input.mouse.dx * 0.0026;
  CAMERA.pitch -= input.mouse.dy * 0.0022;
  CAMERA.pitch = Math.max(-0.62, Math.min(0.46, CAMERA.pitch));
  const wantDist = aiming ? CAMERA.aimDistance : distance + (sprint ? 1.1 : 0) + (options.speed ? Math.min(4, options.speed * 0.06) : 0);
  CAMERA.distance += (wantDist - CAMERA.distance) * 0.14;

  const dir = new THREE.Vector3(
    Math.sin(CAMERA.yaw) * Math.cos(CAMERA.pitch),
    Math.sin(CAMERA.pitch),
    Math.cos(CAMERA.yaw) * Math.cos(CAMERA.pitch),
  );
  const shoulder = aiming ? 0.85 : 1.0;
  const side = new THREE.Vector3(Math.cos(CAMERA.yaw), 0, -Math.sin(CAMERA.yaw)).multiplyScalar(shoulder * 0.55);
  const pivot = new THREE.Vector3(target.x, target.y + 1.55, target.z).add(side);

  let dist = CAMERA.distance;
  if (collision) dist = collision(pivot, dir, dist);

  const desired = pivot.clone().addScaledVector(dir, dist);
  const lerp = 1 - Math.pow(0.0009, options.dt ?? 0.016);
  CAMERA.pos.lerp(desired, lerp);
  CAMERA.look.lerp(pivot.clone().addScaledVector(dir, -2.5).add(new THREE.Vector3(0, aiming ? 0.1 : -0.05, 0)), lerp);

  const cam = rendererState.camera;
  let shakeX = 0, shakeY = 0;
  if (CAMERA.shake > 0) {
    CAMERA.shake = Math.max(0, CAMERA.shake - (options.dt ?? 0.016) * 2.2);
    shakeX = (Math.random() - 0.5) * CAMERA.shake * 0.35;
    shakeY = (Math.random() - 0.5) * CAMERA.shake * 0.35;
  }
  cam.position.copy(CAMERA.pos).add(new THREE.Vector3(shakeX, shakeY, 0));
  cam.lookAt(CAMERA.look);
  const wantFov = aiming ? 48 : sprint ? 70 : 62;
  if (Math.abs(cam.fov - wantFov) > 1) {
    cam.fov += (wantFov - cam.fov) * 0.08;
    cam.updateProjectionMatrix();
  }
}

/** A downward ray from the pivot toward the camera: if a wall is closer, pull the camera in. */
export function makeCollisionProbe(colliders) {
  return function probe(pivot, dir, maxDist) {
    const back = dir.clone().multiplyScalar(-1);
    let closest = maxDist;
    // Sample along the ray against box colliders' horizontal footprints.
    for (let step = 1.2; step < maxDist + 0.6; step += 0.6) {
      const x = pivot.x + back.x * step;
      const z = pivot.z + back.z * step;
      for (const c of colliders) {
        if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && c.height > pivot.y - 0.6) {
          closest = Math.min(closest, step - 0.5);
          break;
        }
      }
      if (closest < step) break;
    }
    return Math.max(1.1, closest);
  };
}

export function updateRenderWorld(rendererState, dt, focus) {
  rendererState.time += dt;
  rendererState.sparks.update(dt);
  rendererState.smokes.update(dt);
  rendererState.tracers.update(dt);
  rendererState.casings.update(dt);

  const t = rendererState.time;
  const pos = rendererState.sea.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const base = rendererStateSeaBase[i * 3];
    const bz = rendererStateSeaBase[i * 3 + 1];
    pos.array[i * 3 + 2] = Math.sin(t * 0.8 + base * 0.03 + bz * 0.05) * 0.45 + Math.cos(t * 0.5 + bz * 0.02) * 0.3;
  }
  pos.needsUpdate = true;

  // Keep the shadow frustum tight around the action so 2048 texels are enough.
  if (focus) {
    rendererState.sun.target.position.set(focus.x, 0, focus.z);
    rendererState.sun.position.set(focus.x - 420, 260, focus.z - 300);
    rendererState.sun.target.updateMatrixWorld();
  }
  rendererState.sky.position.copy(rendererState.camera.position);

  if (rendererState.wpGroup.visible) {
    rendererState.wpGroup.children[1].rotation.z = t * 1.4;
  }
}

export function render(rendererState) {
  rendererState.renderer.render(rendererState.scene, rendererState.camera);
}

