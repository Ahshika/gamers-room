import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, type Vector3 } from 'three';
import { mulberry32 } from '../utils/random';

const vertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uPull;
uniform vec3 uCenter;
uniform float uSize;
uniform float uPixelRatio;
varying float vFade;
varying float vHue;
void main() {
  float speed = 0.5 + aSeed.w;
  float ang = aSeed.x * 6.2831853 + uTime * 0.04 * speed;
  float rad = mix(3.5, 20.0, aSeed.y);
  vec3 free = vec3(cos(ang) * rad, mix(0.3, 15.0, aSeed.z), sin(ang) * rad * 0.7 - 3.0);
  // when the portal pulls, each particle streams in along a tightening spiral, then respawns
  float phase = fract(aSeed.w * 7.31 + uTime * (0.03 + 0.09 * aSeed.w) * (0.4 + 1.6 * uPull));
  float k = smoothstep(0.0, 1.0, phase);
  float spin = ang * 2.0 + k * 9.0;
  vec3 spiral = uCenter + vec3(cos(spin), sin(spin), 0.0) * (1.0 - k) * min(rad, 7.0);
  vec3 pos = mix(free, mix(free, spiral, k), uPull);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed.z) / max(0.5, -mv.z);
  vFade = (1.0 - uPull * smoothstep(0.82, 1.0, phase)) * smoothstep(60.0, 10.0, -mv.z);
  vHue = aSeed.x;
}`;

const fragment = /* glsl */ `
precision highp float;
varying float vFade;
varying float vHue;
uniform float uIntensity;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float soft = smoothstep(0.25, 0.0, d);
  vec3 cyan = vec3(0.25, 0.9, 1.0);
  vec3 violet = vec3(0.65, 0.4, 1.0);
  vec3 gold = vec3(1.0, 0.75, 0.4);
  vec3 col = vHue < 0.45 ? cyan : (vHue < 0.9 ? violet : gold);
  gl_FragColor = vec4(col * soft * uIntensity * vFade, 1.0);
}`;

/** Dimensional particles (spec §9). One draw call; motion is computed on the GPU from a seed. */
export class Particles {
  readonly points: Points;
  private readonly material: ShaderMaterial;

  constructor(count: number, center: Vector3, pixelRatio: number, seed = 23) {
    const rnd = mulberry32(seed);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    const geometry = new BufferGeometry();
    // positions are computed in the shader; a dummy attribute keeps three.js happy
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    this.material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: { value: 0 },
        uPull: { value: 0 },
        uCenter: { value: center.clone() },
        uSize: { value: 42 },
        uPixelRatio: { value: pixelRatio },
        uIntensity: { value: 0.4 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  update(time: number, pull: number, intensity: number): void {
    const u = this.material.uniforms;
    if (u.uTime) u.uTime.value = time;
    if (u.uPull) u.uPull.value = pull;
    if (u.uIntensity) u.uIntensity.value = intensity;
  }

  setPixelRatio(pr: number): void {
    const u = this.material.uniforms.uPixelRatio;
    if (u) u.value = pr;
  }
}
