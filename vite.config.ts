import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import posthogRollupPlugin from "@posthog/rollup-plugin";

const posthogApiKey = process.env.POSTHOG_API_KEY;
const posthogProjectId = process.env.POSTHOG_PROJECT_ID;
const posthogHost = process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";
const posthogReleaseName =
  process.env.POSTHOG_RELEASE_NAME ??
  process.env.npm_package_name ??
  "smartnotes";
const posthogReleaseVersion =
  process.env.POSTHOG_RELEASE_VERSION ??
  process.env.npm_package_version ??
  "0.0.0";

const sourceMapPlugins = (() => {
  // Will not be longer necessary when we got T3 ENV initialised.
  if (!posthogApiKey || !posthogProjectId) {
    throw new Error(
      "POSTHOG_API_KEY und POSTHOG_PROJECT_ID müssen beide gesetzt sein.",
    );
  }

  return [
    posthogRollupPlugin({
      personalApiKey: posthogApiKey,
      projectId: posthogProjectId,
      host: posthogHost,
      sourcemaps: {
        enabled: true,
        releaseName: posthogReleaseName,
        releaseVersion: posthogReleaseVersion,
      },
    }),
  ];
})();

const shouldUploadSourceMaps = sourceMapPlugins.length > 0;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: shouldUploadSourceMaps,
    rollupOptions: {
      plugins: sourceMapPlugins,
    },
  },
});
