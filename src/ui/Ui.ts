import type { WorldPreview } from '../data/realms';

const byId = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el as T;
};

/** All DOM the experience touches. Text from data is only ever set with textContent. */
export class Ui {
  readonly canvas = byId<HTMLCanvasElement>('scene');
  private readonly loader = byId('loader');
  private readonly loaderCount = byId('loader-count');
  private readonly msg1 = byId('msg1');
  private readonly msg2 = byId('msg2');
  private readonly caption = byId('caption');
  private readonly sound = byId<HTMLButtonElement>('sound');
  private readonly skip = byId<HTMLAnchorElement>('skip');
  private readonly fallback = byId('fallback');
  private readonly fallbackText = byId('fallback-text');
  private readonly fallbackNote = byId('fallback-note');
  private readonly returnPanel = byId('return');
  private readonly replay = byId<HTMLButtonElement>('return-replay');
  private readonly cover = byId('cover');

  constructor(private readonly texts: { message1: string; message2: string }) {}

  setProgress(done: number, total: number): void {
    // a real count of loaded items, not an invented percentage
    this.loaderCount.textContent = total > 0 ? `${done} / ${total}` : '';
  }

  hideLoader(): void {
    this.loader.classList.add('done');
    this.loader.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => (this.loader.hidden = true), 900);
  }

  showControls(skipEnabled: boolean, onSkip: () => void, onSound: () => boolean): void {
    if (skipEnabled) {
      this.skip.hidden = false;
      this.skip.addEventListener('click', (e) => {
        e.preventDefault(); // the href stays as a no-JS-safe fallback; the app performs the one navigation
        onSkip();
      });
    }
    this.sound.hidden = false;
    this.sound.addEventListener('click', () => {
      const muted = onSound();
      this.sound.setAttribute('aria-pressed', String(!muted));
      this.sound.textContent = muted ? 'Sound off' : 'Sound on';
    });
  }

  hideControls(): void {
    this.skip.hidden = true;
    this.sound.hidden = true;
  }

  setMessage(step: 0 | 1 | null): void {
    if (step === null) {
      this.msg1.classList.remove('show');
      this.msg2.classList.remove('show');
      return;
    }
    this.msg1.textContent = this.texts.message1;
    this.msg1.classList.add('show');
    if (step === 1) {
      this.msg2.textContent = this.texts.message2;
      this.msg2.classList.add('show');
    }
  }

  setWorld(preview: WorldPreview | null): void {
    if (!preview) {
      this.caption.classList.remove('show');
      return;
    }
    this.caption.textContent = `${preview.realm.name.toUpperCase()} · ${preview.label}`;
    this.caption.classList.add('show');
  }

  coverScreen(): void {
    this.cover.classList.add('on');
  }

  uncover(): void {
    this.cover.classList.remove('on');
  }

  showFallback(text: string, autoContinueMs: number | null): void {
    this.hideControls();
    this.loader.hidden = true;
    this.fallbackText.textContent = text;
    this.fallbackNote.textContent = autoContinueMs ? `Opening the games in ${Math.round(autoContinueMs / 1000)} seconds…` : '';
    this.fallback.hidden = false;
  }

  showReturn(onReplay: () => void): void {
    this.hideControls();
    this.loader.hidden = true;
    this.uncover();
    this.returnPanel.hidden = false;
    this.replay.addEventListener('click', onReplay, { once: true });
  }
}
