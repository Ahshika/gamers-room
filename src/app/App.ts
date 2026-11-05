import { experienceConfig, type ExperienceConfig } from '../config/experience.config';
import { validateConfig } from '../config/validateConfig';
import { buildWorldSequence, loadRealms } from '../data/realms';
import { Experience } from '../experience/Experience';
import { Stage } from '../experience/Stage';
import { buildWorldTextures } from '../experience/WorldTextures';
import { PortfolioHandoff } from '../portfolio/PortfolioHandoff';
import { AudioManager } from '../services/AudioManager';
import { parseFlags, probeDevice, selectQuality } from '../services/Quality';
import { Ui } from '../ui/Ui';

export type AppState = 'boot' | 'loading' | 'intro' | 'handoff' | 'fallback' | 'returned';

/** BOOT → LOADING → INTRO → HANDOFF, with FALLBACK and RETURNED (docs/ARCHITECTURE.md §2). */
export class App {
  private state: AppState = 'boot';
  private readonly ui: Ui;
  private readonly handoff: PortfolioHandoff;
  private readonly audio: AudioManager;
  private stage: Stage | null = null;
  private experience: Experience | null = null;
  private loadTimer = 0;
  private fallbackTimer = 0;

  constructor(private readonly config: ExperienceConfig = experienceConfig) {
    this.ui = new Ui({ message1: config.text.message1, message2: config.text.message2 });
    this.handoff = new PortfolioHandoff({ url: config.gamesPortfolioUrl, allowedOrigins: config.allowedOrigins });
    this.audio = new AudioManager(config.audio.defaultMuted, config.audio.masterVolume);
  }

  get current(): AppState {
    return this.state;
  }

  async run(): Promise<void> {
    const errors = validateConfig(this.config);
    if (errors.length) {
      console.error('Invalid experience config', errors);
      this.fail('config');
      return;
    }
    // every link to the portfolio goes through the single, latched navigation
    for (const id of ['fallback-link', 'return-enter']) {
      document.getElementById(id)?.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate();
      });
    }
    addEventListener('pageshow', (e) => {
      if (e.persisted) this.showReturn();
    });
    addEventListener('error', () => this.onRuntimeError());
    addEventListener('unhandledrejection', () => this.onRuntimeError());

    if (isBackForward() && this.handoff.wasVisited()) {
      this.showReturn();
      return;
    }
    if (!this.config.intro.enabled) {
      this.navigate();
      return;
    }
    await this.startIntro();
  }

  private async startIntro(): Promise<void> {
    this.setState('loading');
    const device = probeDevice();
    if (!device) {
      this.fail('no-webgl');
      return;
    }
    const flags = parseFlags(location.search);
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const level = selectQuality(device, this.config.quality.default, flags.quality);
    const preset = this.config.quality.presets[level];
    document.documentElement.dataset.gvQuality = level;
    this.handoff.warmUp();
    this.loadTimer = window.setTimeout(() => {
      if (this.state === 'loading') this.fail('timeout');
    }, this.config.intro.loadTimeoutMs);

    try {
      let done = 0;
      let total = 2;
      const tick = () => this.ui.setProgress(++done, total);
      const fontReady = document.fonts?.load('700 64px Cinzel').catch(() => []).then(tick) ?? Promise.resolve(tick());
      const realms = await loadRealms(this.config.gamesDataUrl, this.config.intro.dataTimeoutMs);
      tick();
      const previews = buildWorldSequence(realms, this.config.intro.maxWorlds);
      total += previews.length;
      await fontReady;
      const worlds = await buildWorldTextures(previews, import.meta.env.BASE_URL);
      done += worlds.length;
      this.ui.setProgress(done, total);
      if (this.state !== 'loading') {
        worlds.forEach((w) => w.texture.dispose());
        return; // the load timeout fired meanwhile
      }

      this.stage = new Stage(this.ui.canvas, preset);
      this.stage.onContextLost = () => this.fail('context-lost');
      this.experience = new Experience(
        this.stage,
        this.config,
        preset,
        worlds,
        {
          onMessage: (step) => this.ui.setMessage(step),
          onWorld: (p) => this.ui.setWorld(p),
          onCue: (cue) => this.audio.cue(cue),
          onEnergy: (a) => this.audio.setActivation(a),
          onEnd: () => this.navigate(),
        },
        { speed: flags.speed, pauseAt: flags.pauseAt, calm },
      );
      document.documentElement.dataset.gvWorlds = String(worlds.length);
    } catch (err) {
      console.error('The gateway could not be built', err);
      this.fail('build');
      return;
    }

    window.clearTimeout(this.loadTimer);
    this.setState('intro');
    this.ui.hideLoader();
    this.ui.showControls(this.config.intro.skipEnabled, () => this.navigate(), () => this.audio.toggle());
    const experience = this.experience;
    this.stage.start((dt) => {
      try {
        experience.update(dt);
        document.documentElement.dataset.gvTime = experience.time.toFixed(2);
      } catch (err) {
        console.error('Animation error', err);
        this.fail('runtime');
      }
    });
  }

  /** The only way out to the portfolio: Skip, the end of the story, the fallback and the return screen. */
  private navigate(): void {
    if (this.handoff.hasNavigated) return;
    this.setState('handoff');
    window.clearTimeout(this.loadTimer);
    window.clearTimeout(this.fallbackTimer);
    this.ui.hideControls();
    this.ui.coverScreen();
    this.teardown();
    this.handoff.navigate();
  }

  private fail(reason: string): void {
    if (this.state === 'handoff' || this.state === 'fallback') return;
    console.warn(`THE GAMEVERSE fallback: ${reason}`);
    this.setState('fallback');
    window.clearTimeout(this.loadTimer);
    this.teardown();
    const wait = this.config.intro.fallbackAutoContinueMs;
    this.ui.showFallback(this.config.text.fallback, wait);
    this.fallbackTimer = window.setTimeout(() => this.navigate(), wait);
  }

  private onRuntimeError(): void {
    if (this.state === 'loading' || this.state === 'intro') this.fail('runtime');
  }

  private showReturn(): void {
    if (this.state === 'returned') return;
    window.clearTimeout(this.fallbackTimer);
    this.teardown();
    this.setState('returned');
    this.ui.showReturn(() => location.reload());
  }

  private teardown(): void {
    this.experience?.dispose();
    this.experience = null;
    this.stage?.dispose();
    this.stage = null;
    this.audio.dispose();
  }

  private setState(next: AppState): void {
    this.state = next;
    document.documentElement.dataset.gvState = next;
  }
}

function isBackForward(): boolean {
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === 'back_forward';
}
