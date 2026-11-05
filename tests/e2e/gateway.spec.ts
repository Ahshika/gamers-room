import { GAMES_URL, expect, expectHandedOff, test, waitForTime } from './fixtures';

test.describe('QR entry → gateway → Games Portfolio', () => {
  test('starts by itself (no Start button, no input) and hands off to the real portfolio exactly once', async ({ page, portfolio }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('?speed=8');
    await expect(page.locator('.loader-title')).toHaveText('INITIALIZING THE GAMEVERSE...');
    await expect(page.locator('html')).toHaveAttribute('data-gv-state', /intro|handoff/);
    await expectHandedOff(page, portfolio);
    expect(errors).toEqual([]);
  });

  test('shows the realm of the real game and the mandatory messages', async ({ page }) => {
    await page.goto('?speed=8&pauseAt=11.8');
    await waitForTime(page, 11.8);
    await expect(page.locator('html')).toHaveAttribute('data-gv-worlds', '6');
    await expect(page.locator('#caption')).toHaveText('ONE BRAIN · LOGIC');
    await page.goto('?speed=8&pauseAt=18.2');
    await waitForTime(page, 18.2);
    await expect(page.locator('#msg1')).toHaveText('EVERY WORLD HAS A STORY.');
    await expect(page.locator('#msg2')).toHaveText('EVERY GAME IS A NEW ADVENTURE.');
    await expect(page.locator('#msg1')).toHaveClass(/show/);
    await expect(page.locator('#msg2')).toHaveClass(/show/);
  });

  for (const at of [0.5, 6, 12, 18, 22.9]) {
    test(`Skip at ${at}s leads to the portfolio with one navigation`, async ({ page, portfolio }) => {
      await page.goto(`?speed=8&pauseAt=${at}`);
      await waitForTime(page, at);
      const skip = page.getByRole('link', { name: 'Skip intro' });
      await skip.click();
      await expectHandedOff(page, portfolio);
    });
  }

  test('double activation of Skip still navigates once', async ({ page, portfolio }) => {
    await page.goto('?pauseAt=2');
    await waitForTime(page, 2);
    await page.getByRole('link', { name: 'Skip intro' }).evaluate((a: HTMLAnchorElement) => {
      a.click();
      a.click();
    });
    await expectHandedOff(page, portfolio);
  });

  test('without WebGL the visitor gets the fallback, a working link, and is forwarded automatically', async ({ page, portfolio }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    await page.goto('');
    await expect(page.locator('#fallback')).toBeVisible();
    await expect(page.locator('#fallback-link')).toHaveAttribute('href', GAMES_URL);
    await expect(page.locator('html')).toHaveAttribute('data-gv-state', 'fallback');
    await expectHandedOff(page, portfolio);
  });

  test('the fallback link navigates immediately', async ({ page, portfolio }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto('');
    await page.locator('#fallback-link').click();
    await expectHandedOff(page, portfolio);
  });

  test('if the games data cannot be loaded, the intro still plays and hands off', async ({ page, portfolio }) => {
    portfolio.dataStatus = 503;
    await page.goto('?speed=8&pauseAt=11');
    await waitForTime(page, 11);
    await expect(page.locator('html')).toHaveAttribute('data-gv-worlds', '0');
    await page.goto('?speed=8');
    await expectHandedOff(page, portfolio);
  });

  test('reduced motion: calm, still portal with the messages, then the hand-off', async ({ page, portfolio }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('?speed=4');
    await expect(page.locator('#msg2')).toHaveText('EVERY GAME IS A NEW ADVENTURE.');
    await expectHandedOff(page, portfolio);
  });

  test('never asks for camera, microphone, location or notifications', async ({ page }) => {
    await page.addInitScript(() => {
      const calls: string[] = [];
      (window as unknown as { __permissionCalls: string[] }).__permissionCalls = calls;
      const md = navigator.mediaDevices;
      if (md) md.getUserMedia = async () => {
        calls.push('getUserMedia');
        throw new Error('blocked');
      };
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition = () => void calls.push('getCurrentPosition');
        navigator.geolocation.watchPosition = () => (calls.push('watchPosition'), 0);
      }
      if ('Notification' in window) Notification.requestPermission = async () => (calls.push('notification'), 'denied');
    });
    await page.goto('?speed=8&pauseAt=23.5');
    await waitForTime(page, 23.5);
    expect(await page.evaluate(() => (window as unknown as { __permissionCalls: string[] }).__permissionCalls)).toEqual([]);
  });

  test('back from the portfolio shows the return screen instead of forcing the intro again', async ({ page, portfolio }) => {
    await page.goto('?pauseAt=1');
    await waitForTime(page, 1);
    await page.getByRole('link', { name: 'Skip intro' }).click();
    await expectHandedOff(page, portfolio);
    await page.goBack();
    await expect(page.locator('#return')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Enter the games' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Watch again' })).toBeVisible();
  });

  test('production build carries a strict CSP and no third-party scripts', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.hostname !== 'localhost' && u.hostname !== 'ahshika.github.io') external.push(r.url());
    });
    await page.goto('?pauseAt=1');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
    await waitForTime(page, 1);
    expect(external).toEqual([]);
  });

  test('the sound toggle works and audio is off by default', async ({ page }) => {
    await page.goto('?pauseAt=3');
    await waitForTime(page, 3);
    const sound = page.getByRole('button', { name: /Sound/ });
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await expect(sound).toHaveText('Sound on');
  });
});
