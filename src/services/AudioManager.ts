/**
 * Synthesised sound design (no audio files, so no licensing). Muted by default; the AudioContext is
 * only created by the sound toggle, which is a user gesture, so autoplay rules are never hit.
 * Nothing in the experience depends on sound.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private hum: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private muted: boolean;
  private activation = 0;
  private disposed = false;

  constructor(defaultMuted: boolean, private readonly volume: number) {
    this.muted = defaultMuted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Called from the sound button's click handler. Returns the new muted state. */
  toggle(): boolean {
    if (this.disposed) return true;
    this.muted = !this.muted;
    if (!this.muted) this.ensureGraph();
    if (this.ctx && this.master) {
      if (!this.muted) void this.ctx.resume().catch(() => undefined);
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.08);
    }
    return this.muted;
  }

  /** Portal energy 0..1: drives the hum level. Cheap to call every frame. */
  setActivation(a: number): void {
    this.activation = Math.min(1, Math.max(0, a));
    if (this.ctx && this.hum) this.hum.gain.setTargetAtTime(0.05 + this.activation * 0.22, this.ctx.currentTime, 0.2);
  }

  /** One-shot accents at story beats. */
  cue(name: 'awaken' | 'surge' | 'entry'): void {
    if (this.muted || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, name === 'entry' ? 2.5 : 1.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = name === 'entry' ? 0.7 : 1.4;
    const gain = ctx.createGain();
    const [f0, f1, peak, len] = name === 'awaken' ? [120, 900, 0.35, 1.5] : name === 'surge' ? [200, 1800, 0.45, 1.5] : [2400, 180, 0.6, 2.4];
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f1, t + len);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + len * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(t);
    noise.stop(t + len);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    this.sources = [];
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private ensureGraph(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // deep ambient drone: two detuned low sines through a low-pass
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260;
    const drone = ctx.createGain();
    drone.gain.value = 0.18;
    droneFilter.connect(drone).connect(master);
    for (const f of [55, 55.4, 82.4]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(droneFilter);
      o.start();
      this.sources.push(o);
    }

    // dimensional hum: sawtooth, filtered, level follows the portal energy
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 420;
    const hum = ctx.createGain();
    hum.gain.value = 0.05 + this.activation * 0.22;
    humFilter.connect(hum).connect(master);
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 110;
    saw.connect(humFilter);
    saw.start();
    this.sources.push(saw);

    this.ctx = ctx;
    this.master = master;
    this.hum = hum;
  }

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
