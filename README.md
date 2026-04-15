# Video Player PoC

This repository is a small `pnpm` workspace that compares:

- native HTML5 `<video>` vs `Video.js`
- plain MP4 vs HLS delivery
- normalized playback analytics across both lanes

The frontend lives in `apps/web`, the Fastify backend lives in `apps/api`, and the shared playback schema lives in `packages/shared`.

## What it does

The comparison page lets you:

- switch between `native` and `videojs`
- switch between `mp4` and `hls`
- play, pause, seek, and skip in `10s` increments
- inspect a live normalized event log
- view lightweight session metrics like startup-to-first-playing and buffering totals

The backend:

- serves media from `/media`
- exposes `/api/media/manifest`
- accepts analytics batches at `/api/events`
- exposes `/api/events` for inspection and reset

## Prerequisites

- Node.js `24+`
- `pnpm`
- `ffmpeg` for generating the local media fixtures

## Install

```bash
pnpm install
```

## Generate media

Place a source fixture at `media/source/sample.mp4`, then run:

```bash
./scripts/generate-media.sh
```

This generates:

- `media/output/mp4/sample.mp4`
- `media/output/hls/sample/master.m3u8`

If `ffmpeg` is not installed, the app still boots, but the UI will warn that fixtures are unavailable and playback will not start.

## Run locally

```bash
pnpm dev
```

This starts:

- the Fastify API on `http://localhost:3001`
- the Vite frontend on `http://localhost:5173`

The Vite dev server proxies `/api` and `/media` to the API so the browser stays on a single origin in development.

## Scripts

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
```

## Event model

The shared schema lives in `packages/shared/src/playbackEvents.ts`.

Tracked event types:

- `play_request`
- `playing`
- `pause`
- `seek_start`
- `seek_end`
- `skip_forward`
- `skip_backward`
- `buffer_start`
- `buffer_end`
- `ended`
- `error`

Skip buttons emit explicit skip events and intentionally suppress the seek pair that the player emits under the hood, so skip intent is not double-counted as a seek.

## Notes

- Native HLS uses browser support when available and otherwise uses `hls.js`.
- `Video.js` runs behind the same adapter contract so both lanes feed the same normalized analytics schema.
- The analytics store is intentionally in-memory and session-scoped for this PoC.
