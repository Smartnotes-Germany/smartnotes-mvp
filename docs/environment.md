# Environment System

This project now uses **two validation layers** for environment variables:

1. **T3 Env (`@t3-oss/env-core`)** for frontend and Vite build-time variables.
2. **Convex runtime helpers** (`convex/env.ts`) for backend variables.

Convex runs in its own runtime model, so we do not use T3 Env directly inside Convex functions.

## Single source of truth

- Frontend env schema: `src/env.ts`
- Build env schema: `vite.config.ts`
- Convex env access helpers: `convex/env.ts`
- Local example file: `.env.example`

## Where each variable belongs

- `.env.local` / `.env.[mode]`: frontend + Vite build envs
- `pnpm exec convex env set ...`: Convex backend envs

Do **not** put Convex backend secrets in Vite env files.

## Frontend runtime env (validated via T3 Env)

Used in browser code (`src/env.ts`).

| Variable            | Required | Default                    | Notes                                   |
| ------------------- | -------- | -------------------------- | --------------------------------------- |
| `VITE_CONVEX_URL`   | yes      | -                          | Convex HTTP URL for `ConvexReactClient` |
| `VITE_POSTHOG_KEY`  | no       | -                          | Enables frontend PostHog when set       |
| `VITE_POSTHOG_HOST` | no       | `https://eu.i.posthog.com` | PostHog ingest host                     |

Legacy aliases (migration only):

- `VITE_PUBLIC_POSTHOG_KEY`
- `VITE_PUBLIC_POSTHOG_HOST`

## Build-time env for `vite.config.ts` (validated via T3 Env)

Used only during `vite build`.

| Variable                             | Required | Default                    | Notes                        |
| ------------------------------------ | -------- | -------------------------- | ---------------------------- |
| `POSTHOG_SOURCEMAPS_API_KEY`         | pair     | -                          | Source-map upload credential |
| `POSTHOG_SOURCEMAPS_PROJECT_ID`      | pair     | -                          | PostHog project id           |
| `POSTHOG_SOURCEMAPS_HOST`            | no       | `https://eu.i.posthog.com` | Upload host                  |
| `POSTHOG_SOURCEMAPS_RELEASE_NAME`    | no       | package name               | Optional release override    |
| `POSTHOG_SOURCEMAPS_RELEASE_VERSION` | no       | package version            | Optional release override    |

Pair behavior:

- both missing => upload disabled
- exactly one set => build fails with a clear error

Legacy aliases (migration only):

- `POSTHOG_API_KEY`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_HOST`
- `POSTHOG_RELEASE_NAME`
- `POSTHOG_RELEASE_VERSION`

## Convex backend env (validated by helper functions)

Used in Convex functions (`convex/*.ts`) through `convex/env.ts` helpers.

### AI / Vertex

| Variable                 | Required    | Default       | Notes                          |
| ------------------------ | ----------- | ------------- | ------------------------------ |
| `GOOGLE_VERTEX_API_KEY`  | conditional | -             | Express Mode auth              |
| `GOOGLE_VERTEX_PROJECT`  | conditional | -             | Required if API key is not set |
| `GOOGLE_VERTEX_LOCATION` | no          | `us-central1` | Vertex region                  |

At least one auth path must exist:

- `GOOGLE_VERTEX_API_KEY`, or
- `GOOGLE_VERTEX_PROJECT` (+ optional `GOOGLE_VERTEX_LOCATION`)

### Access/admin

| Variable                   | Required | Default | Notes                     |
| -------------------------- | -------- | ------- | ------------------------- |
| `ACCESS_CODE_ADMIN_SECRET` | yes      | -       | Protects admin operations |

### Retention

| Variable                     | Required | Default | Notes   |
| ---------------------------- | -------- | ------- | ------- |
| `RETENTION_DAYS_RAW_CONTENT` | no       | `14`    | Min `1` |
| `RETENTION_DAYS_ANALYTICS`   | no       | `180`   | Min `1` |

### Backend PostHog bridge

| Variable              | Required    | Default                    | Notes                                |
| --------------------- | ----------- | -------------------------- | ------------------------------------ |
| `POSTHOG_ENABLED`     | no          | `false`                    | Enables backend event bridge         |
| `POSTHOG_PROJECT_KEY` | conditional | -                          | Required when `POSTHOG_ENABLED=true` |
| `POSTHOG_HOST`        | no          | `https://eu.i.posthog.com` | Backend capture host                 |

### Observability / Langfuse

| Variable                                | Required           | Default           | Notes                                 |
| --------------------------------------- | ------------------ | ----------------- | ------------------------------------- |
| `OBSERVABILITY_MODE`                    | no                 | `balanced`        | `balanced`, `full`, `off`             |
| `OBSERVABILITY_ALLOW_SENSITIVE_CAPTURE` | no                 | `false`           | Debug capture gate                    |
| `OBSERVABILITY_SENSITIVE_CAPTURE_UNTIL` | no                 | -                 | Unix ms timestamp                     |
| `OBSERVABILITY_HASH_SALT`               | no                 | internal fallback | Custom value recommended              |
| `OBSERVABILITY_FLUSH_ON_EXIT`           | no                 | `true`            | Flush telemetry before exit           |
| `OBSERVABILITY_FLUSH_TIMEOUT_MS`        | no                 | `300`             | Clamped to `50..5000`                 |
| `LANGFUSE_PUBLIC_KEY`                   | yes (for Langfuse) | -                 | Langfuse credential                   |
| `LANGFUSE_SECRET_KEY`                   | yes (for Langfuse) | -                 | Langfuse credential                   |
| `LANGFUSE_BASEURL`                      | yes (for Langfuse) | -                 | Example: `https://cloud.langfuse.com` |

Legacy alias (migration only):

- `LANGFUSE_BASE_URL` -> `LANGFUSE_BASEURL`

## Setup flow (recommended)

1. Copy `.env.example` values into `.env.local` and fill frontend/build values.
2. Set Convex envs with `pnpm exec convex env set ...`.
3. Run `pnpm dev`.
4. Before CI/release builds, verify source-map env pair is either fully set or fully unset.

## Migration checklist from legacy names

1. Move frontend values to `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`.
2. Move build values to `POSTHOG_SOURCEMAPS_*`.
3. Move Langfuse URL to `LANGFUSE_BASEURL`.
4. Keep aliases temporarily.
5. Remove aliases after all environments are updated.
