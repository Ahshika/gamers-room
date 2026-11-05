import { Float32BufferAttribute, Material, Mesh, MeshStandardMaterial, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** The Blender-made architecture (tools/blender/build_assets.py). Null parts fall back to procedural geometry. */
export interface Architecture {
  /** Frame, Keystones, OuterRing, Spines, Supports; origin = portal centre, faces +z. */
  portal: Object3D | null;
  chamber: ChamberPieces | null;
}

export interface ChamberPieces {
  /** Pillar variants, each ~2 × 16 × 2 with its base at y = 0. */
  monoliths: BufferGeometry[];
  /** Floating ruin variants, centred. */
  ruins: BufferGeometry[];
  /** Stepped dais, radius 6.15, top at y = 0.9. */
  dais: BufferGeometry;
}

export const MONOLITH_DESIGN = { width: 2, height: 16, depth: 2 } as const;
const MONOLITHS = ['Monolith_A', 'Monolith_B', 'Monolith_C', 'Monolith_D'];
const RUINS = ['Ruin_A', 'Ruin_B'];

async function load(url: string): Promise<Object3D | null> {
  try {
    return (await new GLTFLoader().loadAsync(url)).scene;
  } catch (err) {
    console.warn(`Architecture ${url} not loaded; using procedural geometry`, err);
    return null;
  }
}

/**
 * The mesh's geometry with its node transform baked in. Quantized files (KHR_mesh_quantization) store
 * positions as normalised integers and put the dequantization scale/offset on the node, so the
 * geometry alone is not in metres: positions are expanded to float and the world matrix applied.
 */
export function geometryOf(root: Object3D, name: string): BufferGeometry | null {
  const obj = root.getObjectByName(name);
  if (!obj || !(obj as Mesh).isMesh) return null;
  root.updateMatrixWorld(true);
  const source = (obj as Mesh).geometry;
  const geometry = source.clone();
  const pos = source.getAttribute('position');
  const floats = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    floats[i * 3] = pos.getX(i);
    floats[i * 3 + 1] = pos.getY(i);
    floats[i * 3 + 2] = pos.getZ(i);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(floats, 3));
  geometry.deleteAttribute('normal'); // flat-shaded: normals come from screen-space derivatives
  geometry.applyMatrix4(obj.matrixWorld);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Reads the chamber pieces; null when any piece is missing (all-or-nothing keeps the layout consistent). */
export function chamberPiecesFrom(root: Object3D): ChamberPieces | null {
  const monoliths = MONOLITHS.map((n) => geometryOf(root, n));
  const ruins = RUINS.map((n) => geometryOf(root, n));
  const dais = geometryOf(root, 'Dais');
  if (!dais || monoliths.some((g) => !g) || ruins.some((g) => !g)) return null;
  return { monoliths: monoliths as BufferGeometry[], ruins: ruins as BufferGeometry[], dais };
}

/** Loads both GLB files in parallel. Never throws: a failed file means procedural geometry for that part. */
export async function loadArchitecture(base: string, onItem: () => void = () => undefined): Promise<Architecture> {
  const [portal, chamberRoot] = await Promise.all([
    load(`${base}models/portal.glb`).finally(onItem),
    load(`${base}models/chamber.glb`).finally(onItem),
  ]);
  return { portal, chamber: chamberRoot ? chamberPiecesFrom(chamberRoot) : null };
}

/**
 * Replaces the exported materials (by name: Stone, Gold, DarkMetal) with the experience's tuned ones.
 * The baked ambient occlusion arrives as vertex colours, so the replacements multiply it in.
 * Unknown material names keep a neutral stone so nothing renders with exporter defaults.
 */
export function applyMaterials(root: Object3D, byName: Record<string, MeshStandardMaterial>): void {
  const fallback = byName.Stone;
  const old = new Set<Material>();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const swap = (m: Material) => {
      old.add(m);
      return byName[m.name] ?? fallback ?? m;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
  const kept = new Set<Material>(Object.values(byName));
  old.forEach((m) => {
    if (!kept.has(m)) m.dispose();
  });
}
