import { Mesh, PlaneGeometry, ShaderMaterial } from 'three';

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0); // full-screen, independent of the camera
}`;

/**
 * Inside the portal (Scene 06): a dimensional tunnel rushing past, which then resolves into the Games
 * Portfolio's own background (#04050a) and its cyan point field, so the navigation is seamless.
 * Written without colour-space conversion on purpose: (4,5,10)/255 lands exactly on #04050a.
 */
const fragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uAmount;
uniform float uResolve;
uniform float uAspect;
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  float z = 0.4 / (r + 0.03) + uTime * 5.0;
  float bands = pow(0.5 + 0.5 * sin(z * 2.0), 6.0);
  float streaks = pow(abs(sin(a * 18.0 + z * 0.15)), 24.0);
  vec3 violet = vec3(0.45, 0.2, 1.0);
  vec3 cyan = vec3(0.2, 0.9, 1.0);
  float swirl = 0.5 + 0.5 * sin(a * 3.0 + z * 0.7 + sin(z * 0.23) * 2.0);
  vec3 tunnel = mix(violet, cyan, swirl) * (0.1 + bands * 0.32 + streaks * 0.55);
  tunnel += mix(cyan, vec3(0.9, 0.95, 1.0), 0.4) * smoothstep(0.22, 0.0, r) * 0.45;
  tunnel *= smoothstep(0.0, 0.15, r) * 0.6 + 0.4;

  vec3 bg = vec3(4.0, 5.0, 10.0) / 255.0;
  vec2 grid = fract(vUv * vec2(uAspect, 1.0) * 28.0) - 0.5;
  float dots = smoothstep(0.08, 0.0, length(grid)) * 0.18 * (1.0 - uResolve * 0.85);
  vec3 portfolio = bg + vec3(0.24, 0.94, 1.0) * dots * uResolve;

  vec3 col = mix(tunnel, portfolio, smoothstep(0.0, 1.0, uResolve));
  col = mix(col, bg, smoothstep(0.85, 1.0, uResolve));
  gl_FragColor = vec4(col, uAmount);
}`;

export class Tunnel {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uResolve: { value: 0 }, uAspect: { value: 1 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100;
    this.mesh.visible = false;
  }

  update(time: number, amount: number, resolve: number, aspect: number): void {
    this.mesh.visible = amount > 0.001;
    const u = this.material.uniforms;
    if (u.uTime) u.uTime.value = time;
    if (u.uAmount) u.uAmount.value = amount;
    if (u.uResolve) u.uResolve.value = resolve;
    if (u.uAspect) u.uAspect.value = aspect;
  }
}
