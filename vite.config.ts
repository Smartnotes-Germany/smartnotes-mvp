import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import posthogRollupPlugin from "@posthog/rollup-plugin";

const posthogApiKey = process.env.POSTHOG_API_KEY;
const posthogProjectId = process.env.POSTHOG_PROJECT_ID;
const posthogHost = process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";
const shouldUploadSourceMaps = Boolean(posthogApiKey && posthogProjectId);
const posthogReleaseName =
  process.env.POSTHOG_RELEASE_NAME ??
  process.env.npm_package_name ??
  "smartnotes";
const posthogReleaseVersion =
  process.env.POSTHOG_RELEASE_VERSION ??
  process.env.npm_package_version ??
  "0.0.0";

const sourceMapPlugins =
  shouldUploadSourceMaps && posthogApiKey && posthogProjectId
    ? [
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
      ]
    : [];

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
