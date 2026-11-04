/**
 * @file main.tsx
 * @description Application entry point.
 * Configures Clerk and the Convex client and renders the React application.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./AuthProvider";
import { initializePostHog, posthogClient } from "./features/study/analytics";
import { capturePendingAccessCode } from "./features/study/pendingAccessCode";

initializePostHog();
capturePendingAccessCode();

const analyticsErrorFallback = (
  <div className="app-glow text-ink flex min-h-screen items-center justify-center px-6 text-center">
    <div className="sp-card w-full max-w-md p-6">
      <p className="text-accent mb-2 text-sm font-semibold">Fehler</p>
      <h1 className="mb-3 text-2xl font-medium tracking-[-0.04em]">
        Es ist ein unerwarteter Fehler aufgetreten.
      </h1>
      <p className="text-ink-secondary text-sm">
        Bitte lade die Seite neu. Wenn das Problem bleibt, kontaktiere den
        Support.
      </p>
    </div>
  </div>
);

/** Render the app within Clerk and Convex for authenticated backend calls */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthogClient}>
      <PostHogErrorBoundary fallback={analyticsErrorFallback}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </PostHogErrorBoundary>
    </PostHogProvider>
  </StrictMode>,
);
