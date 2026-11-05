import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const root = new URL('../', import.meta.url);
const config = JSON.parse(readFileSync(new URL('src/config/site.config.json', root), 'utf8'));

describe('entry URL (printed on the QR, must never change)', () => {
  it('is the agreed GitHub Pages URL', () => {
    expect(config.entryUrl).toBe('https://ahshika.github.io/gamers-room/');
  });
});

describe('generated QR', () => {
  const pngPath = new URL('qr/gamers-room-qr.png', root);
  const svgPath = new URL('qr/gamers-room-qr.svg', root);

  it('exists as PNG and SVG', () => {
    expect(existsSync(pngPath)).toBe(true);
    expect(existsSync(svgPath)).toBe(true);
  });

  it('decodes to the entry URL', () => {
    const image = PNG.sync.read(readFileSync(pngPath));
    const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
    expect(decoded?.data).toBe(config.entryUrl);
  });

  it('SVG encodes the same symbol as the PNG (no stale file)', () => {
    const svg = readFileSync(svgPath, 'utf8');
    expect(svg.startsWith('<svg')).toBe(true);
    // qrcode SVG viewBox = modules (17 + 4 * version) + 2 * margin (4)
    const size = Number(/viewBox="0 0 (\d+) \1"/.exec(svg)?.[1]);
    const image = PNG.sync.read(readFileSync(pngPath));
    const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
    expect(size).toBe(17 + 4 * decoded.version + 8);
  });
});

describe('placeholder page', () => {
  const html = readFileSync(new URL('site/index.html', root), 'utf8');

  it('exists so an early scan never hits a 404', () => {
    expect(html).toContain('<title>The Gamer\'s Room</title>');
  });

  it('links back to the portfolio', () => {
    expect(html).toContain(`href="${config.portfolioUrl}"`);
  });
});
