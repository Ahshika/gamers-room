import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../fixtures/games.json';
import { GAME_WORLDS } from '../../src/config/worlds';
import { buildWorldSequence, loadRealms, parseGames, portfolioHash, portfolioHue } from '../../src/data/realms';

const game = (over: Record<string, unknown> = {}) => ({ id: 'a-game', name: 'A Game', family: 'GAME', genre: 'Action', platforms: ['WINDOWS'], ...over });

describe('parseGames', () => {
  it('reads the real games.json (one game: One Brain, Puzzle, Android)', () => {
    const realms = parseGames(fixture);
    expect(realms).toHaveLength(1);
    expect(realms[0]).toMatchObject({ id: 'one-brain', name: 'One Brain', genre: 'Puzzle', platforms: ['ANDROID'] });
  });
  it('drops software, invalid ids, duplicates and missing names', () => {
    const realms = parseGames({
      version: 1,
      games: [game(), game({ family: 'SOFTWARE', id: 'pos' }), game({ id: 'Bad Id' }), game({ name: '', id: 'no-name' }), game(), null, 'x'],
    });
    expect(realms.map((r) => r.id)).toEqual(['a-game']);
  });
  it('keeps only known platforms', () => {
    expect(parseGames({ version: 1, games: [game({ platforms: ['ANDROID', 'TOASTER', 3] })] })[0]?.platforms).toEqual(['ANDROID']);
  });
  it('returns nothing for another file version or garbage', () => {
    expect(parseGames({ version: 2, games: [game()] })).toEqual([]);
    expect(parseGames(null)).toEqual([]);
    expect(parseGames('games')).toEqual([]);
    expect(parseGames({ version: 1, games: 'x' })).toEqual([]);
  });
});

describe('portfolio colour', () => {
  it('uses the FNV-1a hash of the Games Portfolio', () => {
    // FNV-1a 32-bit reference values (offset basis; "a" → 0xe40c292c)
    expect(portfolioHash('')).toBe(2166136261);
    expect(portfolioHash('a')).toBe(0xe40c292c);
    expect(portfolioHue('one-brain', 'One Brain')).toBe(portfolioHash('one-brainOne Brain') % 360);
  });
});

describe('buildWorldSequence', () => {
  const realms = parseGames(fixture);
  it("shows the realm, then One Brain's real puzzle worlds", () => {
    const seq = buildWorldSequence(realms, 8);
    expect(seq.map((w) => w.label)).toEqual(['PUZZLE', 'LOGIC', 'MEMORY', 'PATTERN', 'SPATIAL', 'WORD']);
    expect(seq[0]?.kind).toBe('realm');
  });
  it('respects the maximum', () => {
    expect(buildWorldSequence(realms, 3)).toHaveLength(3);
  });
  it('gives a game without world material only its realm card', () => {
    const seq = buildWorldSequence(parseGames({ version: 1, games: [game()] }), 8);
    expect(seq).toEqual([expect.objectContaining({ kind: 'realm', label: 'ACTION' })]);
  });
  it('shows nothing when there are no games', () => {
    expect(buildWorldSequence([], 8)).toEqual([]);
  });
});

describe('world definitions are backed by real game data (no invention)', () => {
  const games = fixture.games as { id: string; points: string[] }[];
  for (const [id, worlds] of Object.entries(GAME_WORLDS)) {
    it(`${id}: every world is named in the game's own description`, () => {
      const entry = games.find((g) => g.id === id);
      expect(entry, `${id} must exist in games.json`).toBeDefined();
      const text = (entry?.points ?? []).join(' ').toLowerCase();
      for (const w of worlds) expect(text).toContain(w.label.toLowerCase());
    });
    it(`${id}: every world image is a real WebP file`, () => {
      for (const w of worlds) {
        expect(w.image).toMatch(/^media\/worlds\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/);
        const path = join(process.cwd(), 'public', w.image);
        expect(existsSync(path)).toBe(true);
        expect(readFileSync(path).subarray(8, 12).toString()).toBe('WEBP');
      }
    });
  }
});

describe('loadRealms', () => {
  it('parses a successful response', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }));
    expect(await loadRealms('https://x/games.json', 1000, ok as unknown as typeof fetch)).toHaveLength(1);
  });
  it('returns [] on HTTP errors, bad JSON and network errors', async () => {
    const http = vi.fn(async () => new Response('nope', { status: 500 }));
    const bad = vi.fn(async () => new Response('{not json', { status: 200 }));
    const net = vi.fn(async () => {
      throw new TypeError('offline');
    });
    for (const f of [http, bad, net]) expect(await loadRealms('https://x', 1000, f as unknown as typeof fetch)).toEqual([]);
  });
  it('gives up after the timeout', async () => {
    const hang = vi.fn(
      (_u: string, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const started = Date.now();
    expect(await loadRealms('https://x', 50, hang as unknown as typeof fetch)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
