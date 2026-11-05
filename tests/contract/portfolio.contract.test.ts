// @vitest-environment node
/**
 * Contract with the LIVE Games Portfolio (network, read-only; run with `npm run test:contract`).
 * Fails when the portfolio changes something this gateway relies on.
 */
import { describe, expect, it } from 'vitest';
import { experienceConfig } from '../../src/config/experience.config';
import { GAME_WORLDS } from '../../src/config/worlds';
import { parseGames, portfolioHash } from '../../src/data/realms';
import { PORTFOLIO_BOOT_KEY } from '../../src/portfolio/PortfolioHandoff';

const get = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  expect(res.status, url).toBe(200);
  return res;
};

describe('live Games Portfolio', () => {
  it('still skips its PRESS START screen with our boot key', async () => {
    const html = await (await get(experienceConfig.gamesPortfolioUrl)).text();
    expect(html).toContain(`sessionStorage.getItem('${PORTFOLIO_BOOT_KEY}') === '1'`);
  });

  it('still uses the same FNV-1a colour hash', async () => {
    const html = await (await get(experienceConfig.gamesPortfolioUrl)).text();
    const source = /function hash\(s\)\{[^}]*\}[^}]*\}/.exec(html)?.[0];
    expect(source, 'hash() not found in the portfolio').toBeDefined();
    const theirs = new Function(`${source}; return hash;`)() as (s: string) => number;
    for (const s of ['', 'a', 'one-brainOne Brain', 'ünïcødé🎮']) expect(portfolioHash(s)).toBe(theirs(s));
  });

  it('serves games.json that the gateway can read, with CORS for local development', async () => {
    const res = await get(experienceConfig.gamesDataUrl);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const realms = parseGames(await res.json());
    expect(realms.length).toBeGreaterThan(0);
  });

  it('still describes every world we show for its games', async () => {
    const data = (await (await get(experienceConfig.gamesDataUrl)).json()) as { games: { id: string; points?: string[] }[] };
    for (const [id, worlds] of Object.entries(GAME_WORLDS)) {
      const game = data.games.find((g) => g.id === id);
      expect(game, `${id} is no longer in games.json`).toBeDefined();
      const text = (game?.points ?? []).join(' ').toLowerCase();
      for (const w of worlds) expect(text, `${id} no longer mentions ${w.label}`).toContain(w.label.toLowerCase());
    }
  });
});
