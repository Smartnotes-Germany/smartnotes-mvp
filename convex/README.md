# Convex Backend Notes

This folder contains the Smartnotes backend, not the default Convex starter.

Important current assumptions:

- Access is grant-based and tied to an identifiable person when possible.
- Backend PostHog capture is persisted to a Convex outbox first and only sent
  from Node actions, never from queries or mutations.
- Treat the sanitized outbox payload as the backend PostHog delivery contract.
- If that contract changes, update `../docs/observability-balanced-mode.md` in
  the same patch.
- Backend PostHog delivery uses the direct ingest host, never the frontend
  `/snph` proxy path.
- Backend PostHog events automatically attach `app_area="app"` and
  `source_surface="server"`.
- `POSTHOG_APP_ENV` or `APP_ENV` can be set in Convex to stamp backend events
  with `development`, `preview`, or `production`.

Project-level setup and runtime behavior are documented here:

- Root setup and analytics overview: `../README.md`
- Environment variables: `../docs/environment.md`
- PostHog browser routing and persistence model: `../docs/posthog-proxy.md`
