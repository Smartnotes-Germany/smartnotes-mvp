# Balanced Observability Mode

## Goal

Balanced mode keeps deep product and runtime insights while minimizing sensitive data capture.

## Behavior

- OpenTelemetry + Langfuse tracing is enabled for all AI SDK `generateText` calls.
- Default capture mode:
  - `recordInputs: false`
  - `recordOutputs: false`
- Trace metadata includes only operational fields (`appScope`, hashed session id, counts, statuses, document ids).
- Sensitive previews are removed from backend logs.
- Every AI action attempts a bounded flush before exit, reducing dropped traces in serverless runtimes.

## Required Convex Environment Variables

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL` (EU cloud: `https://cloud.langfuse.com`)
- `OBSERVABILITY_MODE=balanced`
- `OBSERVABILITY_ALLOW_SENSITIVE_CAPTURE=false`
- `OBSERVABILITY_HASH_SALT=<random secret>`
- `OBSERVABILITY_FLUSH_ON_EXIT=true`
- `OBSERVABILITY_FLUSH_TIMEOUT_MS=300`
- `RETENTION_DAYS_RAW_CONTENT=14`
- `RETENTION_DAYS_ANALYTICS=180`

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
- Langfuse export is still network-dependent and asynchronous.
- A brief ingestion delay is normal; compare parity after 60-120 seconds.

## Trace Metadata for Document Correlation

- For document-based generation flows (`generateQuiz`, `generateTopicDeepDive`), both telemetry and Convex analytics include:
  - `documentIds`: all session document ids considered for the run.
  - `readyDocumentIds`: subset of document ids that were in `ready` state and eligible for model input.
- Use `traceId` as primary key for cross-system matching, and `documentIds`/`readyDocumentIds` to identify exactly which uploads were part of each observation.

Troubleshooting Convex count != Langfuse count:

1. Verify `telemetryProvider` is `langfuse` in `aiAnalyticsEvents`.
2. Check `OBSERVABILITY_FLUSH_ON_EXIT=true` and timeout >= `300`.
3. Compare by `traceId` (source of truth for cross-system matching).
4. Validate `documentIds` / `readyDocumentIds` in metadata for per-upload correlation.
5. If gaps persist, increase timeout to `500` and re-test.
6. If still missing, treat Convex analytics as durable source and inspect network/provider health.

## Retention Automation

- `convex/crons.ts` schedules `retention:runDailyRetention` once daily.
- `retention:runRetentionBatch` applies data lifecycle rules:
  - Redacts old `sessionDocuments.extractedText`.
  - Redacts old `quizResponses.userAnswer`.
  - Deletes old `aiAnalyticsEvents`.

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

If needed, temporarily enable sensitive capture:

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

After the window ends, tracing falls back to balanced defaults automatically.
