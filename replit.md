# MovieBox API

A full-featured Express.js proxy for the MovieBox API. Search movies, series, anime, and music; browse trending content; fetch stream URLs, subtitles, and episode lists — all via clean JSON endpoints.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm --filter @workspace/docs run dev` — run the docs frontend (port 21121, served at `/docs/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (no database — pure proxy/cache)
- Cache: In-memory TTL cache (5–30 min per endpoint type)
- Build: esbuild (CJS bundle)
- Docs: React + Vite + Tailwind + Wouter

## Where things live

- `artifacts/api-server/src/lib/moviebox.ts` — all upstream API clients (V1/V2/V3), HMAC signing, auth
- `artifacts/api-server/src/lib/cache.ts` — in-memory TTL cache
- `artifacts/api-server/src/routes/` — Express route handlers per feature
- `artifacts/api-server/src/routes/test-live.ts` — enhanced test-live endpoint suite
- `artifacts/docs/src/App.tsx` — full interactive API docs UI

## Architecture decisions

- Three upstream API layers (V1 cookie, V2 GET, V3 HMAC-MD5 signed) reverse-engineered from the MovieBox mobile app
- V3 uses a host pool (`api6/5/4/4sg/3.aoneroom.com`) with automatic failover
- No database — all state is in-memory TTL cache; API is stateless and fast
- CORS enabled for all origins (it's a public API proxy)
- The `/test-live` suite returns normalized items with coverUrl, type label, rating, country for easy consumption

## Product

**API Server (`/api`)**: Full REST proxy for MovieBox. Endpoints:
- `GET /api/search?q=...` — search all content types
- `GET /api/test-live?q=...` — all-in-one: search + suggestions + multi-type + resource in one call
- `GET /api/test-live/multi-search?q=...` — parallel search across MOVIES + TV_SERIES + ANIME
- `GET /api/test-live/suggest?q=...` — fast autocomplete
- `GET /api/test-live/item?id=...` — full item: details + streams + play info in one call
- `GET /api/trending`, `/api/hot`, `/api/homepage` — browse endpoints
- `GET /api/movie/details?id=...`, `/api/series/details?id=...` — detail endpoints
- `GET /api/episode/resource?id=...`, `/api/episode/play?id=...` — stream/download URLs

**Docs Frontend (`/docs/`)**: Interactive API playground with live "Try It" for every endpoint.

## Gotchas

- V3 runtime token is updated automatically from `x-user` response headers — no manual setup needed
- Stream URLs expire (TTL 2 min in cache) — always fetch fresh before playing
- `@workspace/db` is in package.json but not imported by any route (legacy scaffold); esbuild tree-shakes it out
- Do NOT run `pnpm dev` at workspace root — use per-package dev commands

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
