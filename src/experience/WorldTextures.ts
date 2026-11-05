import { CanvasTexture, Color, SRGBColorSpace, type Texture } from 'three';
import type { WorldPreview } from '../data/realms';
import { mulberry32 } from '../utils/random';
import { portfolioHash } from '../data/realms';

const SIZE = 512;

export interface WorldTexture {
  preview: WorldPreview;
  texture: Texture;
  tint: Color;
}

/** Loads one image; resolves to null on failure so a missing screenshot never blocks the intro. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Each world gets its own motif drawn from what the puzzle type actually shows, not just a colour. */
function drawMotif(ctx: CanvasRenderingContext2D, preview: WorldPreview, rnd: () => number): void {
  const h = preview.hue;
  ctx.save();
  ctx.lineWidth = 3;
  const glow = hsl(h, 95, 62, 0.55);
  ctx.strokeStyle = glow;
  ctx.fillStyle = glow;
  ctx.shadowColor = hsl(h, 100, 60, 0.9);
  ctx.shadowBlur = 14;
  if (preview.kind === 'realm') {
    for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = 0.5 - i * 0.06;
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, 60 + i * 32, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  switch (preview.motif) {
    case 'logic': {
      // a deduction graph: nodes and the relations between them
      const nodes = Array.from({ length: 11 }, () => [40 + rnd() * (SIZE - 80), 40 + rnd() * (SIZE - 80)] as const);
      ctx.globalAlpha = 0.55;
      nodes.forEach(([x, y], i) => {
        const [nx, ny] = nodes[(i * 3 + 1) % nodes.length] as readonly [number, number];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      });
      nodes.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case 'memory': {
      // the tile grid where cells light up to be remembered
      const n = 6;
      const cell = SIZE / n;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const on = rnd() < 0.3;
          ctx.globalAlpha = on ? 0.75 : 0.18;
          roundRect(ctx, x * cell + 8, y * cell + 8, cell - 16, cell - 16, 10);
          if (on) ctx.fill();
          else ctx.stroke();
        }
      }
      break;
    }
    case 'pattern': {
      // a number lattice with one missing value
      ctx.globalAlpha = 0.5;
      ctx.font = '700 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 6; x++) {
          const v = (x + 1) * (y + 2) + ((x * 7 + y * 3) % 5);
          ctx.fillText(x === 4 && y === 2 ? '?' : String(v), 43 + x * 85, 43 + y * 85);
        }
      }
      break;
    }
    case 'spatial': {
      // block shapes in several rotations
      const shape = [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
        [2, 2],
      ];
      const unit = 26;
      for (let k = 0; k < 8; k++) {
        const cx = 70 + (k % 4) * 120;
        const cy = 110 + Math.floor(k / 4) * 290;
        const rot = (k * Math.PI) / 2;
        ctx.globalAlpha = 0.55;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        for (const [sx, sy] of shape) roundRect(ctx, (sx as number) * unit - 39, (sy as number) * unit - 39, unit - 4, unit - 4, 5);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'word': {
      // scrambled letter tiles (the letters of the real puzzle in the screenshot)
      const letters = ['O', 'L', 'F', 'O', 'R'];
      ctx.font = '800 40px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let row = 0; row < 7; row++) {
        for (let i = 0; i < 5; i++) {
          const x = 52 + i * 102 + (row % 2) * 30;
          const y = 40 + row * 72;
          ctx.globalAlpha = 0.22 + ((row + i) % 3) * 0.12;
          roundRect(ctx, x - 30, y - 28, 60, 56, 10);
          ctx.stroke();
          ctx.fillText(letters[(i + row) % letters.length] as string, x, y + 2);
        }
      }
      break;
    }
  }
  ctx.restore();
}

/** Builds the texture of one world: its own atmosphere, motif, and the real screenshot as a window into it. */
export function drawWorld(preview: WorldPreview, image: HTMLImageElement | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const h = preview.hue;
  const bg = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 20, SIZE / 2, SIZE / 2, SIZE * 0.72);
  bg.addColorStop(0, hsl(h, 70, 24));
  bg.addColorStop(0.55, hsl(h, 75, 10));
  bg.addColorStop(1, hsl(h, 80, 3));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  drawMotif(ctx, preview, mulberry32(portfolioHash(preview.realm.id + preview.label)));

  if (preview.kind === 'world' && image) {
    const w = SIZE * 0.5;
    const hgt = (image.naturalHeight / image.naturalWidth) * w;
    const x = (SIZE - w) / 2;
    const y = (SIZE - hgt) / 2;
    ctx.save();
    ctx.shadowColor = hsl(h, 100, 60, 0.9);
    ctx.shadowBlur = 40;
    roundRect(ctx, x, y, w, hgt, 18);
    ctx.fillStyle = hsl(h, 60, 12);
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, w, hgt, 18);
    ctx.clip();
    ctx.drawImage(image, x, y, w, hgt);
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, w, hgt, 18);
    ctx.lineWidth = 3;
    ctx.strokeStyle = hsl(h, 100, 70, 0.85);
    ctx.stroke();
    ctx.restore();
  } else if (preview.kind === 'realm') {
    // the realm card: real name and genre from games.json, drawn as text (never HTML)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3ecff';
    ctx.shadowColor = hsl(h, 100, 60, 0.9);
    ctx.shadowBlur = 24;
    let size = 64;
    const name = preview.realm.name.toUpperCase();
    ctx.font = `700 ${size}px Cinzel, Georgia, serif`;
    while (ctx.measureText(name).width > SIZE * 0.82 && size > 24) {
      size -= 4;
      ctx.font = `700 ${size}px Cinzel, Georgia, serif`;
    }
    ctx.fillText(name, SIZE / 2, SIZE / 2 - 10);
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillStyle = hsl(h, 90, 75);
    ctx.fillText(preview.realm.genre.toUpperCase(), SIZE / 2, SIZE / 2 + 44);
    ctx.restore();
  }
  return canvas;
}

export async function buildWorldTextures(previews: readonly WorldPreview[], base: string): Promise<WorldTexture[]> {
  const images = await Promise.all(previews.map((p) => (p.kind === 'world' ? loadImage(base + p.image) : Promise.resolve(null))));
  return previews.map((preview, i) => {
    const texture = new CanvasTexture(drawWorld(preview, images[i] ?? null));
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return { preview, texture, tint: new Color().setHSL(preview.hue / 360, 0.9, 0.6) };
  });
}
