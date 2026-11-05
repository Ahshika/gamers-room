import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

export const GAMES_URL = 'https://ahshika.github.io/games/';
const GAMES_JSON = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'games.json'), 'utf8');

export interface Portfolio {
  /** Navigations (not prefetches) that reached the Games Portfolio. */
  navigations: string[];
  /** Set to make games.json fail. */
  dataStatus: number;
}

/** Stubs https://ahshika.github.io: the real games.json (fixture copy) and a stub portfolio page. */
export const test = base.extend<{ portfolio: Portfolio }>({
  portfolio: async ({ context }, use) => {
    const portfolio: Portfolio = { navigations: [], dataStatus: 200 };
    await context.route('https://ahshika.github.io/**', async (route) => {
      const req = route.request();
      if (req.url().endsWith('/games/data/games.json')) {
        if (portfolio.dataStatus !== 200) return route.fulfill({ status: portfolio.dataStatus, body: 'error', headers: { 'access-control-allow-origin': '*' } });
        return route.fulfill({ status: 200, body: GAMES_JSON, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
      }
      if (req.isNavigationRequest()) portfolio.navigations.push(req.url());
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>AH//GAMES stub</title><h1>games stub</h1>' });
    });
    await use(portfolio);
  },
});

export { expect };

/** Waits until the story clock has reached `t` seconds (debug flag ?pauseAt holds it there). */
export async function waitForTime(page: Page, t: number): Promise<void> {
  await page.waitForFunction((at) => Number(document.documentElement.dataset.gvTime) >= at - 0.01, t, { timeout: 80_000 });
}

export async function expectHandedOff(page: Page, portfolio: Portfolio): Promise<void> {
  await page.waitForURL(GAMES_URL, { timeout: 80_000 });
  await expect(page.locator('h1')).toHaveText('games stub');
  // give a late duplicate navigation the chance to show up before counting
  await page.waitForTimeout(500);
  expect(portfolio.navigations).toEqual([GAMES_URL]);
}
