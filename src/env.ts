import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import {
  DEFAULT_POSTHOG_PROXY_PATH,
  DEFAULT_POSTHOG_UI_HOST,
  isPostHogHostValue,
  normalizePostHogHost,
} from "../shared/posthogProxy";

export const frontendEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.url("VITE_CONVEX_URL muss eine gültige URL sein."),
    VITE_POSTHOG_KEY: z.string().min(1).optional(),
    VITE_POSTHOG_HOST: z
      .string()
      .min(1, "VITE_POSTHOG_HOST darf nicht leer sein.")
      .refine(
        isPostHogHostValue,
        "VITE_POSTHOG_HOST muss eine absolute URL oder ein relativer Pfad wie /snph sein.",
      )
      .optional(),
    VITE_POSTHOG_UI_HOST: z
      .url("VITE_POSTHOG_UI_HOST muss eine gültige URL sein.")
      .optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});

export const resolvedFrontendEnv = {
  convexUrl: frontendEnv.VITE_CONVEX_URL,
  appArea: "app" as const,
  posthog: {
    key: frontendEnv.VITE_POSTHOG_KEY,
    host: normalizePostHogHost(
      frontendEnv.VITE_POSTHOG_HOST ?? DEFAULT_POSTHOG_PROXY_PATH,
    ),
    uiHost: normalizePostHogHost(
      frontendEnv.VITE_POSTHOG_UI_HOST ?? DEFAULT_POSTHOG_UI_HOST,
    ),
  },
} as const;
