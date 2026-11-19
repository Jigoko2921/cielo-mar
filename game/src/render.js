// Three.js presentation: golden-hour light, spring camera, batching and combat effects.
import { PALETTE, clamp, createRandom } from './config.js';
const boxTemplate = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();

/** Accumulates original geometry and vertex colours into a single static draw call. */
export class GeometryBatch {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colours = [];
    this._normalMatrix = new THREE.Matrix3();
    this._point = new THREE.Vector3();
    this._normal = new THREE.Vector3();
  }
  addGeometry(geometry, colour, matrix) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const positions = source.attributes.position;
    const normals = source.attributes.normal;
    const tint = new THREE.Color(colour);
    this._normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < positions.count; i++) {
      this._point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      this._normal.fromBufferAttribute(normals, i).applyMatrix3(this._normalMatrix).normalize();
      this.positions.push(this._point.x, this._point.y, this._point.z);
      this.normals.push(this._normal.x, this._normal.y, this._normal.z);
      this.colours.push(tint.r, tint.g, tint.b);
    }
    if (source !== geometry && source !== boxTemplate) source.dispose();
  }
  box(x, y, z, width, height, depth, colour, rotationY = 0, rotationZ = 0, rotationX = 0) {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, rotationY, rotationZ));
    matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(width, height, depth));
    this.addGeometry(boxTemplate, colour, matrix);
  }
  primitive(geometry, x, y, z, colour, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const matrix = new THREE.Matrix4();
    matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    this.addGeometry(geometry, colour, matrix);
  }
  finish(name, options = {}) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.positions.length ? new THREE.Float32BufferAttribute(this.positions, 3) : new THREE.Float32BufferAttribute([], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colours, 3));
    geometry.computeBoundingSphere();
    const material = options.unlit
      ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
      : new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0.03 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function createSky() {
  const geometry = new THREE.SphereGeometry(1150, 24, 12);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColour: { value: new THREE.Color(PALETTE.skyTop) }, horizonColour: { value: new THREE.Color(PALETTE.skyHorizon) }, night: { value: 0 } },
    vertexShader: 'varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: 'varying vec3 vWorld; uniform vec3 topColour; uniform vec3 horizonColour; uniform float night; void main(){ float h=clamp(normalize(vWorld).y*1.8,0.0,1.0); vec3 c=mix(horizonColour,topColour,pow(h,0.55)); c*=mix(1.0,0.33,night); gl_FragColor=vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'Apricot coastal sky';
  sky.frustumCulled = false;
  return sky;
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,250,220,1)');
  gradient.addColorStop(0.18, 'rgba(255,180,65,0.95)');
  gradient.addColorStop(0.55, 'rgba(255,115,25,0.28)');
  gradient.addColorStop(1, 'rgba(255,90,10,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export class WorldRenderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyHorizon);
    this.scene.fog = new THREE.FogExp2(PALETTE.haze, 0.00118);
    this.camera = new THREE.PerspectiveCamera(61, window.innerWidth / window.innerHeight, 0.15, 1450);
    this.camera.position.set(0, 95, 210);
    this.camera.lookAt(0, 12, 0);
    this.cameraBase = this.camera.position.clone();
    this.shake = 0;
    this.effects = [];
    this.random = createRandom(8841);
    this.glowTexture = createGlowTexture();
    this.sky = createSky();
    this.scene.add(this.sky);
    this.hemisphere = new THREE.HemisphereLight(0x9fc9d6, 0x6b4f36, 0.72);
    this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight(0xffc98a, 3.55);
    this.sun.position.set(-340, 170, 210);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -240;
    this.sun.shadow.camera.right = 240;
    this.sun.shadow.camera.top = 240;
    this.sun.shadow.camera.bottom = -240;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 850;
    this.sun.shadow.bias = -0.00028;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(23, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffdf9a, fog: false }));
    sunDisc.position.set(-640, 165, -720);
    this.scene.add(sunDisc);
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  setNight(amount) {
    this.sky.material.uniforms.night.value = amount;
    this.sun.intensity = 3.55 - amount * 3.5;
    this.hemisphere.intensity = 0.72 - amount * 0.75;
    this.scene.fog.color.setHex(amount > 0.5 ? 0x233943 : PALETTE.haze);
    this.renderer.toneMappingExposure = 1.02 - amount * 0.16;
  }
  followCamera(target, yaw, pitch, distance, aiming, deltaTime, clearance) {
    const cosPitch = Math.cos(pitch);
    const forward = new THREE.Vector3(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch);
    const flatRight = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const focus = target.clone().add(new THREE.Vector3(0, aiming ? 1.45 : 1.25, 0));
    focus.addScaledVector(flatRight, aiming ? 0.55 : 0.8);
    const desired = focus.clone().addScaledVector(forward, -distance);
    desired.y += aiming ? 0.6 : 1.25;
    const safe = clearance ? clearance(focus, desired) : desired;
    const blend = 1 - Math.exp(-deltaTime * 12);
    this.cameraBase.lerp(safe, blend);
    if (this.shake > 0) {
      this.cameraBase.x += (this.random() - 0.5) * this.shake;
      this.cameraBase.y += (this.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - deltaTime * 1.6);
    }
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(focus.clone().addScaledVector(forward, 18));
    const targetFov = aiming ? 52 : 61;
    this.camera.fov += (targetFov - this.camera.fov) * blend;
    this.camera.updateProjectionMatrix();
  }
  snapCamera(position, lookAt, fov = 58) {
    this.cameraBase.copy(position);
    this.camera.position.copy(position);
    this.camera.lookAt(lookAt);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
  addTracer(start, end, colour = 0xffcf76, life = 0.12) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const material = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    this.scene.add(line);
    this.effects.push({ mesh: line, life, maxLife: life, kind: 'fade' });
    return line;
  }
  addMuzzleFlash(position, size = 1.25) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: 0xffc16a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.position.copy(position);
    sprite.scale.set(size, size, size);
    this.scene.add(sprite);
    this.effects.push({ mesh: sprite, life: 0.085, maxLife: 0.085, kind: 'fade' });
  }
  addSparks(position, colour = 0xffb347, count = 5) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.2), new THREE.MeshBasicMaterial({ color: colour, transparent: true }));
      mesh.position.copy(position);
      const velocity = new THREE.Vector3((this.random() - 0.5) * 5, this.random() * 4, (this.random() - 0.5) * 5);
      this.scene.add(mesh);
      this.effects.push({ mesh, velocity, life: 0.45, maxLife: 0.45, kind: 'particle' });
    }
  }
  addExplosion(position) {
    this.addMuzzleFlash(position.clone().add(new THREE.Vector3(0, 2, 0)), 11);
    this.addSparks(position, 0xe4572e, 28);
    this.shake = 0.55;
  }
  updateEffects(deltaTime) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= deltaTime;
      if (effect.kind === 'particle') {
        effect.velocity.y -= 9 * deltaTime;
        effect.mesh.position.addScaledVector(effect.velocity, deltaTime);
      }
      if (effect.mesh.material) effect.mesh.material.opacity = clamp(effect.life / effect.maxLife, 0, 1);
      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry?.dispose();
        effect.mesh.material?.dispose();
        this.effects.splice(i, 1);
      }
    }
  }
  createWaypoint(colour = PALETTE.amber) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.13, 8, 36), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.88, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.85, 13, 20, 1, true), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 6.4;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.1, 4), new THREE.MeshBasicMaterial({ color: colour }));
    arrow.position.y = 5;
    arrow.rotation.z = Math.PI;
    group.add(ring, beam, arrow);
    group.userData.ring = ring;
    this.scene.add(group);
    return group;
  }
  animateWaypoint(marker, elapsed) {
    if (!marker) return;
    marker.userData.ring.rotation.z = elapsed * 0.8;
    marker.position.y = Math.sin(elapsed * 2) * 0.15;
  }
  render() { this.renderer.render(this.scene, this.camera); }
}
