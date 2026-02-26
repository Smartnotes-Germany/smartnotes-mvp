import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import posthogRollupPlugin from "@posthog/rollup-plugin";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const resolveBuildEnv = (mode: string) => {
  const runtimeEnv = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), ""),
  };

  return createEnv({
    server: {
      POSTHOG_SOURCEMAPS_API_KEY: z.string().min(1).optional(),
      POSTHOG_SOURCEMAPS_PROJECT_ID: z.string().min(1).optional(),
      POSTHOG_SOURCEMAPS_HOST: z
        .string()
        .url()
        .default("https://eu.i.posthog.com"),
      POSTHOG_SOURCEMAPS_RELEASE_NAME: z.string().min(1).optional(),
      POSTHOG_SOURCEMAPS_RELEASE_VERSION: z.string().min(1).optional(),

      // Abwärtskompatibilität
      POSTHOG_API_KEY: z.string().min(1).optional(),
      POSTHOG_PROJECT_ID: z.string().min(1).optional(),
      POSTHOG_HOST: z.string().url().optional(),
      POSTHOG_RELEASE_NAME: z.string().min(1).optional(),
      POSTHOG_RELEASE_VERSION: z.string().min(1).optional(),

      npm_package_name: z.string().min(1).optional(),
      npm_package_version: z.string().min(1).optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
};

const resolvePostHogSourceMapPlugins = (
  buildEnv: ReturnType<typeof resolveBuildEnv>,
) => {
  const apiKey =
    buildEnv.POSTHOG_SOURCEMAPS_API_KEY ?? buildEnv.POSTHOG_API_KEY;
  const projectId =
    buildEnv.POSTHOG_SOURCEMAPS_PROJECT_ID ?? buildEnv.POSTHOG_PROJECT_ID;

  if (!apiKey && !projectId) {
    return [];
  }

  if (!apiKey || !projectId) {
    throw new Error(
      "Für den PostHog-Source-Map-Upload müssen POSTHOG_SOURCEMAPS_API_KEY und POSTHOG_SOURCEMAPS_PROJECT_ID gemeinsam gesetzt sein.",
    );
  }

  const posthogHostRaw =
    buildEnv.POSTHOG_SOURCEMAPS_HOST ??
    buildEnv.POSTHOG_HOST ??
    "https://eu.i.posthog.com";
  const posthogHost = posthogHostRaw.endsWith("/")
    ? posthogHostRaw.slice(0, -1)
    : posthogHostRaw;
  const posthogReleaseName =
    buildEnv.POSTHOG_SOURCEMAPS_RELEASE_NAME ??
    buildEnv.POSTHOG_RELEASE_NAME ??
    buildEnv.npm_package_name ??
    process.env.npm_package_name ??
    "smartnotes";
  const posthogReleaseVersion =
    buildEnv.POSTHOG_SOURCEMAPS_RELEASE_VERSION ??
    buildEnv.POSTHOG_RELEASE_VERSION ??
    buildEnv.npm_package_version ??
    process.env.npm_package_version ??
    "0.0.0";

  return [
    posthogRollupPlugin({
      personalApiKey: apiKey,
      projectId,
      host: posthogHost,
      sourcemaps: {
        enabled: true,
        releaseName: posthogReleaseName,
        releaseVersion: posthogReleaseVersion,
      },
    }),
  ];
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const buildEnv = resolveBuildEnv(mode);
  const sourceMapPlugins = resolvePostHogSourceMapPlugins(buildEnv);

  return {
    plugins: [react(), tailwindcss()],
    build: {
      sourcemap: sourceMapPlugins.length > 0,
      rollupOptions: {
        plugins: sourceMapPlugins,
      },
    },
  };
});
