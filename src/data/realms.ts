import { GAME_WORLDS, type WorldMotif } from '../config/worlds';

/** The fields of a games.json entry the experience uses. Anything else is ignored. */
export interface Realm {
  id: string;
  name: string;
  genre: string;
  platforms: string[];
  /** Same accent hue the Games Portfolio gives this game, so the colours carry over. */
  hue: number;
}

export type WorldPreview =
  | { kind: 'realm'; realm: Realm; label: string; hue: number }
  | { kind: 'world'; realm: Realm; label: string; hue: number; motif: WorldMotif; image: string };

const ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const PLATFORMS = new Set(['WINDOWS', 'MACOS', 'LINUX', 'ANDROID', 'IOS', 'WEB', 'CONSOLE']);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** FNV-1a over code points: identical to hash() in the Games Portfolio's index.html. */
export function portfolioHash(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.codePointAt(0) as number;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Accent hue of a game in the Games Portfolio (its hueOf()). */
export const portfolioHue = (id: string, name: string): number => portfolioHash(id + name) % 360;

/**
 * Reads the Games Portfolio's games.json. Invalid entries and non-games are dropped rather than
 * shown; a file that is not version 1 yields no realms. Never throws.
 */
export function parseGames(data: unknown): Realm[] {
  if (!data || typeof data !== 'object') return [];
  const file = data as { version?: unknown; games?: unknown };
  if (file.version !== 1 || !Array.isArray(file.games)) return [];
  const realms: Realm[] = [];
  const seen = new Set<string>();
  for (const entry of file.games as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const g = entry as Record<string, unknown>;
    if (g.family !== 'GAME' || typeof g.id !== 'string' || !ID.test(g.id) || seen.has(g.id)) continue;
    if (!text(g.name, 120) || !text(g.genre, 40)) continue;
    const platforms = Array.isArray(g.platforms) ? g.platforms.filter((p): p is string => typeof p === 'string' && PLATFORMS.has(p)) : [];
    seen.add(g.id);
    realms.push({ id: g.id, name: g.name.trim(), genre: g.genre.trim(), platforms, hue: portfolioHue(g.id, g.name) });
  }
  return realms;
}

/**
 * The sequence shown behind the portal: each realm's card, followed by its worlds when the game has
 * real material for them (config/worlds.ts). Featured order is kept as listed in games.json.
 */
export function buildWorldSequence(realms: readonly Realm[], max: number): WorldPreview[] {
  const out: WorldPreview[] = [];
  for (const realm of realms) {
    if (out.length >= max) break;
    out.push({ kind: 'realm', realm, label: realm.genre.toUpperCase(), hue: realm.hue });
    for (const w of GAME_WORLDS[realm.id] ?? []) {
      if (out.length >= max) break;
      out.push({ kind: 'world', realm, label: w.label.toUpperCase(), hue: w.hue, motif: w.motif, image: w.image });
    }
  }
  return out;
}

/** Fetches games.json with a timeout. Resolves to [] on any failure; the intro then runs without realms. */
export async function loadRealms(url: string, timeoutMs: number, fetchImpl: typeof fetch = fetch): Promise<Realm[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, credentials: 'omit', cache: 'no-cache' });
    if (!res.ok) return [];
    return parseGames(await res.json());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
