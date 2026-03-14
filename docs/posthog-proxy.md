# PostHog Proxy Setup

This project uses a dual setup for PostHog:

- frontend browser traffic should go through a first-party proxy path on our own domain
- backend Convex traffic and source-map upload continue to use the direct PostHog EU hosts

This is intentional. Vercel rewrites only affect browser requests that hit the deployed frontend domain. They do not apply to Convex functions or to `vite build`.

## Current defaults

Frontend defaults:

- `VITE_POSTHOG_HOST=/snph`
- `VITE_POSTHOG_UI_HOST=https://eu.posthog.com`
- Vercel rewrites:
  - `/snph/static/*` -> `https://eu-assets.i.posthog.com/static/*`
  - `/snph/*` -> `https://eu.i.posthog.com/*`
- Local Vite dev and `vite preview` proxy the same `/snph` path to the same EU hosts

Backend and build defaults:

- Convex backend capture host: `POSTHOG_HOST=https://eu.i.posthog.com`
- Source-map upload host: `POSTHOG_SOURCEMAPS_HOST=https://eu.i.posthog.com`

## Why this is split

The frontend PostHog SDK runs in the browser. Using `/snph` means the browser sends events to the Smartnotes domain first, and Vercel or Vite forwards them to PostHog EU.

The backend PostHog bridge runs inside Convex. Those requests never pass through the Vercel frontend, so a relative path such as `/snph` would be invalid there. Convex must keep using the full PostHog host.

The source-map upload runs during `pnpm build`. That also does not run behind Vercel rewrites, so it must keep using the direct PostHog API host.

## Request flow by environment

### Production on Vercel

1. Browser calls `/snph/...` on the Smartnotes domain.
2. `vercel.json` rewrites the request to the EU PostHog ingest or assets host.
3. The SPA fallback only handles non-PostHog routes because the PostHog rewrites are listed first.

If the SPA rewrite were listed before the PostHog rewrites, PostHog requests could be swallowed by `/index.html`.

### Local `pnpm dev`

1. Browser calls `/snph/...` against the local Vite server.
2. `server.proxy` in `vite.config.ts` forwards those requests to the EU PostHog hosts.
3. This mirrors production behavior closely enough that the frontend can use the same `VITE_POSTHOG_HOST=/snph` value locally and in production.

### Local `pnpm preview`

1. Browser calls `/snph/...` against the preview server.
2. `preview.proxy` forwards those requests to the EU PostHog hosts.

This keeps `pnpm preview` aligned with Vercel behavior.

### Convex backend

1. Convex actions call `https://eu.i.posthog.com/capture/` directly.
2. No Vercel rewrite or Vite proxy is involved.

### Source-map upload in `pnpm build`

1. The PostHog Rollup plugin calls the configured upload host directly.
2. No Vercel rewrite or Vite proxy is involved.

## Environment variable behavior

### Frontend envs

`VITE_POSTHOG_KEY`

- If unset, frontend PostHog is disabled.
- If set, frontend PostHog initializes.

`VITE_POSTHOG_HOST`

- Recommended value: `/snph`
- Allowed values:
  - relative proxy path such as `/snph`
  - absolute URL such as `https://eu.i.posthog.com`
- Default: `/snph`

Behavior:

- Relative path:
  - browser traffic uses the first-party proxy path
  - Vercel rewrites are used in production
  - Vite proxy is used in local dev and preview
- Absolute URL:
  - browser traffic goes directly to that host
  - Vercel rewrites are bypassed
  - Vite proxy is bypassed

`VITE_POSTHOG_UI_HOST`

- Default: `https://eu.posthog.com`
- Used for links back into the PostHog app and related UI features
- This should remain the real PostHog app host, not `/snph`

### Backend envs

`POSTHOG_HOST`

- Default: `https://eu.i.posthog.com`
- Used only by the Convex backend bridge
- Must stay an absolute URL

### Build envs

`POSTHOG_SOURCEMAPS_HOST`

- Default: `https://eu.i.posthog.com`
- Used only during `vite build`
- Must stay an absolute URL

## Supported frontend configurations

### Recommended EU setup

```env
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=/snph
VITE_POSTHOG_UI_HOST=https://eu.posthog.com
```

Result:

- production uses Vercel rewrites
- local dev uses Vite proxy
- local preview uses Vite preview proxy

### Direct-to-PostHog fallback

```env
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://eu.i.posthog.com
VITE_POSTHOG_UI_HOST=https://eu.posthog.com
```

Result:

- production bypasses Vercel rewrites
- local dev bypasses Vite proxy
- local preview bypasses Vite preview proxy

This is supported, but it is not the default deployment model.

### Frontend disabled

```env
VITE_POSTHOG_KEY=
```

Result:

- frontend SDK does not initialize
- backend bridge can still be enabled independently

## Change management

If you change `VITE_POSTHOG_HOST`, you are changing how browser traffic is routed.

Use this checklist:

1. If switching to a relative path, make sure `vercel.json` contains matching rewrites.
2. If switching to a relative path, make sure `vite.config.ts` still proxies the same path for dev and preview.
3. If switching to an absolute URL, expect the first-party proxy to be bypassed everywhere.
4. Do not point `VITE_POSTHOG_UI_HOST` at the proxy path.
5. Do not copy `VITE_POSTHOG_HOST=/snph` into `POSTHOG_HOST` or `POSTHOG_SOURCEMAPS_HOST`.

## Common mistakes

### `VITE_POSTHOG_HOST=https://eu.i.posthog.com` but expecting proxy behavior

This bypasses both the Vercel rewrites and the Vite dev proxy. If you want first-party proxy behavior, use `/snph`.

### `POSTHOG_HOST=/snph` in Convex

This is invalid for backend capture. Convex is not running behind the frontend Vercel domain. Use the absolute EU ingest host.

### `POSTHOG_SOURCEMAPS_HOST=/snph` during build

This is invalid for source-map upload. The build process is not routed through Vercel rewrites. Use the absolute EU ingest host.

### `VITE_POSTHOG_UI_HOST=/snph`

This breaks links and UI integrations that expect the PostHog app origin. Use `https://eu.posthog.com`.

### Moving the SPA rewrite above the PostHog rewrites

This risks serving `index.html` for PostHog requests. Keep the PostHog rewrites before the SPA fallback.

## Files that define the behavior

- `vercel.json`
- `vite.config.ts`
- `src/env.ts`
- `src/features/study/analytics/posthogClient.ts`
- `shared/posthogProxy.ts`

If behavior changes, update this file together with those files.
