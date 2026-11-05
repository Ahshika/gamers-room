// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataTexture, Mesh, MeshStandardMaterial, Scene, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { MONOLITH_DESIGN, applyMaterials, chamberPiecesFrom, geometryOf } from '../../src/experience/Architecture';
import { Chamber } from '../../src/experience/Chamber';
import { Portal } from '../../src/experience/Portal';

const loadGlb = async (name: string): Promise<Object3D> => {
  const buf = readFileSync(join(process.cwd(), 'public', 'models', name));
  return (await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '')).scene;
};

let portalRoot: Object3D;
let chamberRoot: Object3D;
beforeAll(async () => {
  portalRoot = await loadGlb('portal.glb');
  chamberRoot = await loadGlb('chamber.glb');
});

describe('shipped models (public/models, from tools/blender/build_assets.py)', () => {
  it('contain every named part', () => {
    for (const n of ['Frame', 'Keystones', 'OuterRing', 'Spines']) expect(portalRoot.getObjectByName(n), n).toBeDefined();
    for (const n of ['Monolith_A', 'Monolith_B', 'Monolith_C', 'Monolith_D', 'Ruin_A', 'Ruin_B', 'Dais']) expect(chamberRoot.getObjectByName(n), n).toBeDefined();
  });

  it('are small enough for a phone on mobile data', () => {
    const size = (n: string) => readFileSync(join(process.cwd(), 'public', 'models', n)).byteLength;
    expect(size('portal.glb') + size('chamber.glb')).toBeLessThan(300_000);
  });

  it('carry baked ambient occlusion with real variation', () => {
    const frame = portalRoot.getObjectByName('Frame') as Mesh;
    const color = frame.geometry.getAttribute('color');
    expect(color).toBeDefined();
    let min = 1;
    let max = 0;
    for (let i = 0; i < color.count; i++) {
      min = Math.min(min, color.getX(i));
      max = Math.max(max, color.getX(i));
    }
    expect(max - min).toBeGreaterThan(0.4);
  });

  it('frame the portal opening exactly where the code expects it (energy surface r = 2.95)', () => {
    portalRoot.updateMatrixWorld(true);
    const frame = geometryOf(portalRoot, 'Frame');
    frame?.computeBoundingBox();
    const box = frame?.boundingBox;
    expect(box?.max.x).toBeGreaterThan(4.0);
    expect(box?.max.x).toBeLessThan(4.6);
    // nothing of the frame intrudes into the opening
    const pos = frame?.getAttribute('position');
    let inner = Infinity;
    for (let i = 0; i < (pos?.count ?? 0); i++) inner = Math.min(inner, Math.hypot(pos?.getX(i) ?? 0, pos?.getY(i) ?? 0));
    expect(inner).toBeGreaterThan(2.95 + 0.2);
  });

  it('give chamber pieces in metres, whatever the quantization put on the nodes', () => {
    const pieces = chamberPiecesFrom(chamberRoot);
    expect(pieces).not.toBeNull();
    for (const g of pieces?.monoliths ?? []) {
      g.computeBoundingBox();
      const b = g.boundingBox;
      expect(b?.min.y).toBeCloseTo(0, 1);
      expect(b?.max.y).toBeGreaterThan(MONOLITH_DESIGN.height * 0.85);
      expect(b?.max.y).toBeLessThan(MONOLITH_DESIGN.height * 1.05);
      expect((b?.max.x ?? 0) - (b?.min.x ?? 0)).toBeGreaterThan(MONOLITH_DESIGN.width * 0.9);
    }
    const dais = pieces?.dais;
    dais?.computeBoundingBox();
    expect(dais?.boundingBox?.max.y).toBeCloseTo(0.9, 1);
    expect(dais?.boundingBox?.max.x).toBeCloseTo(6.15, 1);
  });

  it('return null when a piece is missing, so the chamber stays consistent', () => {
    const partial = chamberRoot.clone();
    partial.getObjectByName('Ruin_B')?.removeFromParent();
    expect(chamberPiecesFrom(partial)).toBeNull();
  });
});

describe('applyMaterials', () => {
  it('replaces materials by name and falls back to stone for unknown ones', () => {
    const root = new Scene();
    const named = (n: string) => Object.assign(new MeshStandardMaterial(), { name: n });
    root.add(new Mesh(undefined, named('Gold')), new Mesh(undefined, named('Mystery')));
    const stone = new MeshStandardMaterial();
    const gold = new MeshStandardMaterial();
    applyMaterials(root, { Stone: stone, Gold: gold });
    const [a, b] = root.children as Mesh[];
    expect(a?.material).toBe(gold);
    expect(b?.material).toBe(stone);
  });
});

describe('model and fallback paths build the same scene parts', () => {
  const blank = new DataTexture(new Uint8Array(4), 1, 1);
  it('portal', () => {
    expect(new Portal(blank, 8, portalRoot.clone()).usesModel).toBe(true);
    expect(new Portal(blank, 8, null).usesModel).toBe(false);
  });
  it('chamber', () => {
    const pieces = chamberPiecesFrom(chamberRoot);
    const withModel = new Chamber(new Scene(), 12, pieces);
    const fallback = new Chamber(new Scene(), 12, null);
    expect(withModel.usesModel).toBe(true);
    expect(fallback.usesModel).toBe(false);
    const instances = (c: Chamber) => {
      let n = 0;
      c.group.traverse((o) => {
        const inst = o as { isInstancedMesh?: boolean; count?: number };
        if (inst.isInstancedMesh) n += inst.count ?? 0;
      });
      return n;
    };
    // same number of monoliths, seams and ruins either way
    expect(instances(withModel)).toBe(instances(fallback));
  });
});
