// Captures storyboard moments (via the debug ?pauseAt= flag) for visual QA, phone and desktop.
// Usage: npm run build && npm run preview  (in another terminal), then
//        node tools/capture-beats.mjs <outDir> [baseUrl]
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';

const outDir = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:4174/gamers-room/';
if (!outDir) {
  console.error('usage: node tools/capture-beats.mjs <outDir> [baseUrl]');
  process.exit(1);
}
const BEATS = [
  ['01-chamber', 2.5], ['02-reveal', 5], ['03-awaken', 8], ['04-world-realm', 10.4], ['05-world-logic', 11.8],
  ['06-world-word', 17], ['07-message', 18.2], ['08-full-power', 20.4], ['09-approach', 22.2], ['10-entry', 23.0], ['11-tunnel', 23.4], ['12-resolve', 23.95],
];
const TARGETS = [['phone', devices['iPhone 14']], ['desktop', { viewport: { width: 1280, height: 720 } }]];
const games = await readFile(new URL('../tests/fixtures/games.json', import.meta.url), 'utf8');

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  for (const [label, device] of TARGETS) {
    const context = await browser.newContext({ ...device, deviceScaleFactor: 1 });
    // never touch the live sites from a capture run: real data, served from the fixture
    await context.route('https://ahshika.github.io/**', (r) =>
      r.request().url().endsWith('/games/data/games.json')
        ? r.fulfill({ status: 200, body: games, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } })
        : r.fulfill({ status: 200, body: '<!doctype html><title>games stub</title>', contentType: 'text/html' }),
    );
    const page = await context.newPage();
    for (const [name, at] of BEATS) {
      await page.goto(`${base}?speed=8&pauseAt=${at}`);
      await page.waitForFunction((t) => Number(document.documentElement.dataset.gvTime) >= t - 0.01, at, { timeout: 90_000 });
      await page.waitForTimeout(600);
      const file = join(outDir, `${label}-${name}.png`);
      await page.screenshot({ path: file });
      console.info(file);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
