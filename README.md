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
```

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
pnpm exec convex env set LANGFUSE_BASE_URL https://cloud.langfuse.com
pnpm exec convex env set OBSERVABILITY_MODE balanced
pnpm exec convex env set OBSERVABILITY_ALLOW_SENSITIVE_CAPTURE false
pnpm exec convex env set OBSERVABILITY_HASH_SALT <random-32+-chars>
pnpm exec convex env set OBSERVABILITY_FLUSH_ON_EXIT true
pnpm exec convex env set OBSERVABILITY_FLUSH_TIMEOUT_MS 300
pnpm exec convex env set RETENTION_DAYS_RAW_CONTENT 14
pnpm exec convex env set RETENTION_DAYS_ANALYTICS 180
```

5. Start the app:

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
pnpm exec convex run access:createAccessCodes '{"adminSecret":"<admin-secret>","codes":["YOUR-CODE-1","YOUR-CODE-2"]}'
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

See `docs/observability-balanced-mode.md` for implementation details and admin operations.
