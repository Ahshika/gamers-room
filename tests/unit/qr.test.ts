// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import site from '../../src/config/site.config.json';

const root = new URL('../../', import.meta.url);
const pngPath = new URL('qr/gamers-room-qr.png', root);
const svgPath = new URL('qr/gamers-room-qr.svg', root);
const decode = () => {
  const image = PNG.sync.read(readFileSync(pngPath));
  return jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
};

describe('printed QR', () => {
  it('exists as PNG and SVG', () => {
    expect(existsSync(pngPath)).toBe(true);
    expect(existsSync(svgPath)).toBe(true);
  });
  it('decodes to the permanent entry URL', () => {
    expect(decode()?.data).toBe('https://ahshika.github.io/gamers-room/');
    expect(decode()?.data).toBe(site.entryUrl);
  });
  it('SVG encodes the same symbol size as the PNG (no stale file)', () => {
    const svg = readFileSync(svgPath, 'utf8');
    const size = Number(/viewBox="0 0 (\d+) \1"/.exec(svg)?.[1]);
    // modules (17 + 4 * version) + 2 * margin (4)
    expect(size).toBe(17 + 4 * (decode()?.version ?? 0) + 8);
  });
});
