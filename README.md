# THE GAMEVERSE

**ENTER THE REALMS. DISCOVER THE GAMES.**

A cinematic 3D gateway into the [Games Portfolio](https://ahshika.github.io/games/) of Ahmed Hassan, opened by a printed QR code.
It is independent of [The Developer's Room](https://github.com/Ahshika/developers-room) and shares no visuals with it.

1. One QR scan opens `https://ahshika.github.io/gamers-room/`. The intro starts by itself: no Start button, no camera, no extra page.
2. A monumental chamber between worlds emerges from the fog. Its ancient portal awakens: runes light up, energy runs around the rings, particles stream in.
3. The portal shows the realm of each real game from `games.json`. For One Brain, it shows its own puzzle worlds (logic, memory, pattern, spatial, word) with real screenshots.
4. **EVERY WORLD HAS A STORY. / EVERY GAME IS A NEW ADVENTURE.**
5. The camera flies through the portal. The tunnel resolves into the portfolio's own background, and the real Games Portfolio opens directly on its game menu.

> **Status: Phase 2 (technical prototype), procedural assets.** Final Blender assets are Phase 3. See [docs/testing/PHASE2_REPORT.md](docs/testing/PHASE2_REPORT.md).

## Stable URL (QR destination, printed, never change it)

`https://ahshika.github.io/gamers-room/`

It depends on the GitHub account name `Ahshika` and the repository name `gamers-room`. The repository must stay public, with Pages set to **GitHub Actions**.
Changing where visitors end up does **not** need a new QR: edit `gamesPortfolioUrl` in `src/config/site.config.json`.

## Configuration

| File | What it holds |
|---|---|
| `src/config/site.config.json` | All URLs: entry, Games Portfolio, games data, fallback, allowed origins. Also read by the QR generator |
| `src/config/experience.config.ts` | Intro on/off, Skip on/off, timeouts, scene timings, audio, quality presets, texts |
| `src/config/worlds.ts` | Worlds shown for a game, only from that game's real data and screenshots |

Debug flags: `?quality=low|medium|high`, `?speed=0.25–8`, `?pauseAt=<seconds>`. None of them can change where the visitor is sent.

## Requirements

- Node.js ≥ 22.12 (developed on 26.2)
- Optional: Grafana k6 for `tests/performance`

## Install, run, build

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run preview
```

The preview of the production build runs at http://localhost:4174/gamers-room/ (the CSP is applied to builds only).

## Test

```bash
npm run lint
```

```bash
npm test
```

```bash
npx playwright test
```

E2E runs against the production build (`npm run build` first) and stubs `ahshika.github.io`, so no request reaches the live sites.

```bash
npm run test:contract
```

The contract test reads the **live** Games Portfolio. It fails if the portfolio stops honouring `sessionStorage['ah-games-booted']` or changes the data the gateway relies on.

```bash
k6 run tests/performance/entry.k6.js
```

The k6 test runs against the local preview only. The script refuses any other target.

## QR code

Print files are in `qr/`: `gamers-room-qr.svg` (vector, for print) and `gamers-room-qr.png` (2048 × 2048).
Error correction level H, 4-module quiet zone. Print at 3 × 3 cm or larger and keep the white margin. Test-scan one printed copy on iPhone and Android before a full print run.

```bash
npm run qr
```

This regenerates the QR from `src/config/site.config.json` and decodes it again to verify it.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: lint, unit tests, typecheck and build, then deploy of `dist/` to GitHub Pages.

## Documentation

- [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md): Phase 0 audit of the Games Portfolio
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): decisions, states, modules, security
- [docs/STORYBOARD.md](docs/STORYBOARD.md): scenes and timings
- [docs/testing/PHASE2_REPORT.md](docs/testing/PHASE2_REPORT.md): what was tested, results, open items
- [LICENSES.md](LICENSES.md): assets and dependencies
