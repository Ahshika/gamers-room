import { gsap } from 'gsap';
import { DataTexture, RGBAFormat, type Texture } from 'three';
import type { ExperienceConfig, QualityPreset } from '../config/experience.config';
import type { WorldPreview } from '../data/realms';
import type { Architecture } from './Architecture';
import { CameraPath, PORTAL_CENTER, buildKeyframes, type CameraSample } from './CameraPath';
import { Chamber } from './Chamber';
import { Particles } from './Particles';
import { Portal } from './Portal';
import type { Stage } from './Stage';
import { Tunnel } from './Tunnel';
import type { WorldTexture } from './WorldTextures';
import { worldAt } from './schedule';

export type Cue = 'awaken' | 'surge' | 'entry';

export interface ExperienceEvents {
  /** 0: first message, 1: both messages, null: hidden. */
  onMessage(step: 0 | 1 | null): void;
  onWorld(preview: WorldPreview | null): void;
  onCue(cue: Cue): void;
  onEnergy(activation: number): void;
  /** The camera is through the portal and the view has resolved into the portfolio background. */
  onEnd(): void;
}

/** Everything the timeline animates. One object, so every system reads the same clock. */
interface StoryState {
  exposure: number;
  fog: number;
  activation: number;
  inscription: number;
  pulse: number;
  worldAmount: number;
  depth: number;
  pull: number;
  particles: number;
  entry: number;
  resolve: number;
}

/** Scenes 01–06 (docs/STORYBOARD.md) on one GSAP timeline driven by our own clock. */
export class Experience {
  private readonly chamber: Chamber;
  private readonly portal: Portal;
  private readonly particles: Particles;
  private readonly tunnel = new Tunnel();
  private readonly path: CameraPath;
  private readonly timeline: gsap.core.Timeline;
  private readonly blank: Texture;
  private readonly sample: CameraSample;
  private readonly state: StoryState = { exposure: 0, fog: 0.12, activation: 0, inscription: 0, pulse: 0, worldAmount: 0, depth: 0, pull: 0, particles: 0.25, entry: 0, resolve: 0 };
  private elapsed = 0;
  private lastWorld = -2;
  private ended = false;

  constructor(
    private readonly stage: Stage,
    private readonly config: ExperienceConfig,
    preset: QualityPreset,
    private readonly worlds: readonly WorldTexture[],
    private readonly events: ExperienceEvents,
    private readonly options: { speed: number; pauseAt: number | null; calm: boolean },
    architecture: Architecture = { portal: null, chamber: null },
  ) {
    this.blank = new DataTexture(new Uint8Array([3, 3, 8, 255]), 1, 1, RGBAFormat);
    this.blank.needsUpdate = true;
    this.chamber = new Chamber(stage.scene, preset.monoliths, architecture.chamber);
    this.portal = new Portal(this.blank, preset.fragments, architecture.portal);
    this.particles = new Particles(preset.particles, PORTAL_CENTER, stage.pixelRatio);
    stage.scene.add(this.chamber.group, this.portal.group, this.particles.points, this.tunnel.mesh);

    this.path = new CameraPath(buildKeyframes(config.timeline));
    this.path.setAspect(stage.aspect);
    stage.onAspect = (aspect) => {
      this.path.setAspect(aspect);
      this.particles.setPixelRatio(stage.pixelRatio);
    };
    this.sample = { position: stage.camera.position.clone(), target: PORTAL_CENTER.clone(), fov: 45 };
    this.timeline = options.calm ? this.buildCalm() : this.buildTimeline();
    if (worlds[0]) this.portal.setWorlds(worlds[0].texture, worlds[0].texture, worlds[0].tint, worlds[0].tint);
  }

  /** Total length of the story in timeline seconds. */
  get duration(): number {
    return this.timeline.duration();
  }

  get time(): number {
    return this.elapsed;
  }

  /** Which parts use the Blender models (the rest is the procedural fallback). */
  get modelled(): { portal: boolean; chamber: boolean } {
    return { portal: this.portal.usesModel, chamber: this.chamber.usesModel };
  }

  update(dt: number): void {
    if (this.options.pauseAt === null || this.elapsed < this.options.pauseAt) {
      this.elapsed = Math.min(this.duration, this.elapsed + dt * this.options.speed);
      if (this.options.pauseAt !== null) this.elapsed = Math.min(this.elapsed, this.options.pauseAt);
    }
    this.timeline.time(this.elapsed);
    const s = this.state;
    const t = this.elapsed;
    const beats = this.config.timeline;

    // camera
    const camT = this.options.calm ? beats.message1 : t;
    this.path.sample(camT, this.sample);
    const cam = this.stage.camera;
    cam.position.copy(this.sample.position);
    cam.lookAt(this.sample.target);
    if (Math.abs(cam.fov - this.sample.fov) > 1e-3) {
      cam.fov = this.sample.fov;
      cam.updateProjectionMatrix();
    }

    // worlds behind the portal
    const slot = this.options.calm ? (this.worlds.length ? { index: 0, next: 0, mix: 0 } : null) : worldAt(t, beats, this.worlds.length);
    const shown = slot ? (slot.mix > 0.5 ? slot.next : slot.index) : -1;
    if (slot) {
      const a = this.worlds[slot.index] as WorldTexture;
      const b = this.worlds[slot.next] as WorldTexture;
      this.portal.setWorlds(a.texture, b.texture, a.tint, b.tint);
    }
    if (shown !== this.lastWorld) {
      this.lastWorld = shown;
      this.events.onWorld(shown >= 0 ? (this.worlds[shown]?.preview ?? null) : null);
    }

    const visualTime = this.options.calm ? 0 : t;
    this.stage.renderer.toneMappingExposure = s.exposure;
    this.chamber.update({ activation: s.activation, fogDensity: s.fog, exposure: s.exposure });
    this.portal.update(
      { time: visualTime, activation: s.activation, inscription: s.inscription, pulse: s.pulse, worldAmount: this.worlds.length ? s.worldAmount : 0, worldMix: slot?.mix ?? 0, depth: s.depth },
      this.options.calm ? 0 : dt * this.options.speed,
    );
    this.particles.update(visualTime, s.pull, s.particles * s.exposure);
    this.tunnel.update(visualTime, s.entry, s.resolve, this.stage.aspect);
    this.events.onEnergy(s.activation);
  }

  dispose(): void {
    this.timeline.kill();
    this.stage.onAspect = null;
    this.blank.dispose();
  }

  private buildTimeline(): gsap.core.Timeline {
    const b = this.config.timeline;
    const s = this.state;
    const entrySpan = b.end - b.entry;
    const tl = gsap.timeline({ paused: true });
    // Scene 01: entering the chamber, revealed out of darkness and fog
    tl.to(s, { exposure: 1, duration: 3.6, ease: 'power2.out' }, b.reveal);
    tl.to(s, { fog: 0.03, duration: b.awaken - b.reveal, ease: 'power1.out' }, b.reveal);
    tl.to(s, { particles: 0.55, duration: 4, ease: 'none' }, b.reveal + 1);
    // Scene 02: the portal awakens
    tl.call(() => this.events.onCue('awaken'), undefined, b.awaken);
    tl.to(s, { pulse: 1, duration: 0.25, ease: 'power2.out' }, b.awaken);
    tl.to(s, { pulse: 0, duration: 1.2, ease: 'power2.in' }, b.awaken + 0.25);
    tl.to(s, { pull: 0.6, duration: 3, ease: 'power1.inOut' }, b.awaken + 0.3);
    tl.to(s, { inscription: 1, duration: 3.2, ease: 'power1.inOut' }, b.awaken + 0.5);
    tl.to(s, { activation: 0.78, duration: b.worlds - b.awaken, ease: 'power2.inOut' }, b.awaken + 0.6);
    // Scene 03: worlds behind the portal (which world: schedule.ts)
    tl.to(s, { worldAmount: 1, duration: 0.9, ease: 'power2.out' }, b.worlds);
    // Scene 04: message (DOM, above and below the portal)
    tl.call(() => this.events.onMessage(0), undefined, b.message1);
    tl.call(() => this.events.onMessage(1), undefined, b.message2);
    tl.to(s, { worldAmount: 0, duration: 0.8, ease: 'power2.in' }, b.fullPower - 0.8);
    // Scene 05: full power
    tl.call(() => this.events.onCue('surge'), undefined, b.fullPower);
    tl.to(s, { pulse: 0.8, duration: 0.3, ease: 'power2.out' }, b.fullPower);
    tl.to(s, { pulse: 0, duration: 1, ease: 'power2.in' }, b.fullPower + 0.3);
    tl.to(s, { activation: 1, depth: 1, pull: 1, particles: 1, duration: b.entry - b.fullPower, ease: 'power2.inOut' }, b.fullPower);
    tl.call(() => this.events.onMessage(null), undefined, b.fullPower + 0.2);
    // Scene 06: through the surface, into the tunnel, resolving into the portfolio
    tl.call(() => this.events.onCue('entry'), undefined, b.entry + entrySpan * 0.25);
    tl.to(s, { entry: 1, duration: entrySpan * 0.18, ease: 'power1.in' }, b.entry + entrySpan * 0.55);
    tl.to(s, { resolve: 1, duration: entrySpan * 0.25, ease: 'power2.inOut' }, b.entry + entrySpan * 0.75);
    tl.call(() => this.finish(), undefined, b.end);
    return tl;
  }

  /** Reduced motion: an active, still portal and the messages; no camera flight, no flashes. */
  private buildCalm(): gsap.core.Timeline {
    const s = this.state;
    Object.assign(s, { fog: 0.03, activation: 0.85, inscription: 1, pull: 0, particles: 0.5, worldAmount: 1, depth: 0.3 });
    const tl = gsap.timeline({ paused: true });
    const len = this.config.intro.calmSeconds;
    tl.to(s, { exposure: 1, duration: 0.8, ease: 'none' }, 0);
    tl.call(() => this.events.onMessage(1), undefined, 0.4);
    tl.call(() => this.finish(), undefined, len);
    return tl;
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.events.onEnd();
  }
}
