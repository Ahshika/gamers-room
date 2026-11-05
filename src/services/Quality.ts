import type { ExperienceConfig, QualityLevel } from '../config/experience.config';

export interface DeviceInfo {
  webgl2: boolean;
  maxTextureSize: number;
  coarsePointer: boolean;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  saveData: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

const LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

/** Initial preset from device signals. Pure, so it is unit-tested. */
export function selectQuality(d: DeviceInfo, configured: ExperienceConfig['quality']['default'], override: QualityLevel | null): QualityLevel {
  if (override) return override;
  if (configured !== 'auto') return configured;
  const lowCores = d.hardwareConcurrency !== null && d.hardwareConcurrency <= 4;
  if (!d.webgl2 || d.maxTextureSize < 4096 || d.saveData || (d.deviceMemoryGb !== null && d.deviceMemoryGb <= 2) || (d.coarsePointer && lowCores)) {
    return 'low';
  }
  if (d.coarsePointer || Math.min(d.viewportWidth, d.viewportHeight) < 600) return 'medium';
  if (d.viewportWidth >= 1280 && d.hardwareConcurrency !== null && d.hardwareConcurrency >= 8) return 'high';
  return 'medium';
}

export interface DebugFlags {
  quality: QualityLevel | null;
  /** Timeline speed multiplier, 0.25–8. */
  speed: number;
  /** Freeze the timeline at this second (visual QA). */
  pauseAt: number | null;
}

/** Debug flags from the query string. None of them can influence where the visitor is sent. */
export function parseFlags(search: string): DebugFlags {
  const q = new URLSearchParams(search);
  const quality = q.get('quality');
  const speed = Number(q.get('speed'));
  const pauseAtRaw = q.get('pauseAt');
  const pauseAt = pauseAtRaw === null ? Number.NaN : Number(pauseAtRaw);
  return {
    quality: LEVELS.includes(quality as QualityLevel) ? (quality as QualityLevel) : null,
    speed: Number.isFinite(speed) && speed >= 0.25 && speed <= 8 ? speed : 1,
    pauseAt: Number.isFinite(pauseAt) && pauseAt >= 0 && pauseAt <= 60 ? pauseAt : null,
  };
}

/** WebGL probe on a throwaway canvas; null when WebGL is unavailable. */
export function probeDevice(win: Window = window): DeviceInfo | null {
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  let webgl2 = false;
  try {
    const canvas = win.document.createElement('canvas');
    gl = canvas.getContext('webgl2');
    webgl2 = gl !== null;
    gl ??= canvas.getContext('webgl');
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  const nav = win.navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    webgl2,
    maxTextureSize,
    coarsePointer: win.matchMedia('(pointer: coarse)').matches,
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    saveData: nav.connection?.saveData === true,
    viewportWidth: win.innerWidth,
    viewportHeight: win.innerHeight,
  };
}
