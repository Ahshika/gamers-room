import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
  type Texture,
} from 'three';
import { mulberry32 } from '../utils/random';
import { PORTAL_CENTER, PORTAL_OPENING_RADIUS } from './CameraPath';

export interface PortalState {
  time: number;
  /** 0 dormant → 1 fully active. */
  activation: number;
  /** 0..1: how far the inscriptions are lit (sweeps from the keystone down both sides). */
  inscription: number;
  /** Short pulse 0..1 (awakening, full power). */
  pulse: number;
  /** 0..1: world preview visibility on the surface. */
  worldAmount: number;
  worldMix: number;
  /** 0..1: dimensional depth (tunnel rings) at full power. */
  depth: number;
}

const surfaceVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const surfaceFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uActivation;
uniform float uPulse;
uniform float uWorldAmount;
uniform float uWorldMix;
uniform float uDepth;
uniform sampler2D uWorldA;
uniform sampler2D uWorldB;
uniform vec3 uTintA;
uniform vec3 uTintB;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = uTime;

  // swirling dimensional energy: rotation increases toward the centre
  float swirl = a + t * 0.35 + 1.8 / (r + 0.35);
  vec2 q = vec2(cos(swirl), sin(swirl)) * r;
  float n = fbm(q * 3.0 + vec2(t * 0.15, -t * 0.1));
  float filaments = pow(abs(sin(swirl * 3.0 + n * 6.0 - t)), 6.0);

  vec3 violet = vec3(0.50, 0.22, 1.00);
  vec3 cyan = vec3(0.18, 0.85, 1.00);
  vec3 gold = vec3(1.00, 0.70, 0.30);
  vec3 obsidian = vec3(0.012, 0.010, 0.030);

  vec3 energy = mix(violet, cyan, n * n) * (0.12 + 0.55 * filaments);
  energy += gold * pow(n, 6.0) * 0.35;

  // depth: rings rushing into the centre (log-polar), stronger at full power
  float z = -log(r + 0.002) * 1.6 + t * (0.6 + uDepth * 1.6);
  float rings = pow(0.5 + 0.5 * sin(z * 6.2831), 8.0) * smoothstep(1.0, 0.1, r);
  energy += mix(cyan, violet, 0.5 + 0.5 * sin(z * 1.3)) * rings * (0.08 + uDepth * 0.45);
  energy += mix(violet, cyan, 0.6) * smoothstep(0.3, 0.0, r) * (0.1 + 0.45 * uDepth) * uActivation;

  // dormant: dark glass with a faint slow swirl
  vec3 dormant = obsidian * 0.4 + violet * 0.012 * n;
  vec3 col = mix(dormant, energy, uActivation);

  // world previews: seen through a gently warped lens, framed by energy at the rim
  vec2 lens = p * (0.92 + 0.08 * r) * 0.5 + 0.5;
  lens += vec2(sin(t * 0.7 + p.y * 3.0), cos(t * 0.6 + p.x * 3.0)) * 0.006 * (1.0 + 4.0 * (1.0 - uWorldAmount));
  vec3 worldA = texture2D(uWorldA, lens).rgb;
  vec3 worldB = texture2D(uWorldB, lens).rgb;
  vec3 world = mix(worldA, worldB, uWorldMix);
  vec3 tint = mix(uTintA, uTintB, uWorldMix);
  float worldMask = smoothstep(0.98, 0.62, r) * uWorldAmount;
  col = mix(col, world, worldMask);
  col += tint * filaments * 0.25 * uWorldAmount * smoothstep(0.5, 0.95, r);

  // rim and pulse
  float rim = smoothstep(0.78, 0.99, r);
  col += mix(violet, cyan, 0.5 + 0.5 * sin(a * 2.0 + t)) * rim * (0.1 + 0.6 * uActivation);
  col += mix(violet, cyan, r) * uPulse * smoothstep(0.3, 1.0, r) * 0.35;

  float alpha = smoothstep(1.0, 0.975, r);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const inscriptionFragment = /* glsl */ `
precision highp float;
varying vec2 vPos;
uniform float uLit;
uniform float uTime;
uniform float uInner;
uniform float uOuter;
float hash(float x) { return fract(sin(x * 91.17) * 43758.5453); }
void main() {
  float r = length(vPos);
  float ang = atan(vPos.y, vPos.x);            // -pi..pi, 0 at +x
  float fromTop = abs(mod(ang - 1.5707963 + 3.1415926, 6.2831853) - 3.1415926) / 3.1415926; // 0 top .. 1 bottom
  float cells = 72.0;
  float u = (ang + 3.1415926) / 6.2831853 * cells;
  float cell = floor(u);
  float fu = fract(u);
  float fr = (r - uInner) / (uOuter - uInner);
  // a glyph: up to three strokes per cell chosen by hash; a horizontal bar on some
  float h = hash(cell);
  float stroke = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float x = 0.22 + 0.28 * fk;
    float on = step(0.35, fract(h * (3.7 + fk * 5.3)));
    float y0 = 0.18 + 0.3 * fract(h * (7.1 + fk));
    stroke += on * step(abs(fu - x), 0.055) * step(y0, fr) * step(fr, 0.84);
  }
  stroke += step(0.6, h) * step(abs(fr - 0.5), 0.05) * step(0.18, fu) * step(fu, 0.82);
  stroke = clamp(stroke, 0.0, 1.0);
  float lit = smoothstep(uLit * 1.05, uLit * 1.05 - 0.06, fromTop);
  float flicker = 0.85 + 0.15 * sin(uTime * 7.0 + cell * 1.7);
  vec3 metal = vec3(0.012, 0.011, 0.016) + vec3(0.008) * smoothstep(0.0, 0.1, fr) * smoothstep(1.0, 0.9, fr);
  vec3 engraved = vec3(0.03, 0.02, 0.01);
  vec3 glow = vec3(1.0, 0.68, 0.28) * 2.2 * flicker;
  vec3 col = mix(metal, mix(engraved, glow, lit), stroke);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const runnerFragment = /* glsl */ `
precision highp float;
varying vec2 vPos;
uniform float uTime;
uniform float uActivation;
void main() {
  float ang = atan(vPos.y, vPos.x) / 6.2831853 + 0.5;
  float comets = pow(fract(ang * 3.0 - uTime * 0.45), 10.0) + pow(fract(-ang * 2.0 - uTime * 0.31), 12.0);
  vec3 col = mix(vec3(0.5, 0.25, 1.0), vec3(0.2, 0.9, 1.0), fract(ang * 3.0 - uTime * 0.45)) * (0.15 + comets * 2.5);
  gl_FragColor = vec4(col * uActivation, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const polarVertex = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** The signature object (spec §6): stone frame, gold keystones, inscribed ring, energy rings, surface. */
export class Portal {
  readonly group = new Group();
  readonly light: PointLight;
  private readonly surface: ShaderMaterial;
  private readonly inscription: ShaderMaterial;
  private readonly runner: ShaderMaterial;
  private readonly orbitRings: Mesh[] = [];
  /** `y` is the fragment's depth behind the portal plane (local z). */
  private readonly fragments: { mesh: Object3D; radius: number; angle: number; speed: number; y: number; bob: number }[] = [];
  private readonly crystal: MeshStandardMaterial;
  private readonly keystoneMaterial: MeshStandardMaterial;

  constructor(blank: Texture, fragmentCount: number, seed = 7) {
    const rnd = mulberry32(seed);
    this.group.position.copy(PORTAL_CENTER);

    const stone = new MeshStandardMaterial({ color: 0x1c1a25, roughness: 0.86, metalness: 0.12, flatShading: true });
    const darkMetal = new MeshStandardMaterial({ color: 0x23242f, roughness: 0.32, metalness: 0.9 });
    this.keystoneMaterial = new MeshStandardMaterial({ color: 0x8a6a2e, roughness: 0.38, metalness: 0.85, emissive: new Color(0xb5852f), emissiveIntensity: 0.05 });

    // 1. main architectural frame: weathered voussoir blocks
    const blocks = 30;
    const frameRadius = 3.72;
    const blockGeo = new BoxGeometry(0.95, (2 * Math.PI * frameRadius) / blocks * 0.9, 1.15);
    const frame = new InstancedMesh(blockGeo, stone, blocks);
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const z = new Vector3(0, 0, 1);
    const keystoneAngles: number[] = [];
    for (let i = 0; i < blocks; i++) {
      const a = (i / blocks) * Math.PI * 2 + Math.PI / 2;
      if (i % (blocks / 5) === 0) keystoneAngles.push(a);
      const wear = 0.9 + rnd() * 0.2;
      p.set(Math.cos(a) * frameRadius, Math.sin(a) * frameRadius, (rnd() - 0.5) * 0.08);
      q.setFromAxisAngle(z, a);
      s.set(wear, 1, 0.92 + rnd() * 0.16);
      frame.setMatrixAt(i, m.compose(p, q, s));
    }
    this.group.add(frame);

    // gold keystones on five points of the ring
    const keyGeo = new BoxGeometry(1.05, 0.44, 1.28);
    const keys = new InstancedMesh(keyGeo, this.keystoneMaterial, keystoneAngles.length);
    keystoneAngles.forEach((a, i) => {
      p.set(Math.cos(a) * (frameRadius + 0.08), Math.sin(a) * (frameRadius + 0.08), 0);
      q.setFromAxisAngle(z, a);
      keys.setMatrixAt(i, m.compose(p, q, s.set(1, 1, 1)));
    });
    this.group.add(keys);

    // 2. outer mechanical structure: a dark metal ring with radial spines (silhouette)
    const outer = new Mesh(new TorusGeometry(4.45, 0.07, 8, 160), darkMetal);
    outer.position.z = -0.35;
    this.group.add(outer);
    const spineGeo = new ConeGeometry(0.11, 1.1, 6);
    const spines = new InstancedMesh(spineGeo, darkMetal, 12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      p.set(Math.cos(a) * 4.85, Math.sin(a) * 4.85, -0.35);
      q.setFromAxisAngle(z, a - Math.PI / 2);
      spines.setMatrixAt(i, m.compose(p, q, s.set(1, 1, 1)));
    }
    this.group.add(spines);

    // 5. inscribed metal ring (runes light up during the awakening)
    this.inscription = new ShaderMaterial({
      vertexShader: polarVertex,
      fragmentShader: inscriptionFragment,
      uniforms: { uLit: { value: 0 }, uTime: { value: 0 }, uInner: { value: 3.0 }, uOuter: { value: 3.24 } },
      side: DoubleSide,
    });
    const insc = new Mesh(new RingGeometry(3.0, 3.24, 256, 1), this.inscription);
    insc.position.z = 0.58;
    this.group.add(insc);

    // 3. inner energy runner (energy travelling around the structure)
    this.runner = new ShaderMaterial({
      vertexShader: polarVertex,
      fragmentShader: runnerFragment,
      uniforms: { uTime: { value: 0 }, uActivation: { value: 0 } },
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const runner = new Mesh(new RingGeometry(2.95, 3.0, 256, 1), this.runner);
    runner.position.z = 0.6;
    this.group.add(runner);

    // 3b. counter-rotating energy rings around the opening
    for (const [radius, color, tilt] of [
      [3.35, 0x2fe0ff, 0.18],
      [3.55, 0x8a4dff, -0.24],
    ] as const) {
      const ring = new Mesh(
        new TorusGeometry(radius, 0.018, 6, 200),
        new MeshStandardMaterial({ color: 0x000000, emissive: new Color(color), emissiveIntensity: 0, transparent: true, opacity: 0.9 }),
      );
      ring.rotation.x = tilt;
      this.orbitRings.push(ring);
      this.group.add(ring);
    }

    // 7. energy surface with the worlds behind it
    this.surface = new ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      uniforms: {
        uTime: { value: 0 },
        uActivation: { value: 0 },
        uPulse: { value: 0 },
        uWorldAmount: { value: 0 },
        uWorldMix: { value: 0 },
        uDepth: { value: 0 },
        uWorldA: { value: blank },
        uWorldB: { value: blank },
        uTintA: { value: new Color(0x8a4dff) },
        uTintB: { value: new Color(0x8a4dff) },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    const surface = new Mesh(new CircleGeometry(PORTAL_OPENING_RADIUS, 160), this.surface);
    surface.position.z = 0.02;
    surface.renderOrder = 2;
    this.group.add(surface);

    // 4. floating fragments of stone and crystal around the gateway
    this.crystal = new MeshStandardMaterial({ color: 0x150c2e, roughness: 0.15, metalness: 0.3, emissive: new Color(0x6a3dff), emissiveIntensity: 0.05, flatShading: true });
    const shardGeo = new IcosahedronGeometry(1, 0);
    for (let i = 0; i < fragmentCount; i++) {
      const isCrystal = i % 3 === 0;
      const mesh = new Mesh(shardGeo, isCrystal ? this.crystal : stone);
      const scale = 0.18 + rnd() * 0.45;
      mesh.scale.set(scale * (0.6 + rnd()), scale * (0.8 + rnd() * 1.4), scale * (0.6 + rnd()));
      mesh.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
      const frag = { mesh, radius: 5.4 + rnd() * 3.2, angle: rnd() * Math.PI * 2, speed: (0.03 + rnd() * 0.05) * (rnd() < 0.5 ? -1 : 1), y: -1.9 - rnd() * 1.8, bob: rnd() * 10 };
      this.fragments.push(frag);
      this.group.add(mesh);
    }

    // key light from the portal
    this.light = new PointLight(0x9b70ff, 0, 34, 1.6);
    this.light.position.set(0, 0, 1.6);
    this.group.add(this.light);
  }

  /** Current fragment positions in portal space (tests check they stay out of the camera corridor). */
  get fragmentPositions(): Vector3[] {
    return this.fragments.map((f) => f.mesh.position.clone());
  }

  setWorlds(a: Texture, b: Texture, tintA: Color, tintB: Color): void {
    const u = this.surface.uniforms;
    if (u.uWorldA) u.uWorldA.value = a;
    if (u.uWorldB) u.uWorldB.value = b;
    (u.uTintA?.value as Color | undefined)?.copy(tintA);
    (u.uTintB?.value as Color | undefined)?.copy(tintB);
  }

  update(state: PortalState, dt: number): void {
    const u = this.surface.uniforms;
    const set = (key: string, v: number) => {
      const uniform = u[key];
      if (uniform) uniform.value = v;
    };
    set('uTime', state.time);
    set('uActivation', state.activation);
    set('uPulse', state.pulse);
    set('uWorldAmount', state.worldAmount);
    set('uWorldMix', state.worldMix);
    set('uDepth', state.depth);
    const iu = this.inscription.uniforms;
    if (iu.uLit) iu.uLit.value = state.inscription;
    if (iu.uTime) iu.uTime.value = state.time;
    const ru = this.runner.uniforms;
    if (ru.uTime) ru.uTime.value = state.time;
    if (ru.uActivation) ru.uActivation.value = state.activation;

    this.keystoneMaterial.emissiveIntensity = 0.03 + state.inscription * 0.32;
    this.crystal.emissiveIntensity = 0.05 + state.activation * 1.4;
    this.orbitRings.forEach((ring, i) => {
      ring.rotation.z += dt * (i === 0 ? 0.25 : -0.18) * (0.3 + state.activation * 1.8);
      (ring.material as MeshStandardMaterial).emissiveIntensity = state.activation * 2.2 + state.pulse * 2;
    });
    // fragments orbit the opening in its own plane (never near the axis the camera flies along),
    // slightly behind it, and lean in toward the portal as it powers up
    for (const f of this.fragments) {
      f.angle += f.speed * dt * (1 + state.activation * 1.5);
      const r = f.radius * (1 - 0.08 * state.activation - 0.05 * state.depth);
      const bob = Math.sin(state.time * 0.6 + f.bob) * 0.25;
      f.mesh.position.set(Math.cos(f.angle) * r, Math.sin(f.angle) * r * 0.85 + bob, f.y);
      f.mesh.rotation.x += dt * 0.12;
      f.mesh.rotation.y += dt * 0.08;
    }
    this.light.intensity = 2 + state.activation * 70 + state.pulse * 40 + state.depth * 30;
    this.light.color.setHSL(0.72 - state.depth * 0.18, 0.85, 0.62);
  }
}
