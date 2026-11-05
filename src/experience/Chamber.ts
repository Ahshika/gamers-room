import {
  BackSide,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three';
import { mulberry32 } from '../utils/random';
import { PORTAL_CENTER } from './CameraPath';

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// obsidian below, midnight blue at the horizon, a deep violet glow behind the portal (atmospheric backlight)
const skyFragment = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uGlow;
uniform float uExposure;
void main() {
  float h = vDir.y;
  vec3 col = mix(vec3(0.010, 0.010, 0.022), vec3(0.028, 0.034, 0.085), smoothstep(-0.1, 0.35, h));
  col = mix(col, vec3(0.012, 0.010, 0.030), smoothstep(0.35, 0.9, h));
  float behind = pow(max(0.0, dot(vDir, normalize(vec3(0.0, 0.12, -1.0)))), 6.0);
  col += vec3(0.20, 0.08, 0.42) * behind * (0.35 + 0.9 * uGlow);
  col += vec3(0.05, 0.16, 0.22) * pow(max(0.0, dot(vDir, normalize(vec3(-0.6, 0.25, -0.8)))), 12.0) * uGlow;
  gl_FragColor = vec4(col * uExposure, 1.0);
}`;

export interface ChamberState {
  /** 0..1 portal energy reflected on the architecture. */
  activation: number;
  fogDensity: number;
  /** Matches the renderer exposure, so the unlit sky fades in with the rest of the scene. */
  exposure: number;
}

/** The monumental space between worlds (spec §3): obsidian floor, monoliths, floating ruins, fog. */
export class Chamber {
  readonly group = new Group();
  private readonly fog: FogExp2;
  private readonly sky: ShaderMaterial;
  private readonly accents: MeshStandardMaterial;
  private readonly inlay: MeshBasicMaterial;
  private readonly fill: HemisphereLight;

  constructor(scene: Scene, monolithCount: number, seed = 11) {
    const rnd = mulberry32(seed);
    this.fog = new FogExp2(0x06050f, 0.12);
    scene.fog = this.fog;
    scene.background = new Color(0x020206);

    this.sky = new ShaderMaterial({ vertexShader: skyVertex, fragmentShader: skyFragment, uniforms: { uGlow: { value: 0 }, uExposure: { value: 0 } }, side: BackSide, depthWrite: false, fog: false });
    const sky = new Mesh(new SphereGeometry(140, 32, 16), this.sky);
    sky.renderOrder = -1;
    this.group.add(sky);

    const stone = new MeshStandardMaterial({ color: 0x14131b, roughness: 0.92, metalness: 0.08, flatShading: true });
    const floorMat = new MeshStandardMaterial({ color: 0x0c0b12, roughness: 0.55, metalness: 0.35 });
    const floor = new Mesh(new CircleGeometry(90, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // stepped dais the portal stands on
    for (const [w, h, y] of [
      [12, 0.3, 0.15],
      [9.6, 0.3, 0.45],
      [7.4, 0.3, 0.75],
    ] as const) {
      const step = new Mesh(new CylinderGeometry(w / 2, w / 2 + 0.15, h, 48), stone);
      step.position.set(PORTAL_CENTER.x, y, PORTAL_CENTER.z);
      this.group.add(step);
    }
    // glowing inlaid rings in the floor that catch the portal's energy
    this.inlay = new MeshBasicMaterial({ color: 0xb5852f, transparent: true, opacity: 0.05 });
    for (const r of [7.4, 10.5]) {
      const ring = new Mesh(new RingGeometry(r, r + 0.06, 128), this.inlay);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.012;
      this.group.add(ring);
    }

    // monoliths: huge silhouettes behind and around the portal, some with luminous seams
    this.accents = new MeshStandardMaterial({ color: 0x000000, emissive: new Color(0x2fd8ff), emissiveIntensity: 0.15 });
    const boxGeo = new BoxGeometry(1, 1, 1);
    const monoliths = new InstancedMesh(boxGeo, stone, monolithCount);
    const seams = new InstancedMesh(boxGeo, this.accents, monolithCount);
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const up = new Vector3(0, 1, 0);
    for (let i = 0; i < monolithCount; i++) {
      // spread over ~220° behind the portal, two depth bands, never in the camera corridor (|angle| near +z)
      const side = i % 2 === 0 ? 1 : -1;
      const a = Math.PI / 2 + side * (0.35 + (Math.floor(i / 2) / Math.max(1, monolithCount / 2)) * 1.6) + (rnd() - 0.5) * 0.1;
      const radius = 13 + rnd() * 14;
      const height = 9 + rnd() * 16;
      const width = 1.4 + rnd() * 2.2;
      p.set(Math.cos(a) * radius, height / 2 - 0.5, -Math.sin(a) * radius * 0.9 - 2);
      q.setFromAxisAngle(up, rnd() * Math.PI);
      const depth = 1.4 + rnd() * 1.8;
      s.set(width, height, depth);
      monoliths.setMatrixAt(i, m.compose(p, q, s));
      // a thin luminous seam down one face, standing just proud of the stone
      const seamPos = new Vector3(0, 0, depth / 2 + 0.01).applyQuaternion(q).add(p);
      s.set(0.06, height * 0.8, 0.02);
      seams.setMatrixAt(i, m.compose(seamPos, q, s));
    }
    this.group.add(monoliths, seams);

    // suspended architecture: broken arch segments hanging above, lit only from behind
    const ruins = new InstancedMesh(boxGeo, stone, 7);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.12 + 0.76 * (i / 6));
      p.set(Math.cos(a) * (20 + rnd() * 10), 30 + rnd() * 10, -34 - rnd() * 14);
      q.setFromAxisAngle(new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), 0.5 + rnd() * 1.2);
      s.set(3 + rnd() * 5, 1.2 + rnd() * 2, 2 + rnd() * 3);
      ruins.setMatrixAt(i, m.compose(p, q, s));
    }
    this.group.add(ruins);

    // lighting: dim environmental fill + cold rim from behind; the portal's key light lives in Portal
    this.fill = new HemisphereLight(0x3a42a0, 0x050308, 0.25);
    const rim = new DirectionalLight(0x6a7cff, 0.9);
    rim.position.set(-6, 14, -30);
    const goldAccent = new DirectionalLight(0xd9a24a, 0.18);
    goldAccent.position.set(12, 6, 10);
    this.group.add(this.fill, rim, goldAccent);
  }

  update(state: ChamberState): void {
    this.fog.density = state.fogDensity;
    const glow = this.sky.uniforms.uGlow;
    if (glow) glow.value = state.activation;
    const exposure = this.sky.uniforms.uExposure;
    if (exposure) exposure.value = state.exposure;
    this.accents.emissiveIntensity = 0.15 + state.activation * 1.6;
    this.inlay.opacity = 0.05 + state.activation * 0.55;
    this.fill.intensity = 0.25 + state.activation * 0.25;
  }
}
