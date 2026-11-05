import { DataTexture, MathUtils } from 'three';
import { describe, expect, it } from 'vitest';
import { experienceConfig } from '../../src/config/experience.config';
import { CameraPath, PORTAL_CENTER, PORTAL_HALF_WIDTH, PORTAL_MAX_HEIGHT_SHARE, PORTAL_OPENING_RADIUS, buildKeyframes } from '../../src/experience/CameraPath';
import { Portal } from '../../src/experience/Portal';

const beats = experienceConfig.timeline;
const ASPECTS = { desktop: 16 / 9, tablet: 4 / 3, phone: 390 / 844 };
const radial = (x: number, y: number) => Math.hypot(x - PORTAL_CENTER.x, y - PORTAL_CENTER.y);

describe('camera states (spec §8)', () => {
  it('defines every required state, in story order', () => {
    const k = buildKeyframes(beats);
    expect(k.map((s) => s.name)).toEqual(['openingChamber', 'portalReveal', 'portalActivation', 'worldPreviews', 'messageReveal', 'portalApproach', 'portalEntry', 'portfolioHandoff']);
    for (let i = 1; i < k.length; i++) expect((k[i]?.time ?? 0) > (k[i - 1]?.time ?? 0)).toBe(true);
    expect(k[k.length - 1]?.time).toBe(beats.end);
  });

  it('never stops or runs backwards along the path', () => {
    const path = new CameraPath(buildKeyframes(beats));
    let prev = -1;
    for (let t = 0; t <= beats.end; t += 0.01) {
      const p = path.paramAt(t);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = p;
    }
    expect(path.paramAt(0)).toBe(0);
    expect(path.paramAt(beats.end)).toBe(7);
  });

  for (const [label, aspect] of Object.entries(ASPECTS)) {
    describe(label, () => {
      const path = new CameraPath(buildKeyframes(beats));
      path.setAspect(aspect);
      const samples = Array.from({ length: 4801 }, (_, i) => ({ t: (i / 4800) * beats.end, ...path.sample((i / 4800) * beats.end) }));

      it('crosses the portal plane well inside the opening (no clipping through the frame)', () => {
        const crossing = samples.findIndex((s, i) => i > 0 && (samples[i - 1]?.position.z ?? 0) > 0 && s.position.z <= 0);
        expect(crossing).toBeGreaterThan(0);
        const at = samples[crossing];
        expect(radial(at?.position.x ?? 99, at?.position.y ?? 99)).toBeLessThan(PORTAL_OPENING_RADIUS * 0.25);
        expect(at?.t).toBeGreaterThan(beats.entry);
      });

      it('stays clear of the frame and structure depth around the plane', () => {
        for (const s of samples) {
          if (Math.abs(s.position.z) < 1.6) expect(radial(s.position.x, s.position.y)).toBeLessThan(PORTAL_OPENING_RADIUS - 0.6);
        }
      });

      it('stays above the floor and the dais', () => {
        for (const s of samples) expect(s.position.y).toBeGreaterThan(1.2);
      });

      it('keeps the whole portal in frame while worlds and messages are shown', () => {
        for (const name of ['worldPreviews', 'messageReveal'] as const) {
          const k = path.keyframes.find((x) => x.name === name);
          const s = path.sample(k?.time ?? 0);
          const distance = s.position.distanceTo(s.target);
          const halfH = Math.tan(MathUtils.degToRad(s.fov) / 2) * (distance - 1.2);
          expect(halfH * aspect).toBeGreaterThanOrEqual(PORTAL_HALF_WIDTH - 1e-6);
          // room above and below the portal for the messages
          expect(PORTAL_HALF_WIDTH / halfH).toBeLessThanOrEqual(PORTAL_MAX_HEIGHT_SHARE + 1e-6);
        }
      });
    });
  }
});

describe('portal fragments', () => {
  // the largest fragment reaches ~1.4 from its centre; the frame's back face is at z = -0.58
  it('stay out of the camera corridor and behind the frame at every energy level', () => {
    const portal = new Portal(new DataTexture(new Uint8Array(4), 1, 1), 20);
    for (let step = 0; step <= 400; step++) {
      const a = Math.min(1, step / 200);
      portal.update({ time: step * 0.05, activation: a, inscription: a, pulse: 0, worldAmount: 0, worldMix: 0, depth: a, }, 0.05);
      for (const p of portal.fragmentPositions) {
        expect(Math.hypot(p.x, p.y) - 1.4).toBeGreaterThan(2.0);
        expect(p.z + 0.65).toBeLessThan(-0.58);
      }
    }
  });
});
