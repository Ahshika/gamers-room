# THE GAMEVERSE — Phase 2 report (technical prototype)

Date: 2026-11-05. Everything below was executed on the owner's Windows machine; nothing marked passed was skipped.

## 1. What the prototype proves

| Spec Phase 2 item | Status | Evidence |
|---|---|---|
| QR entry | Done | `qr/gamers-room-qr.*` decodes to `https://ahshika.github.io/gamers-room/` (unit test) |
| Automatic loading, no Start button | Done | E2E "starts by itself…" (no input sent) |
| Basic chamber | Done (procedural) | frames `desktop-01-chamber`, `desktop-03-awaken` |
| Central portal (custom, layered) | Done (procedural) | stone voussoirs, gold keystones, mechanical ring and spines, inscribed rune ring, energy runner, two energy rings, shader surface, fragments, key light |
| Portal activation | Done | pulse → particles pull → runes light from the keystone down → energy rings → surface glow → floor/monolith light |
| Real game worlds | Done | One Brain realm card + logic, memory, pattern, spatial, word worlds from real screenshots; E2E checks caption `ONE BRAIN · LOGIC` and 6 worlds |
| Messages | Done | E2E checks both mandatory lines; frames show them above/below the portal on phone and desktop |
| Camera approach and portal entry | Done | 8 named camera states; unit tests: camera crosses the portal plane inside the opening, never near the frame, never below the dais, never stops or reverses |
| Real Games Portfolio hand-off | Done | one real navigation to `https://ahshika.github.io/games/`; boot key set so the portfolio opens on its menu; live contract test |
| Skip Intro | Done | E2E: Skip at 0.5, 6, 12, 18, 22.9 s and a double click → exactly one navigation |
| Mobile compatibility | Emulated only | E2E on Pixel 7 (Chromium) and iPhone 14 (WebKit) emulation; **not yet on real phones** |

## 2. Tests executed

| Suite | Tool / version | Result |
|---|---|---|
| Unit (`npm test`) | Vitest 5.1.0, happy-dom 21.0.4 | **65 / 65 passed** (6 files) |
| E2E, desktop Chromium 1280×720 | Playwright 1.64.1 | **16 / 16 passed** |
| E2E, Android Chromium (Pixel 7 emulation) | Playwright 1.64.1 | **16 / 16 passed** |
| E2E, iPhone WebKit (iPhone 14 emulation) | Playwright 1.64.1 | **16 / 16 passed** |
| E2E, desktop Firefox | Playwright 1.64.1 | **Not executed**: Windows refuses to start Playwright's unsigned `firefox.exe` (`browserType.launch: spawn UNKNOWN`). No security setting was changed |
| Contract with the live portfolio (`npm run test:contract`) | Vitest 5.1.0 | **4 / 4 passed** (boot key present; colour hash identical to the portfolio's own `hash()`; `games.json` readable with CORS; world labels still in the game's data) |
| Typecheck | TypeScript 6.0.3 | passed |
| Lint | ESLint 10.14.0 | passed |
| Dependency audit | `npm audit` | 0 vulnerabilities (all and production-only) |
| Build | Vite 8.3.5 | passed |

E2E coverage: auto-start, single hand-off, real-data worlds and caption, mandatory messages, Skip at five story points, double Skip, WebGL disabled → fallback with working link and automatic forward, fallback link, games data returning 503 → intro still plays without worlds, reduced motion, no camera/microphone/location/notification API calls, back button → return screen, strict CSP with no third-party requests, sound toggle off by default.

## 3. k6 (Grafana k6 v2.3.0)

`tests/performance/entry.k6.js` against the **local** production preview (`vite preview` on 127.0.0.1:4175), 50 concurrent visitors (10 s ramp, 30 s hold, 10 s ramp-down). Each iteration loads the page and every asset needed before the intro (JS entry, three, gsap, CSS, 5 world images).

| Metric | Result | Threshold |
|---|---|---|
| Requests | 82,810 (1,656 req/s), 8,281 complete visits (165.6/s) | — |
| Failed requests | 0.00 % | < 0.1 % ✓ |
| Checks | 100 % (99,372) | > 99.9 % ✓ |
| HTML latency p50 / p90 / p95 / p99 | 82.4 / 103.5 / 110.1 / 146.7 ms | p95 < 150, p99 < 300 ✓ |
| Asset latency p50 / p90 / p95 / p99 | 53.9 / 105.3 / 184.8 / 208.9 ms | p95 < 400, p99 < 800 ✓ |
| Throughput | 119 MB/s received | — |
| Timeouts / failed connections | 0 | — |

This measures the build and its size under concurrency on a local server. It does **not** measure GitHub Pages' CDN; the live site was not load-tested (spec §5: no stress on external services).

Two earlier k6 runs are invalid and not counted: the preview server was not reachable on 127.0.0.1 (it listened on IPv6 only), so every request failed with "connection refused".

## 4. Performance observations

- Download before the intro: JS ≈ 185 KB gzip (three 137 KB, gsap 27 KB, app 16 KB), CSS 1.7 KB, Cinzel fonts 2 × 15 KB, worlds 5 × 6–11 KB.
- One draw call for all particles; instanced stone, keystones, spines, monoliths; no shadows and no post-processing.
- Quality presets: DPR cap 1.25 / 1.75 / 2, particles 500 / 1200 / 2400.
- **Frame rate was not measured on real hardware.** Headless runs use the software renderer (SwiftShader), whose numbers would not be meaningful. To do: measure on a real iPhone and Android phone.

## 5. Issues found and fixed during this phase

| Issue | Root cause | Fix | Verified by |
|---|---|---|---|
| Dormant portal looked pale lavender | Shader output was converted to sRGB but not tone-mapped | Tone mapping + colour space in every lit shader; sky and particles fade with the exposure | frames |
| Portal energy blew out to white | Linear values far above 1 go to white under ACES | Saturated, lower energy values | frames |
| Fragments flew in front of the camera | Fragment height did not depend on its orbit angle, so some sat on the portal axis | Fragments orbit the opening in its plane, behind the frame | unit test over 400 steps |
| Portal cropped on phones | Fit was capped at 2.4× pull-back | Widen FOV first (≤ 62°), then pull back | unit test per aspect |
| Messages covered the portal on desktop | Fit only checked width | Also limit the portal to 64 % of the screen height during worlds and messages | unit test + frames |
| Suspended ruins read as crosses | Ruins rested on monolith tops | Moved high and far behind | frames |
| k6 script crashed on a failed response | Body was null | Guarded | k6 rerun |

## 6. Open items (next phases)

1. Test on real iPhone Safari and Android Chrome, then scan a **printed** QR.
2. Measure frame rate on real phones and tune presets (adaptive DPR step-down if needed).
3. Phase 3: final Blender assets (portal sculpt, chamber architecture), or decide on a pre-rendered cinematic.
4. Make the tunnel more distinctive (today it is a radial streak tunnel, close to the portfolio's own hyperspace jump).
5. Firefox E2E once the machine allows the Playwright Firefox build to run.
6. Deployment: this build is **not pushed yet**. The live URL still serves the placeholder.
