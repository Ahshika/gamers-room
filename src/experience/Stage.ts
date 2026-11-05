import { ACESFilmicToneMapping, PerspectiveCamera, Timer, SRGBColorSpace, Scene, WebGLRenderer, type Material, type Object3D, type Texture } from 'three';
import type { QualityPreset } from '../config/experience.config';

/** Renderer, camera, resize and the single render loop. Owns GPU cleanup. */
export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 400);
  private readonly timer = new Timer();
  private frameHandler: ((dt: number) => void) | null = null;
  private disposed = false;
  private readonly onResize = () => this.resize();
  private readonly onLost = (e: Event) => {
    e.preventDefault();
    if (!this.disposed) this.onContextLost?.();
  };
  onContextLost: (() => void) | null = null;
  /** Called after each resize with the new aspect. */
  onAspect: ((aspect: number) => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly preset: QualityPreset,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: preset.antialias, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0;
    this.renderer.setClearColor(0x020206, 1);
    canvas.addEventListener('webglcontextlost', this.onLost);
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  get pixelRatio(): number {
    return this.renderer.getPixelRatio();
  }

  get aspect(): number {
    return this.camera.aspect;
  }

  start(onFrame: (dt: number) => void): void {
    this.frameHandler = onFrame;
    this.timer.reset();
    this.renderer.setAnimationLoop((timestamp: number) => {
      this.timer.update(timestamp);
      // cap dt so a stalled tab or a hitch never makes the story jump
      const dt = Math.min(this.timer.getDelta(), 1 / 20);
      this.frameHandler?.(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }

  stop(): void {
    this.renderer.setAnimationLoop(null);
    this.frameHandler = null;
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.preset.maxDpr));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onAspect?.(this.camera.aspect);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    const textures = new Set<Texture>();
    this.scene.traverse((obj: Object3D) => {
      const mesh = obj as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] };
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mat of mats) {
        for (const value of Object.values(mat as unknown as Record<string, unknown>)) {
          if (value && typeof value === 'object' && (value as Texture).isTexture) textures.add(value as Texture);
        }
        const uniforms = (mat as Material & { uniforms?: Record<string, { value: unknown }> }).uniforms;
        if (uniforms) {
          for (const u of Object.values(uniforms)) if (u.value && (u.value as Texture).isTexture) textures.add(u.value as Texture);
        }
        mat.dispose();
      }
    });
    textures.forEach((t) => t.dispose());
    this.renderer.dispose();
  }
}
