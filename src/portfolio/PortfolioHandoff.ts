import { isAllowedNavigationUrl } from '../config/validateConfig';

/**
 * Key the Games Portfolio reads to skip its PRESS START screen (games/index.html:
 * `sessionStorage.getItem('ah-games-booted') === '1'`). Same origin, so this tab shares it.
 * tests/contract/portfolio.contract.test.ts fails if the portfolio stops using it.
 */
export const PORTFOLIO_BOOT_KEY = 'ah-games-booted';
/** Ours: marks that this tab already went through the gateway (back button → return screen). */
export const VISITED_KEY = 'gv.visited';

type Storage = Pick<globalThis.Storage, 'setItem' | 'getItem'>;

export interface HandoffOptions {
  url: string;
  allowedOrigins: readonly string[];
  /** Injected for tests; defaults to location.assign. */
  navigate?: (url: string) => void;
  storage?: Storage | null;
}

/** Owns the one and only navigation to the Games Portfolio. Latched: Skip + timeline end → one navigation. */
export class PortfolioHandoff {
  private navigated = false;
  private readonly url: string;
  private readonly doNavigate: (url: string) => void;
  private readonly storage: Storage | null;

  constructor(options: HandoffOptions) {
    if (!isAllowedNavigationUrl(options.url, options.allowedOrigins)) {
      throw new Error('Games Portfolio URL is not an allowed https destination');
    }
    this.url = options.url;
    this.doNavigate = options.navigate ?? ((u) => window.location.assign(u));
    this.storage = options.storage === undefined ? safeSessionStorage() : options.storage;
  }

  get destination(): string {
    return this.url;
  }

  get hasNavigated(): boolean {
    return this.navigated;
  }

  /** True when this tab already went through the gateway once. */
  wasVisited(): boolean {
    try {
      return this.storage?.getItem(VISITED_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * Prefetch hint for the portfolio HTML. Deliberately not a prerender: a prerendered portfolio
   * would run its boot check before navigate() sets the boot key (docs/ARCHITECTURE.md §1).
   */
  warmUp(doc: Document = document): void {
    if (doc.querySelector('link[data-gv-prefetch]')) return;
    const link = doc.createElement('link');
    link.rel = 'prefetch';
    link.href = this.url;
    link.dataset.gvPrefetch = '';
    doc.head.appendChild(link);
  }

  /** Navigates once. Returns false if a navigation was already issued. */
  navigate(): boolean {
    if (this.navigated) return false;
    this.navigated = true;
    try {
      this.storage?.setItem(VISITED_KEY, '1');
      this.storage?.setItem(PORTFOLIO_BOOT_KEY, '1');
    } catch {
      // storage unavailable (private mode): the portfolio then shows its own start screen, still usable
    }
    this.doNavigate(this.url);
    return true;
  }
}

export function safeSessionStorage(): globalThis.Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
