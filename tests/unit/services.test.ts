import { describe, expect, it } from 'vitest';
import { experienceConfig } from '../../src/config/experience.config';
import { worldAt, worldWindow } from '../../src/experience/schedule';
import { AudioManager } from '../../src/services/AudioManager';
import { parseFlags, selectQuality, type DeviceInfo } from '../../src/services/Quality';

const beats = experienceConfig.timeline;
const desktop: DeviceInfo = { webgl2: true, maxTextureSize: 16384, coarsePointer: false, hardwareConcurrency: 12, deviceMemoryGb: 8, saveData: false, viewportWidth: 1920, viewportHeight: 1080 };
const phone: DeviceInfo = { ...desktop, coarsePointer: true, hardwareConcurrency: 8, viewportWidth: 390, viewportHeight: 844 };

describe('worldAt', () => {
  const { start, end } = worldWindow(beats);
  it('shows nothing outside the window or without worlds', () => {
    expect(worldAt(start - 0.01, beats, 6)).toBeNull();
    expect(worldAt(end, beats, 6)).toBeNull();
    expect(worldAt(start + 1, beats, 0)).toBeNull();
  });
  it('visits every world in order, holding before each crossfade', () => {
    const seen: number[] = [];
    for (let t = start; t < end; t += 0.01) {
      const slot = worldAt(t, beats, 6);
      expect(slot).not.toBeNull();
      if (seen[seen.length - 1] !== slot?.index) seen.push(slot?.index ?? -1);
      expect(slot?.mix).toBeGreaterThanOrEqual(0);
      expect(slot?.mix).toBeLessThanOrEqual(1);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    expect(worldAt(start + 0.01, beats, 6)?.mix).toBe(0);
  });
  it('never crossfades away from the last world', () => {
    expect(worldAt(end - 0.01, beats, 6)).toEqual({ index: 5, next: 5, mix: 0 });
  });
});

describe('selectQuality', () => {
  it('uses device signals', () => {
    expect(selectQuality(desktop, 'auto', null)).toBe('high');
    expect(selectQuality(phone, 'auto', null)).toBe('medium');
    expect(selectQuality({ ...phone, hardwareConcurrency: 4 }, 'auto', null)).toBe('low');
    expect(selectQuality({ ...desktop, webgl2: false }, 'auto', null)).toBe('low');
    expect(selectQuality({ ...desktop, saveData: true }, 'auto', null)).toBe('low');
  });
  it('lets the override and the config win', () => {
    expect(selectQuality(phone, 'auto', 'high')).toBe('high');
    expect(selectQuality(desktop, 'low', null)).toBe('low');
  });
});

describe('parseFlags', () => {
  it('reads valid debug flags', () => {
    expect(parseFlags('?quality=low&speed=4&pauseAt=12.5')).toEqual({ quality: 'low', speed: 4, pauseAt: 12.5 });
  });
  it('ignores invalid values and anything that looks like a destination', () => {
    const f = parseFlags('?quality=ultra&speed=100&pauseAt=-3&url=https://evil.example&next=//evil');
    expect(f).toEqual({ quality: null, speed: 1, pauseAt: null });
    expect(Object.keys(f).sort()).toEqual(['pauseAt', 'quality', 'speed']);
  });
});

describe('AudioManager', () => {
  it('is muted by default and never creates audio before the toggle', () => {
    const audio = new AudioManager(true, 0.5);
    expect(audio.isMuted).toBe(true);
    audio.cue('awaken'); // no context yet: must be a no-op
    audio.setActivation(1);
    audio.dispose();
    expect(audio.toggle()).toBe(true); // disposed: stays silent
  });
  it('toggles state on user request', () => {
    const audio = new AudioManager(true, 0.5);
    expect(audio.toggle()).toBe(false);
    expect(audio.toggle()).toBe(true);
    audio.dispose();
  });
});
