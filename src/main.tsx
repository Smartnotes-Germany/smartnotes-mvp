/**
 * @file main.tsx
 * @description Application entry point.
 * Configures the Convex client and renders the React application.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App.tsx";

/**
 * The URL for the Convex backend.
 * Must be configured in the .env file as VITE_CONVEX_URL.
 */
const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL. Add it to your frontend env file.");
}

/** Initialization of the Convex React client */
const convex = new ConvexReactClient(convexUrl);

/** Render the app within the ConvexProvider for backend interactions */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
