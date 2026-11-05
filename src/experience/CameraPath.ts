import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import type { TimelineBeats } from '../config/experience.config';

/** Centre of the portal opening; the portal faces +z. */
export const PORTAL_CENTER = new Vector3(0, 4.2, 0);
/** Radius of the energy surface; the camera must cross z=0 well inside it. */
export const PORTAL_OPENING_RADIUS = 2.95;
/** Half-width of the portal's frame and outer ring, kept in view on narrow screens (the spines may crop). */
export const PORTAL_HALF_WIDTH = 4.55;
/** Widest field of view used to fit the portal before the camera has to pull back. */
const MAX_FIT_FOV = 62;
/** While worlds and messages are shown, the portal fills at most this share of the screen height. */
export const PORTAL_MAX_HEIGHT_SHARE = 0.64;

export type CameraStateName =
  | 'openingChamber'
  | 'portalReveal'
  | 'portalActivation'
  | 'worldPreviews'
  | 'messageReveal'
  | 'portalApproach'
  | 'portalEntry'
  | 'portfolioHandoff';

export interface CameraKeyframe {
  name: CameraStateName;
  time: number;
  position: Vector3;
  target: Vector3;
  fov: number;
  /** Keep the whole portal in frame on narrow (portrait) screens by pulling back. */
  fit: boolean;
}

export interface CameraSample {
  position: Vector3;
  target: Vector3;
  fov: number;
}

const c = PORTAL_CENTER;

/** Named camera states (spec §8), timed from the storyboard beats. */
export function buildKeyframes(t: TimelineBeats): CameraKeyframe[] {
  const span = t.end - t.entry;
  return [
    { name: 'openingChamber', time: t.reveal, position: new Vector3(-7, 2.4, 30), target: new Vector3(0, 7, 0), fov: 50, fit: false },
    { name: 'portalReveal', time: t.awaken, position: new Vector3(3.2, 3.2, 18), target: new Vector3(0, 4.8, 0), fov: 45, fit: true },
    { name: 'portalActivation', time: t.worlds, position: new Vector3(-1.6, 4.0, 12.5), target: c.clone(), fov: 42, fit: true },
    { name: 'worldPreviews', time: t.message1, position: new Vector3(0, 4.3, 10.2), target: c.clone(), fov: 40, fit: true },
    { name: 'messageReveal', time: t.fullPower, position: new Vector3(0, 4.3, 10.6), target: c.clone(), fov: 42, fit: true },
    { name: 'portalApproach', time: t.entry, position: new Vector3(0, 4.2, 5.2), target: c.clone(), fov: 46, fit: false },
    { name: 'portalEntry', time: t.entry + span * 0.55, position: new Vector3(0, 4.2, 1.2), target: new Vector3(0, 4.2, -6), fov: 62, fit: false },
    { name: 'portfolioHandoff', time: t.end, position: new Vector3(0, 4.2, -2.6), target: new Vector3(0, 4.2, -12), fov: 76, fit: false },
  ];
}

/**
 * Monotone cubic (Fritsch–Carlson) mapping from time to spline parameter: C1-continuous, so the
 * camera never stops at a keyframe and never runs backwards. Starts at rest (ease in).
 */
function monotoneTangents(xs: readonly number[], ys: readonly number[]): number[] {
  const n = xs.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push(((ys[i + 1] as number) - (ys[i] as number)) / ((xs[i + 1] as number) - (xs[i] as number)));
  const m: number[] = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const a = d[i - 1] as number;
    const b = d[i] as number;
    m[i] = a * b <= 0 ? 0 : (3 * (a + b)) / ((2 * b + a) / a + (b + 2 * a) / b);
  }
  m[0] = 0; // ease in from rest
  m[n - 1] = d[n - 2] as number; // keep moving through the portal at the end
  return m;
}

export class CameraPath {
  readonly keyframes: readonly CameraKeyframe[];
  private readonly times: number[];
  private readonly params: number[];
  private readonly tangents: number[];
  private readonly targetCurve: CatmullRomCurve3;
  private positionCurve!: CatmullRomCurve3;
  private fovs: number[] = [];
  private aspect = 16 / 9;

  constructor(keyframes: CameraKeyframe[]) {
    if (keyframes.length < 2) throw new Error('CameraPath needs at least two keyframes');
    this.keyframes = keyframes;
    this.times = keyframes.map((k) => k.time);
    this.params = keyframes.map((_, i) => i);
    this.tangents = monotoneTangents(this.times, this.params);
    this.targetCurve = new CatmullRomCurve3(keyframes.map((k) => k.target.clone()), false, 'centripetal');
    this.frame();
  }

  /** Re-frames `fit` keyframes for the viewport aspect (portrait pulls back to keep the portal in view). */
  setAspect(aspect: number): void {
    if (!(aspect > 0) || Math.abs(aspect - this.aspect) < 1e-4) return;
    this.aspect = aspect;
    this.frame();
  }

  get duration(): number {
    return this.times[this.times.length - 1] as number;
  }

  /** Spline parameter (0..keyframes-1) at time t. */
  paramAt(t: number): number {
    const xs = this.times;
    const n = xs.length;
    if (t <= (xs[0] as number)) return 0;
    if (t >= (xs[n - 1] as number)) return n - 1;
    let i = 0;
    while (i < n - 2 && t > (xs[i + 1] as number)) i++;
    const x0 = xs[i] as number;
    const h = (xs[i + 1] as number) - x0;
    const s = (t - x0) / h;
    const y0 = this.params[i] as number;
    const y1 = this.params[i + 1] as number;
    const m0 = this.tangents[i] as number;
    const m1 = this.tangents[i + 1] as number;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * m1;
  }

  sample(t: number, out?: CameraSample): CameraSample {
    const n = this.keyframes.length;
    const p = MathUtils.clamp(this.paramAt(t), 0, n - 1);
    const u = p / (n - 1);
    const result = out ?? { position: new Vector3(), target: new Vector3(), fov: 45 };
    this.positionCurve.getPoint(u, result.position);
    this.targetCurve.getPoint(u, result.target);
    const i = Math.min(n - 2, Math.floor(p));
    const f = p - i;
    result.fov = MathUtils.lerp(this.fovs[i] as number, this.fovs[i + 1] as number, f * f * (3 - 2 * f));
    return result;
  }

  /**
   * Fits `fit` keyframes to the aspect: on narrow screens the field of view widens first (up to
   * MAX_FIT_FOV), and only then does the camera pull back, so the portal never sinks into the fog.
   */
  private frame(): void {
    const DEPTH = 1.2; // the frame stands out in front of the opening
    const fovs: number[] = [];
    const points = this.keyframes.map((k) => {
      fovs.push(k.fov);
      if (!k.fit) return k.position.clone();
      const offset = k.position.clone().sub(k.target);
      const distance = offset.length();
      // tan(vfov/2) needed so the portal fits the width, and fills at most PORTAL_MAX_HEIGHT_SHARE of
      // the height (room above and below for the messages)
      const tanNeeded = Math.max(PORTAL_HALF_WIDTH / this.aspect, PORTAL_HALF_WIDTH / PORTAL_MAX_HEIGHT_SHARE) / (distance - DEPTH);
      const wanted = MathUtils.radToDeg(2 * Math.atan(tanNeeded));
      if (wanted <= k.fov) return k.position.clone();
      if (wanted <= MAX_FIT_FOV) {
        fovs[fovs.length - 1] = wanted;
        return k.position.clone();
      }
      fovs[fovs.length - 1] = MAX_FIT_FOV;
      const tanMax = Math.tan(MathUtils.degToRad(MAX_FIT_FOV) / 2);
      const needed = (tanNeeded * (distance - DEPTH)) / tanMax + DEPTH;
      return k.target.clone().add(offset.multiplyScalar(needed / distance));
    });
    this.fovs = fovs;
    this.positionCurve = new CatmullRomCurve3(points, false, 'centripetal');
  }
}
