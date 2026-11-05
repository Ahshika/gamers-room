import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production build (`npm run build` first) served by `vite preview`, so the
 * real CSP, base path and code-splitting are exercised. https://ahshika.github.io is stubbed per
 * test (tests/e2e/fixtures.ts): no request reaches the live sites.
 */
const swiftshader = { launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: 'http://localhost:4174/gamers-room/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4174/gamers-room/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, ...swiftshader } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'], ...swiftshader } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'] } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } } },
  ],
});
