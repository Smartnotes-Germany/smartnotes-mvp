/**
 * @file main.tsx
 * @description Application entry point.
 * Configures the Convex client and renders the React application.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";
import "./index.css";
import App from "./App.tsx";
import { resolvedFrontendEnv } from "./env";
import { initializePostHog, posthogClient } from "./features/study/analytics";

/** Initialization of the Convex React client */
const convex = new ConvexReactClient(resolvedFrontendEnv.convexUrl);

initializePostHog();

const analyticsErrorFallback = (
  <div className="bg-cream text-ink flex min-h-screen items-center justify-center px-6 text-center">
    <div className="border-cream-border bg-surface-white w-full max-w-md rounded-2xl border p-6 shadow-sm">
      <p className="text-accent mb-2 text-xs font-bold tracking-[0.2em] uppercase">
        Fehler
      </p>
      <h1 className="mb-3 text-2xl font-bold tracking-tight">
        Es ist ein unerwarteter Fehler aufgetreten.
      </h1>
      <p className="text-ink-secondary text-sm">
        Bitte lade die Seite neu. Wenn das Problem bleibt, kontaktiere den
        Support.
      </p>
    </div>
  </div>
);

/** Render the app within the ConvexProvider for backend interactions */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthogClient}>
      <ConvexProvider client={convex}>
        <PostHogErrorBoundary fallback={analyticsErrorFallback}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PostHogErrorBoundary>
      </ConvexProvider>
    </PostHogProvider>
  </StrictMode>,
);
