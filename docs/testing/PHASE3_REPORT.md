# THE GAMEVERSE — Phase 3 report (Blender architecture)

Date: 2026-11-05. Owner decision: real-time 3D with Blender models (the scene ran smoothly on the owner's phone in Phase 2).

## 1. What changed

| Part | Before (Phase 2) | Now |
|---|---|---|
| Portal frame | 30 instanced boxes | 25 bevelled voussoirs with a carved front panel, slight wear and tilt per block |
| Keystones | 5 gold boxes | 5 tapered gold wedges with a raised diamond relief |
| Mechanical ring | torus + 12 cones | torus with 24 collar blocks and 12 spines |
| Supports | none (the ring stood on the dais) | two bevelled buttresses with gold caps anchoring the ring onto the dais |
| Monoliths | stretched boxes | 4 types: stepped pillar, obelisk with pyramidion, broken 12-sided column cut at a slant, twin-slab gate |
| Ruins | boxes | broken arch of five voussoirs; lintel snapped at one end |
| Dais | 3 plain cylinders | 3 bevelled steps |
| Shading | flat colour | ambient occlusion baked in Cycles into vertex colours |

Unchanged in code: energy surface, rune ring, energy rings, particles, world previews, tunnel, camera, timeline, hand-off.
If a model fails to load, the Phase 2 procedural geometry is built instead (same layout, same instance counts).

## 2. Pipeline and size

`tools/blender/build_assets.py` (Blender 5.2.3 LTS) builds the scene, bakes AO (Cycles, 96 samples, per vertex) and exports GLB. `tools/optimize-models.mjs` (gltf-transform 4.5.1) drops normals, welds and applies `KHR_mesh_quantization`.

| File | Blender export | Shipped | gzip |
|---|---|---|---|
| `portal.glb` | 648,524 B | **120,380 B** | 65,352 B |
| `chamber.glb` | 330,920 B | **69,976 B** | 34,780 B |

No Draco and no Meshopt: both need WebAssembly, so the CSP would need `wasm-unsafe-eval`. Quantization is read natively by three.js.
The three.js chunk grew from 137 to 158 KB gzip (GLTFLoader).

## 3. Issues found and fixed

| Issue | Root cause | Fix | Verified by |
|---|---|---|---|
| Models were 1 MB | Flat shading plus per-corner AO split every vertex | AO per vertex, normals dropped (all materials flat-shaded), weld + quantization | size test (< 300 KB) |
| Monoliths and dais disappeared after optimization | Quantization moves the dequantization scale onto the glTF node; the chamber used the bare geometry | `geometryOf()` expands positions to float and applies the node's world matrix | unit test: pieces are in metres (height ≈ 16, dais top 0.9) |
| Keystones read as sun rays | Wide taper and large size | Smaller wedge, less taper, closer to the ring | frames |
| CLI tool pulled a vulnerable dependency (`glob` via `@donmccurdy/caporal`) | `@gltf-transform/cli` | Use the gltf-transform libraries directly | `npm audit`: 0 |

## 4. Tests executed

| Suite | Tool / version | Result |
|---|---|---|
| Unit | Vitest 5.1.0 | **74 / 74 passed** (new: shipped models contain every part, size limit, AO variation, frame clears the opening by > 0.2 m, chamber pieces in metres, all-or-nothing pieces, material mapping, model and fallback build the same instance counts) |
| E2E desktop Chromium | Playwright 1.64.1 | **18 / 18 passed** |
| E2E Android Chromium (Pixel 7 emulation) | Playwright 1.64.1 | **18 / 18 passed** |
| E2E iPhone WebKit (iPhone 14 emulation) | Playwright 1.64.1 | **18 / 18 passed** (new: models in use; models returning 404 → procedural gateway still plays and hands off) |
| E2E desktop Firefox | — | **Not executed**: Windows still refuses to start Playwright's unsigned Firefox build |
| Live portfolio contract | Vitest 5.1.0 | **4 / 4 passed** |
| Typecheck, lint, build | TypeScript 6.0.3, ESLint 10.14.0, Vite 8.3.5 | passed |
| Dependency audit | npm audit | 0 vulnerabilities |

## 5. k6 (v2.3.0), local preview, now including both models

50 concurrent visitors (10 s ramp, 30 s hold, 10 s down) against `vite preview` on 127.0.0.1:4175.

| Metric | Result | Threshold |
|---|---|---|
| Requests | 76,152 (1,523 req/s); 6,346 full visits | — |
| Failed requests | 0.00 % | < 0.1 % ✓ |
| Checks | 100 % (88,844) | > 99.9 % ✓ |
| HTML p50 / p90 / p95 / p99 | 99.4 / 126.4 / 134.0 / 166.8 ms | p95 < 150, p99 < 300 ✓ |
| Assets p50 / p90 / p95 / p99 | 69.7 / 111.1 / 243.3 / 280.2 ms | p95 < 400, p99 < 800 ✓ |
| Timeouts / failed connections | 0 | — |

Local server only. GitHub Pages was not load-tested.

## 6. Open items

1. Owner check on a real phone: the frame rate with the models (the Phase 2 procedural scene was smooth).
2. Firefox E2E, once the machine allows Playwright's Firefox to run.
3. Optional polish: the tunnel's look; a sculpted (higher detail) portal if the phone frame rate allows.
