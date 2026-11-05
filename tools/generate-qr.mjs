// Generates the print QR code for the experience entry URL and verifies it by decoding the PNG.
// Usage: node tools/generate-qr.mjs   (writes qr/gamers-room-qr.{svg,png})
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

// single source of truth: the entry URL in the site config (printed, must never change)
const config = JSON.parse(readFileSync(new URL('../src/config/site.config.json', import.meta.url), 'utf8'));
const url = config.entryUrl;
if (typeof url !== 'string' || !/^https:\/\/[\w.-]+\/[\w\-./]*$/.test(url)) throw new Error(`Unexpected entry URL: ${url}`);

// H: survives ~30% damage (scratches, folds, print defects); margin 4 is the spec quiet zone
const options = { errorCorrectionLevel: 'H', margin: 4, color: { dark: '#000000', light: '#ffffff' } };
const outDir = new URL('../qr/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const svg = await QRCode.toString(url, { ...options, type: 'svg' });
writeFileSync(new URL('gamers-room-qr.svg', outDir), svg);
const png = await QRCode.toBuffer(url, { ...options, type: 'png', width: 2048 });
writeFileSync(new URL('gamers-room-qr.png', outDir), png);

const image = PNG.sync.read(png);
const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
if (decoded?.data !== url) throw new Error(`QR verification failed: decoded ${JSON.stringify(decoded?.data)}`);
console.info(`QR written to qr/ and verified: ${decoded.data} (${image.width}x${image.height}, version ${decoded.version})`);
