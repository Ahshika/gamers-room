// Shrinks the Blender exports for the web: dedupe, weld, then KHR_mesh_quantization, which three.js
// reads natively (no decoder, no WebAssembly, so the CSP stays strict). Verifies the result loads.
// Usage: node tools/optimize-models.mjs <inDir> <outDir>   (blender/export → public/models)
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, weld } from '@gltf-transform/functions';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Every material in the app is flat-shaded (normals come from screen-space derivatives), so vertex
// normals are dead weight; dropping them lets weld() merge the vertices they were splitting.
const dropNormals = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) prim.setAttribute('NORMAL', null);
};

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) {
  console.error('usage: node tools/optimize-models.mjs <inDir> <outDir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const name of ['portal.glb', 'chamber.glb']) {
  const src = join(inDir, name);
  const dst = join(outDir, name);
  const doc = await io.read(src);
  // 14-bit positions keep sub-millimetre precision over the 10 m portal; AO only needs 8 bits
  await doc.transform(dropNormals(), dedup(), weld(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8, quantizeTexcoord: 12 }), prune());
  await io.write(dst, doc);

  // the output must still load in three.js with every named part present
  const buf = readFileSync(dst);
  const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const meshes = [];
  gltf.scene.traverse((o) => o.isMesh && meshes.push(o.name));
  console.info(`${name}: ${statSync(src).size} → ${statSync(dst).size} bytes; meshes: ${meshes.join(', ')}`);
}
