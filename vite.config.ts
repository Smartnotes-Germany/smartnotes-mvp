import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import posthogRollupPlugin from "@posthog/rollup-plugin";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import {
  DEFAULT_POSTHOG_ASSETS_HOST,
  DEFAULT_POSTHOG_INGEST_HOST,
  DEFAULT_POSTHOG_PROXY_PATH,
  isRelativeProxyPath,
  normalizePostHogHost,
} from "./shared/posthogProxy";
import { DEV_UPLOAD_PROXY_PATH } from "./shared/uploadProxy";
import { shouldForwardUploadProxyResponseHeader } from "./shared/uploadProxyResponseHeaders";

const resolveBuildEnv = (mode: string) => {
  const runtimeEnv = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), ""),
  };

  return createEnv({
    server: {
      POSTHOG_SOURCEMAPS_API_KEY: z.string().min(1).optional(),
      POSTHOG_SOURCEMAPS_PROJECT_ID: z.string().min(1).optional(),
      POSTHOG_SOURCEMAPS_HOST: z.url().default("https://eu.i.posthog.com"),
      POSTHOG_SOURCEMAPS_RELEASE_NAME: z.string().min(1).optional(),
      POSTHOG_SOURCEMAPS_RELEASE_VERSION: z.string().min(1).optional(),

      // Abwärtskompatibilität
      POSTHOG_API_KEY: z.string().min(1).optional(),
      POSTHOG_PROJECT_ID: z.string().min(1).optional(),
      POSTHOG_HOST: z.url().optional(),
      POSTHOG_RELEASE_NAME: z.string().min(1).optional(),
      POSTHOG_RELEASE_VERSION: z.string().min(1).optional(),

      npm_package_name: z.string().min(1).optional(),
      npm_package_version: z.string().min(1).optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveFrontendPostHogHost = (mode: string) => {
  const frontendHost =
    loadEnv(mode, process.cwd(), "").VITE_POSTHOG_HOST ??
    DEFAULT_POSTHOG_PROXY_PATH;

  return normalizePostHogHost(frontendHost);
};

const createProxyRewrite = (sourcePrefix: string, targetPrefix: string) => {
  const normalizedSourcePrefix = normalizePostHogHost(sourcePrefix);
  const sourcePattern = new RegExp(`^${escapeRegex(normalizedSourcePrefix)}`);

  return (path: string) => {
    const rewrittenPath = path.replace(sourcePattern, targetPrefix);
    return rewrittenPath.length > 0 ? rewrittenPath : "/";
  };
};

const LOCAL_DEV_HOST = "localhost";
const LOCAL_DEV_PORT = 5173;
const LOCAL_PREVIEW_PORT = 4173;

const isAllowedUploadTarget = (target: string) => {
  try {
    const url = new URL(target);
    if (url.protocol !== "https:") {
      return false;
    }

    return [".cloudflarestorage.com", ".convex.cloud", ".convex.site"].some(
      (suffix) => url.hostname.endsWith(suffix),
    );
  } catch {
    return false;
  }
};

const createUploadProxyPlugin = (): Plugin => {
  const registerMiddleware = (middlewares: {
    use: (
      handler: (
        req: {
          method?: string;
          url?: string;
          headers: Record<string, string | string[] | undefined>;
        },
        res: {
          end: (body?: string | Buffer) => void;
          setHeader: (name: string, value: string) => void;
          statusCode: number;
        },
        next: () => void,
      ) => void,
    ) => void;
  }) => {
    middlewares.use((req, res, next) => {
      const requestUrl = req.url
        ? new URL(req.url, `http://${LOCAL_DEV_HOST}`)
        : null;

      if (requestUrl?.pathname !== DEV_UPLOAD_PROXY_PATH) {
        next();
        return;
      }

      const method = req.method?.toUpperCase();
      if (method !== "POST" && method !== "PUT") {
        res.statusCode = 405;
        res.end("Methode nicht erlaubt.");
        return;
      }

      const target = requestUrl.searchParams.get("target");
      if (!target || !isAllowedUploadTarget(target)) {
        res.statusCode = 400;
        res.end("Ungültiges Upload-Ziel.");
        return;
      }

      const headers = new Headers();
      const contentType = req.headers["content-type"];
      const contentLength = req.headers["content-length"];

      if (typeof contentType === "string") {
        headers.set("content-type", contentType);
      }
      if (typeof contentLength === "string") {
        headers.set("content-length", contentLength);
      }

      const upstreamRequest = {
        method,
        headers,
        body: req,
        duplex: "half",
      } as unknown as RequestInit & { duplex: "half" };

      void fetch(target, upstreamRequest)
        .then(async (response) => {
          res.statusCode = response.status;

          response.headers.forEach((value, key) => {
            if (!shouldForwardUploadProxyResponseHeader(key)) {
              return;
            }
            res.setHeader(key, value);
          });

          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        })
        .catch(() => {
          res.statusCode = 502;
          res.end("Lokaler Upload-Proxy konnte das Ziel nicht erreichen.");
        });
    });
  };

  return {
    name: "smartnotes-dev-upload-proxy",
    configureServer(server) {
      registerMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      registerMiddleware(server.middlewares);
    },
  };
};

const resolvePostHogProxy = (frontendPostHogHost: string) => {
  if (!isRelativeProxyPath(frontendPostHogHost)) {
    return undefined;
  }

  const staticProxyPath = `${frontendPostHogHost}/static`;

  return {
    [staticProxyPath]: {
      target: DEFAULT_POSTHOG_ASSETS_HOST,
      changeOrigin: true,
      rewrite: createProxyRewrite(staticProxyPath, "/static"),
    },
    [frontendPostHogHost]: {
      target: DEFAULT_POSTHOG_INGEST_HOST,
      changeOrigin: true,
      rewrite: createProxyRewrite(frontendPostHogHost, ""),
    },
  };
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
  const frontendPostHogHost = resolveFrontendPostHogHost(mode);
  const posthogProxy = resolvePostHogProxy(frontendPostHogHost);

  return {
    plugins: [createUploadProxyPlugin(), react(), tailwindcss()],
    server: {
      host: LOCAL_DEV_HOST,
      port: LOCAL_DEV_PORT,
      strictPort: true,
      proxy: posthogProxy,
    },
    preview: {
      host: LOCAL_DEV_HOST,
      port: LOCAL_PREVIEW_PORT,
      strictPort: true,
      proxy: posthogProxy,
    },
    build: {
      sourcemap: sourceMapPlugins.length > 0,
      rollupOptions: {
        plugins: sourceMapPlugins,
      },
    },
  };
});
