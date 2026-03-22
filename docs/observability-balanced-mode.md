# Balanced Observability Mode

## Goal

Balanced mode keeps deep product and runtime insights while minimizing sensitive data capture.

For the complete environment matrix and scope rules, see `docs/environment.md`.
For frontend PostHog proxy routing behavior across prod and dev, see `docs/posthog-proxy.md`.

## Behavior

- OpenTelemetry + Langfuse tracing is enabled for all AI SDK `generateText` calls.
- Langfuse always captures full AI inputs and outputs.
- Trace metadata now includes the full values passed to telemetry instead of truncated operational-only samples.
- Sensitive previews are removed from backend logs.
- Every AI action attempts a bounded flush before exit, reducing dropped traces in serverless runtimes.
- PostHog is used as a product + reliability analytics layer alongside Langfuse tracing.

## PostHog Bridge

- Access-redemption events and AI backend events are first persisted to the Convex `posthogEventOutbox`.
- Node actions perform the actual PostHog delivery, including retries and dead-letter handling.
- Backend emits `ai_operation_completed` and `$ai_generation` to PostHog from the same payload shape that is persisted in the outbox.
- Capture is gated by Convex env vars and drains the outbox without HTTP delivery when disabled.
- This backend bridge sends directly to the configured absolute PostHog host. It does not use the frontend `/snph` proxy path.
- Backend PostHog events also stamp `app_area="app"` and `source_surface="server"`.
- If `POSTHOG_APP_ENV` (or `APP_ENV`) is set in Convex, backend events include
  the explicit environment tag as well.
- The outbox persists the original backend PostHog payload so first delivery and retry delivery stay identical.
- True retries add `retried=true` and `retryAttempt=<n>` to the PostHog event properties.
- Because the outbox stores the original payload, `RETENTION_DAYS_POSTHOG_OUTBOX` must stay aligned with your data retention policy.
- Required Convex vars:
  - `POSTHOG_ENABLED=true|false`
  - `POSTHOG_PROJECT_KEY=<project key>`
  - `POSTHOG_HOST=https://eu.i.posthog.com`
  - optional: `POSTHOG_APP_ENV=development|preview|production`

### Correlation guidance (PR #28)

For cross-system debugging use these fields together:

- `traceId`
- `documentIds`
- `readyDocumentIds`

Format and limits by sink:

- Langfuse telemetry metadata (`experimental_telemetry.metadata`):
  - `documentIds` / `readyDocumentIds` are stored with the full values passed from the backend.
- Convex analytics (`aiAnalyticsEvents.metadataJson`):
  - `documentIds` / `readyDocumentIds` are stored as comma-separated strings.
  - Arrays are truncated to the first 20 entries.
- PostHog AI bridge (`ai_operation_completed` / `$ai_generation`):
  - `documentIds` / `readyDocumentIds` are stored as arrays with their original values in the outbox.
  - The same original values are forwarded to PostHog for both first delivery and retries.

Convex analytics still keep the sampled, truncated correlation view. Langfuse and PostHog both receive the full backend values, while the Convex outbox remains the delivery source of truth for PostHog.

Correlation workflow:

1. Start from a PostHog event with `traceId`.
2. Find the same `traceId` in `aiAnalyticsEvents` and Langfuse traces.
3. Use `documentIds` and `readyDocumentIds` to verify which documents were available and ready for the operation.

### Capture scope

- Langfuse receives full prompts, messages, and model outputs for traced backend AI calls.
- PostHog receives operational metrics plus the original backend outbox payload.
- Correlation fields (`traceId`, `documentIds`, `readyDocumentIds`) remain available in both systems.

## Required Convex Environment Variables

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASEURL` (EU cloud: `https://cloud.langfuse.com`)
- `OBSERVABILITY_MODE=balanced`
- `OBSERVABILITY_ALLOW_SENSITIVE_CAPTURE=false`
- `OBSERVABILITY_HASH_SALT=<random secret>`
- `OBSERVABILITY_FLUSH_ON_EXIT=true`
- `OBSERVABILITY_FLUSH_TIMEOUT_MS=300`
- `RETENTION_DAYS_RAW_CONTENT=14`
- `RETENTION_DAYS_ANALYTICS=180`
- `RETENTION_DAYS_POSTHOG_OUTBOX=30`

## Flush-on-exit delivery strategy

Without an explicit flush, serverless workers can terminate before buffered spans are exported.

- `OBSERVABILITY_FLUSH_ON_EXIT=true` enables a flush attempt at the end of each AI action.
- `OBSERVABILITY_FLUSH_TIMEOUT_MS` caps added latency per action.
- Recommended startup default: `300` ms.

Tradeoff:

- Lower timeout (`100-200` ms): less latency, more risk of missing Langfuse traces.
- Higher timeout (`500-1000` ms): better delivery parity, more tail latency.

Operational expectation:

- Convex analytics events are persisted synchronously in the action transaction path.
- Backend PostHog events are also persisted synchronously first and then delivered via the outbox worker.
- The outbox payload is the source of truth for what backend PostHog delivery will send. Do not document richer PostHog payloads unless they are persisted in `posthogEventOutbox`.
- Langfuse export is still network-dependent and asynchronous.
- A brief ingestion delay is normal; compare parity after 60-120 seconds.

Troubleshooting Convex count != Langfuse count:

1. Verify `telemetryProvider` is `langfuse` in `aiAnalyticsEvents`.
2. Check `OBSERVABILITY_FLUSH_ON_EXIT=true` and timeout >= `300`.
3. Compare by `traceId` (source of truth for cross-system matching).
4. Validate `documentIds` / `readyDocumentIds` in metadata for per-upload correlation.
5. If gaps persist, increase timeout to `500` and re-test.
6. If still missing, treat Convex analytics as durable source and inspect network/provider health.

## Retention Automation

- `convex/crons.ts` schedules `retention:runDailyRetention` once daily.
- `convex/crons.ts` also schedules `analyticsPosthog:processPostHogOutbox` every minute.
- `retention:runRetentionBatch` applies data lifecycle rules:
  - Redacts old `sessionDocuments.extractedText`.
  - Redacts old `quizResponses.userAnswer`.
  - Deletes old `aiAnalyticsEvents`.
  - Deletes old delivered or dead-lettered `posthogEventOutbox` rows.

## Admin Operations

`convex/admin.ts` provides admin-only compliance utilities protected by `ACCESS_CODE_ADMIN_SECRET`:

- `admin:exportData` with `grantToken` or `sessionId`
- `admin:deleteData` with `grantToken` or `sessionId`

Examples:

```bash
pnpm exec convex run admin:exportData '{"adminSecret":"<secret>","grantToken":"<token>","includeContent":false}'
pnpm exec convex run admin:deleteData '{"adminSecret":"<secret>","sessionId":"<session-id>"}'
```

## Temporary Sensitive Debug Window

The debug-window helper still manages the legacy env vars, but it no longer gates Langfuse or PostHog capture:

- Start window (default 30 min):

```bash
pnpm observability:debug-window:start
```

- Start with custom duration:

```bash
pnpm observability:debug-window:start -- --minutes 45
```

- Stop immediately:

```bash
pnpm observability:debug-window:stop
```

The script sets:

- `OBSERVABILITY_ALLOW_SENSITIVE_CAPTURE=true|false`
- `OBSERVABILITY_SENSITIVE_CAPTURE_UNTIL=<unix-ms-timestamp>`

After the window ends, the env vars are cleared again. Langfuse and PostHog capture remain unchanged.
