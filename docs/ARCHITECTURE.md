# THE GAMEVERSE — Architecture (Phase 1)

Decisions are based on [PROJECT_AUDIT.md](PROJECT_AUDIT.md).

## 1. Decisions

| Topic | Decision | Why |
|---|---|---|
| Integration | Separate web app at `/gamers-room/` that ends in one real navigation to `/games/` | The portfolio stays independent and keeps working if the 3D intro fails (spec §2, §17). Nothing is copied, screenshotted or iframed |
| Skipping the portfolio's own boot screen | Set `sessionStorage['ah-games-booted']='1'` right before navigating | Same origin (`ahshika.github.io`), so the portfolio shows its menu entrance directly. No change to the live portfolio. A contract test watches the key |
| Worlds | One **realm per game**, read at runtime from `/games/data/games.json`. Inside One Brain: its real puzzle domains as worlds, with its real screenshots | Owner decision 2026-11-05. No invented genres or details (spec §7) |
| Rendering | Three.js, procedural geometry and shaders for the Phase 2 prototype | Proves the portal transition before any expensive Blender asset (spec §16) |
| Timeline | GSAP, one master timeline driving a single camera progress value plus named beats | Synchronised camera, light, particles, text |
| Build | Vite + TypeScript (strict) | Same toolchain as THE DEVELOPER'S ROOM, already verified on this machine |
| Audio | Web Audio synthesis (drone, hum, activation swell, entry whoosh). Muted by default, sound toggle | No licensing risk, no files to download, autoplay rules respected |
| Post-processing | None in the prototype. Additive emissive materials and fog only | Measure first (spec §9) |
| Warm-up | `<link rel="prefetch">` for the portfolio HTML and the data fetch. **No prerender** | A prerendered page would run its scripts before the boot key is set and show PRESS START |

## 2. Runtime states

```
BOOT → LOADING → INTRO → HANDOFF → DONE
          ↘ FALLBACK (no WebGL, load timeout, context lost, runtime error)
INTRO → (Skip) → HANDOFF
pageshow(persisted) / return flag → RETURNED (Enter the games / Watch again)
```

- `PortfolioHandoff.navigate()` is latched: Skip, timeline end and errors produce exactly one navigation.
- Every failure path ends on a screen with a working link to the portfolio. A hard cap (`intro.loadTimeoutMs`) means loading can never trap the visitor.

## 3. Modules

```
src/
  main.ts                       entry: capability check, app start, global error → fallback
  config/site.config.json       URLs: single source of truth (also read by the QR generator)
  config/experience.config.ts   timeline beats, quality presets, texts, audio
  config/worlds.ts              per-game world definitions from real game data
  config/validateConfig.ts      https + allowed-origin checks, beat ordering
  app/App.ts                    state machine, wiring, cleanup
  data/realms.ts                games.json → realms (validation, hue = portfolio's hash)
  portfolio/PortfolioHandoff.ts single navigation, boot key, prefetch
  experience/Stage.ts           renderer, resize, DPR, render loop, dispose
  experience/Chamber.ts         floor, monoliths, fragments, fog, lights
  experience/Portal.ts          frame, rings, inscriptions, energy surface shader
  experience/Particles.ts       dimensional particles drawn toward the portal
  experience/CameraRig.ts       named camera states, aspect-adapted framing
  experience/Timeline.ts        GSAP master timeline (Scenes 01–06)
  services/AudioManager.ts      Web Audio, muted by default
  services/Quality.ts           device → preset; ?quality override
  ui/Ui.ts                      loading, messages, Skip, sound, fallback, return screen
```

## 4. Debug flags

`?quality=low|medium|high`, `?speed=0.25–8`, `?pauseAt=<seconds>`. None of them can change a navigation target.

## 5. Security

- Navigation only to `https://` URLs on the allowed origin (`https://ahshika.github.io`).
- Production CSP: `default-src 'self'`, `connect-src 'self'` (same origin covers `/games/data/games.json`), `img-src 'self' data: blob:`, no third-party scripts, no fonts from outside.
- Game data is shown only through `textContent` and canvas text. It is never inserted as HTML.
- No camera, microphone or location API. No tracking.
