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
- Document processing: Vertex file input (PDF/PPT/PPTX/DOC/DOCX) + `officeparser` fallback

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
