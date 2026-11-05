import type { TimelineBeats } from '../config/experience.config';

export interface WorldSlot {
  index: number;
  next: number;
  /** 0..1 crossfade from `index` to `next`. */
  mix: number;
}

/** Worlds are shown from the `worlds` beat until shortly before full power. */
export function worldWindow(t: TimelineBeats): { start: number; end: number } {
  return { start: t.worlds, end: t.fullPower - 0.6 };
}

/**
 * Which world is on the portal surface at time `time`. Each world holds, then crossfades into the
 * next during the last quarter of its slot. Null outside the window or when there are no worlds.
 */
export function worldAt(time: number, beats: TimelineBeats, count: number): WorldSlot | null {
  if (count <= 0) return null;
  const { start, end } = worldWindow(beats);
  if (time < start || time >= end) return null;
  const f = ((time - start) / (end - start)) * count;
  const index = Math.min(count - 1, Math.floor(f));
  const local = f - index;
  const next = Math.min(count - 1, index + 1);
  const x = Math.min(1, Math.max(0, (local - 0.75) / 0.25));
  return { index, next, mix: next === index ? 0 : x * x * (3 - 2 * x) };
}
