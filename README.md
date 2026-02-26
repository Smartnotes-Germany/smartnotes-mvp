# Smartnotes

Smartnotes is a Vite + React 19 single-page app backed by Convex.
It runs an anonymous, three-step study flow:

1. Upload class material (PDFs, slides, Word/docs, notes).
2. Generate and answer exam-style questions with explanations.
3. Analyze topic readiness, then deep dive weak topics or start a new session.

The AI pipeline uses the Vercel AI SDK with Google Vertex AI.

## Tech Stack

- Frontend: React 19, Vite, Tailwind CSS
- Backend: Convex (database, file storage, server functions)
- AI: `ai` + `@ai-sdk/google-vertex`
- Document processing: Vertex file input (PDF/PPT/PPTX/DOC/DOCX/JPG/JPEG/PNG/WEBP) + `officeparser` fallback

## Prerequisites

- Node.js 20+
- `pnpm` (required)
- A configured Convex project/deployment
- Google Vertex AI credentials (API key in Express Mode, or project/location auth)

Environment variable reference: `docs/environment.md`.

Validation model:

- Frontend + `vite.config.ts`: T3 Env (`@t3-oss/env-core`)
- Convex backend: runtime helpers in `convex/env.ts` (Convex-specific runtime)

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure Convex and generate types:

```bash
pnpm exec convex dev
```

3. Add frontend env vars in `.env.local`:

```bash
VITE_CONVEX_URL=<your-convex-url>
VITE_POSTHOG_KEY=<your-posthog-project-key>
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

Tip: start from `.env.example` and keep canonical names (`VITE_POSTHOG_*`).

4. Configure backend env vars in Convex:

```bash
pnpm exec convex env set GOOGLE_VERTEX_API_KEY <your-api-key>
# optional alternative auth path
pnpm exec convex env set GOOGLE_VERTEX_PROJECT <your-project-id>
pnpm exec convex env set GOOGLE_VERTEX_LOCATION us-central1
pnpm exec convex env set ACCESS_CODE_ADMIN_SECRET <admin-secret>

# Balanced observability mode (Langfuse + retention)
pnpm exec convex env set LANGFUSE_PUBLIC_KEY <your-langfuse-public-key>
pnpm exec convex env set LANGFUSE_SECRET_KEY <your-langfuse-secret-key>
pnpm exec convex env set LANGFUSE_BASEURL https://cloud.langfuse.com
pnpm exec convex env set OBSERVABILITY_MODE balanced
pnpm exec convex env set OBSERVABILITY_ALLOW_SENSITIVE_CAPTURE false
pnpm exec convex env set OBSERVABILITY_HASH_SALT <random-32+-chars>
pnpm exec convex env set OBSERVABILITY_FLUSH_ON_EXIT true
pnpm exec convex env set OBSERVABILITY_FLUSH_TIMEOUT_MS 300
pnpm exec convex env set RETENTION_DAYS_RAW_CONTENT 14
pnpm exec convex env set RETENTION_DAYS_ANALYTICS 180

# PostHog AI bridge (privacy-safe)
pnpm exec convex env set POSTHOG_ENABLED true
pnpm exec convex env set POSTHOG_PROJECT_KEY <your-posthog-project-key>
pnpm exec convex env set POSTHOG_HOST https://eu.i.posthog.com
```

5. Optional: source map upload for PostHog Error Tracking (build-time env vars):

```bash
# shell env vars before pnpm build
POSTHOG_SOURCEMAPS_API_KEY=<your-posthog-personal-api-key>
POSTHOG_SOURCEMAPS_PROJECT_ID=<your-posthog-project-id>
POSTHOG_SOURCEMAPS_HOST=https://eu.i.posthog.com
# optional release metadata
POSTHOG_SOURCEMAPS_RELEASE_NAME=smartnotes
POSTHOG_SOURCEMAPS_RELEASE_VERSION=0.0.0
```

The source-map upload variables are validated as a pair:

- both missing -> upload disabled
- only one set -> build fails

6. Start the app:

```bash
pnpm dev
```

## Access Codes

- The app is anonymous: no user accounts.
- Users enter a one-time code to receive a temporary grant token.
- Codes are consumed on the first successful redemption.

For local development, `SMARTNOTES-DEMO-2026` auto-seeds if no code exists yet.

To create production codes:

```bash
pnpm exec convex run access:createAccessCodes "{adminSecret:'<admin-secret>',codes:['YOUR-CODE-1','YOUR-CODE-2']}"
```

## Scripts

- `pnpm dev` - start Vite + Convex dev server
- `pnpm build` - typecheck + production build
- `pnpm lint` - run ESLint
- `pnpm format` - format code with Prettier
- `pnpm format:check` - check code formatting
- `pnpm observability:debug-window:start -- --minutes 45` - activate sensitive debug capture for a bounded window
- `pnpm observability:debug-window:stop` - disable sensitive debug capture immediately

## Balanced Observability

- AI calls are traced with Langfuse telemetry in `balanced` mode.
- By default, prompts/responses are not captured (`recordInputs: false`, `recordOutputs: false`).
- Telemetry stores deep operational metadata (latency, token usage, fallback behavior, app scope, status).
- AI actions flush telemetry on exit (`OBSERVABILITY_FLUSH_ON_EXIT`) with a bounded timeout (`OBSERVABILITY_FLUSH_TIMEOUT_MS`) to reduce trace loss.
- A daily Convex cron redacts/deletes older sensitive data:
  - Redacts `sessionDocuments.extractedText` and `quizResponses.userAnswer`.
  - Deletes old `aiAnalyticsEvents` rows.

## PostHog Rollout (Privacy First)

### What is instrumented

- Frontend funnel events from access-code redemption to analysis/deep-dive completion.
- UX events: stage transitions (`study_stage_viewed`), theme changes, consent update hook.
- Backend AI operation bridge event: `ai_operation_completed` plus `$ai_generation` with redacted placeholders.
- Correlation fields for AI observability: `traceId`, `documentIds`, `readyDocumentIds`.

### Privacy guardrails

- No access code, answer text, prompt/response text, extracted document text, or secrets are sent.
- Sensitive UI fields are marked with `ph-no-capture` and `data-ph-sensitive="true"`.
- PostHog frontend starts with `persistence: 'memory'` (consent rollout in PR #24).
- `before_send` applies data scrubbing and conservative sampling for high-volume events.

### Frontend SDK defaults

- `defaults: '2026-01-30'`
- `person_profiles: 'identified_only'`
- `capture_pageview: 'history_change'`
- `capture_pageleave: true`
- `capture_dead_clicks: true`
- `capture_performance: { web_vitals: true, network_timing: true }`
- `disable_session_recording: false`
- `enable_recording_console_log: false`
- `autocapture` enabled with conservative allowlist and copied-text capture disabled

### PostHog UI settings to enable manually

- Session Replay ON.
- Heatmaps ON.
- Error Tracking ON (exception autocapture enabled in project settings).
- Web Vitals ON.
- Initial replay sampling recommendation: 30%, minimum recording duration 10s, trigger failed flows on exceptions.
- Product analytics billing guardrails: set per-product limits before production traffic.

### Feature flag, experiment, survey

- Feature flag key: `analysis_cta_variant` (used in `QuizStage` CTA copy).
- Suggested variants:
  - control: default copy (`Lernanalyse starten`, `Analyse jetzt starten`)
  - kompakt: shorter copy (`Analyse starten`)
- Experiment suggestion: primary metric `analysis_succeeded` rate after `quiz_answer_submitted`.
- Survey suggestion: trigger after `analysis_succeeded`, German copy, repeat cadence capped (e.g. max once per 14 days).

### Data Warehouse starter SQL views (PostHog SQL)

```sql
-- 1) Funnel conversion (auth -> upload -> quiz -> analysis)
SELECT
  distinct_id,
  max(event = 'auth_code_redeem_succeeded') AS auth_ok,
  max(event = 'document_upload_succeeded') AS upload_ok,
  max(event = 'quiz_generation_succeeded') AS quiz_ok,
  max(event = 'analysis_succeeded') AS analysis_ok
FROM events
WHERE timestamp >= now() - interval 30 day
GROUP BY distinct_id;
```

```sql
-- 2) AI reliability by scope/status
SELECT
  properties.scope AS scope,
  properties.status AS status,
  count(*) AS events,
  avg(toFloat64(properties.latencyMs)) AS avg_latency_ms,
  quantile(0.95)(toFloat64(properties.latencyMs)) AS p95_latency_ms,
  avg(toFloat64(properties.totalTokens)) AS avg_total_tokens,
  avg(if(properties.fallbackUsed = true, 1, 0)) AS fallback_rate
FROM events
WHERE event = 'ai_operation_completed'
  AND timestamp >= now() - interval 30 day
GROUP BY properties.scope, properties.status
ORDER BY scope, status;
```

### Data Pipelines plan

- Start with one destination only (free-tier friendly), for example:
  - HTTP webhook destination for daily reliability snapshots, or
  - Batch export to your BI warehouse when available.
- Keep payload minimal and based on already redacted events.

### Dashboards and alerts checklist

- Product funnel dashboard: redeem, upload, quiz generation, answer completion, analysis completion, deep-dive uptake.
- Reliability dashboard: frontend exceptions, AI errors by scope, latency percentiles, fallback trend, replay links.
- Web UX dashboard: p90 web vitals, dead/rage clicks, heatmap hotspots.
- Alerts:
  - error spike
  - analysis failure rate threshold
  - quiz generation failure threshold

See `docs/observability-balanced-mode.md` for implementation details and admin operations.
