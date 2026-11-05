# THE GAMER'S ROOM

QR entry experience for gamers, the companion to [The Developer's Room](https://github.com/Ahshika/developers-room).

1. A printed QR code opens the URL.
2. An intro video plays (in progress).
3. The visitor lands on the profile.

## Stable URL (QR destination, printed, never change it)

`https://ahshika.github.io/gamers-room/`

This URL depends on two things that must never change: the GitHub account name `Ahshika` and the repository name `gamers-room`.
The repository must stay public with GitHub Pages enabled (Settings → Pages → Source: GitHub Actions).

## Current phase: placeholder

`site/index.html` is a static "coming soon" page, so a scan before the intro is ready never hits a 404.
Everything behind the URL (intro video, profile) can change freely without reprinting the QR.

## QR code

Print files are in `qr/`:

- `gamers-room-qr.svg`: vector, use this for print.
- `gamers-room-qr.png`: 2048 × 2048 px.

Error correction level H (~30% damage tolerance), 4-module quiet zone.
Print at 3 × 3 cm or larger, keep the white margin, and test-scan one printed copy on iPhone and Android before a full print run.

Regenerate (reads `src/config/site.config.json`, decodes the PNG to verify it):

```bash
npm run qr
```

## Test

```bash
npm test
```
