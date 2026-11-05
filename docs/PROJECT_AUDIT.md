# THE GAMEVERSE — Phase 0: Project Audit

Audit date: 2026-11-05. Read-only: nothing in the Games Portfolio was changed.
Sources: a fresh clone of `Ahshika/games` (`df4bddf`), the live site, the GitHub API, and the `Ahshika/One-Brain` repository.

## 1. The experience project (this repository)

| Item | Value |
|---|---|
| Repository | [Ahshika/gamers-room](https://github.com/Ahshika/gamers-room) (public) |
| Permanent entry URL (printed QR) | `https://ahshika.github.io/gamers-room/` |
| Hosting | GitHub Pages, build type `workflow` (`.github/workflows/deploy.yml`) |
| Current content | Static placeholder `site/index.html`, verified QR in `qr/` |
| Project name | THE GAMEVERSE (the repository and URL keep the name `gamers-room` because the QR is printed) |

## 2. The Games Portfolio

| Item | Finding |
|---|---|
| Repository | [Ahshika/games](https://github.com/Ahshika/games), first commit 2026-10-31, 2 commits |
| Live URL | `https://ahshika.github.io/games/` (HTTP 200, `Cache-Control: max-age=600`) |
| Deployment | GitHub Pages **legacy** (branch `main`, path `/`), `.nojekyll`, no build step |
| Framework | None. One `index.html` (37 KB) with inline CSS and vanilla JavaScript |
| Routing | Single page, no routes. Game selection is client-side state |
| Data | `data/games.json` (`version: 1`), fetched at runtime; validated by `tools/validate-games.mjs` in CI (`validate.yml`) |
| Automated updates | An external automation opens PRs that update `data/games.json` when an approved game publishes a release |
| Fonts | Google Fonts: Orbitron (display), Rajdhani (UI) |
| Palette | `--bg #04050a`, `--ink #eaf2ff`, `--hud #3ef0ff` (cyan), `--hud2 #ff3e9a` (pink), `--ok #b6ff3e` (lime); per-game accent hue from a hash of its id |
| Visual identity | Console game-select screen: "AH//GAMES" glitch logo, cut-corner HUD panels, scanlines, point field around the cursor, tiltable game case with holographic sheen |
| Intro of its own | `PRESS START` boot screen, then a launch sequence (load log, hyperspace jump, flash, menu entrance); hard cap 6 s; reduced motion gets a plain fade |
| Controls | Mouse/touch, arrow keys, Enter (download), S (source), gamepad LB/RB/Ⓐ/Ⓨ; synthesized sound effects, off by default (`localStorage['ah-games-sound']`) |
| Security posture | `esc()` for all data text, `safeUrl()` allows only `https:` links, `safeAsset()` allows only `assets/*.png|jpg|webp|avif` covers |
| Contact | LinkedIn, GitHub and software-portfolio links (README and page footer) |

### 2.1 Games actually listed (live data, updated 2026-10-31T09:25:40Z)

There is exactly **one** game.

| Field | Value |
|---|---|
| Name | One Brain (`one-brain`), featured |
| Genre | Puzzle |
| Tagline | A daily brain puzzle, plus an endless Challenge Path that keeps getting harder. |
| Content (from `points`) | 8 procedural puzzle types: logic, math, memory, pattern, visual, sequence, spatial, word; 5 difficulty tiers; stages of 10 levels with boss levels; self-generating themed stages after stage 10 |
| Platform | Android |
| Built with | Java, Android SDK, Material 3, MVVM, AdMob, Play Billing |
| Version / release | v1.0.0, 2026-10-08, Released |
| Download | `OneBrain-1.0.0.apk` on GitHub Releases (checked: responds, HTTP 206 on a range request) |
| Source | https://github.com/Ahshika/One-Brain |
| Cover art in the portfolio | None. The case shows abstract key art generated from the name |
| Real media available elsewhere | `One-Brain/docs/banner.png` and 11 real screenshots in `docs/screenshots/`: challenge-path, home, home-dark-ar, logic, memory, path-dark-ar, pattern, practice, result, spatial, word |

## 3. Consequences for THE GAMEVERSE

### 3.1 Game worlds (spec §3 Scene 03 and §7)

The spec forbids inventing genres. The real data supports:

- **One realm per game**, read at runtime from `https://ahshika.github.io/games/data/games.json`. Today that is one realm (Puzzle / One Brain); new games appear automatically when the automation adds them.
- **Distinct worlds inside One Brain**, taken from its real content: its puzzle domains (logic, math, memory, pattern, visual, sequence, spatial, word). Real screenshots exist for logic, memory, pattern, spatial and word.

Dark fantasy, sci-fi, mythology, horror and the other genres in the spec **must not** be shown, because no listed game has them.

### 3.2 Hand-off (spec §5 Scene 07, §11)

- `gamers-room` and `games` are on the **same origin** (`https://ahshika.github.io`), so `sessionStorage` is shared within the tab.
- The portfolio skips its `PRESS START` screen when `sessionStorage['ah-games-booted'] === '1'` and plays only its short menu entrance instead. Setting this key right before navigating gives a direct portal → menu hand-off **without modifying the live portfolio**. This is a coupling to an internal key of the portfolio; it must be covered by a test that fetches the live `index.html` and fails if the key disappears.
- Recommended architecture: a **separate web application** (this repository) that ends in a **real navigation** to `/games/`. It keeps the portfolio independent and fully working if the 3D experience fails (spec §2, §17). The portfolio is never copied, screenshotted or iframed.
- The portfolio background `#04050a` is the colour the portal-entry transition must end on so the navigation is seamless.

### 3.3 Things that must not change without approval

- Anything in `Ahshika/games` (spec §15). No change is needed for the hand-off above.
- THE DEVELOPER'S ROOM and the main portfolio `Ahshika.github.io`.
- The entry URL `https://ahshika.github.io/gamers-room/` (printed).

## 4. Local tooling found

| Tool | Version | Use |
|---|---|---|
| Node.js / npm | 26.2.0 / 11.13.0 | build, tests |
| Blender | 5.2.3 LTS (`D:/Programs/Blender/blender.exe`) | portal and chamber modelling, optional pre-render |
| FFmpeg | 9.0.2 | video encoding if a pre-rendered path is chosen |
| Grafana k6 | v2.3.0 | load test of the static entry URL |
| Python | 3.13.15 | asset tooling |

THE DEVELOPER'S ROOM (`D:/Project/Programes/THE DEVELOPER'S ROOM`) has reusable **engineering** patterns (state machine, single-latch `PortfolioHandoff`, `QualityManager`, `AudioManager`, config validation, Playwright E2E with WebGL-off and Skip-at-every-beat tests). Per spec §2 only these engineering ideas may be reused; none of its visuals, assets or timelines.

## 5. Decisions

1. **Worlds behind the portal** (owner, 2026-11-05): one realm per game from `games.json`, plus One Brain's real puzzle worlds with its real screenshots. See [ARCHITECTURE.md](ARCHITECTURE.md) §1.
2. **Still open:** real-time Three.js for the final visuals versus a pre-rendered Blender cinematic (as THE DEVELOPER'S ROOM ended up doing). Decide after the Phase 2 prototype has been seen on real phones.
