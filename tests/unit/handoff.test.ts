import { describe, expect, it, vi } from 'vitest';
import { PORTFOLIO_BOOT_KEY, PortfolioHandoff, VISITED_KEY } from '../../src/portfolio/PortfolioHandoff';

const ORIGINS = ['https://ahshika.github.io'];
const GAMES = 'https://ahshika.github.io/games/';
const memory = () => {
  const m = new Map<string, string>();
  return { setItem: (k: string, v: string) => void m.set(k, v), getItem: (k: string) => m.get(k) ?? null };
};

describe('PortfolioHandoff', () => {
  it('refuses a destination outside the allowlist', () => {
    expect(() => new PortfolioHandoff({ url: 'https://evil.example/', allowedOrigins: ORIGINS })).toThrow();
    expect(() => new PortfolioHandoff({ url: 'http://ahshika.github.io/games/', allowedOrigins: ORIGINS })).toThrow();
  });

  it('navigates exactly once (Skip + timeline end + double clicks)', () => {
    const navigate = vi.fn();
    const h = new PortfolioHandoff({ url: GAMES, allowedOrigins: ORIGINS, navigate, storage: memory() });
    expect(h.navigate()).toBe(true);
    expect(h.navigate()).toBe(false);
    expect(h.navigate()).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(GAMES);
    expect(h.hasNavigated).toBe(true);
  });

  it('sets the portfolio boot key before navigating, so PRESS START is skipped', () => {
    const storage = memory();
    const seen: (string | null)[] = [];
    const navigate = vi.fn(() => seen.push(storage.getItem(PORTFOLIO_BOOT_KEY)));
    const h = new PortfolioHandoff({ url: GAMES, allowedOrigins: ORIGINS, navigate, storage });
    expect(h.wasVisited()).toBe(false);
    h.navigate();
    expect(PORTFOLIO_BOOT_KEY).toBe('ah-games-booted');
    expect(seen).toEqual(['1']);
    expect(storage.getItem(VISITED_KEY)).toBe('1');
    expect(h.wasVisited()).toBe(true);
  });

  it('still navigates when storage throws (private mode)', () => {
    const navigate = vi.fn();
    const storage = {
      setItem: () => {
        throw new Error('quota');
      },
      getItem: () => {
        throw new Error('denied');
      },
    };
    const h = new PortfolioHandoff({ url: GAMES, allowedOrigins: ORIGINS, navigate, storage });
    expect(h.wasVisited()).toBe(false);
    expect(h.navigate()).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('works without any storage', () => {
    const navigate = vi.fn();
    new PortfolioHandoff({ url: GAMES, allowedOrigins: ORIGINS, navigate, storage: null }).navigate();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('adds one prefetch hint and never a prerender', () => {
    const h = new PortfolioHandoff({ url: GAMES, allowedOrigins: ORIGINS, navigate: vi.fn(), storage: null });
    h.warmUp(document);
    h.warmUp(document);
    expect(document.querySelectorAll('link[rel="prefetch"][data-gv-prefetch]')).toHaveLength(1);
    expect(document.querySelector('script[type="speculationrules"]')).toBeNull();
  });
});
