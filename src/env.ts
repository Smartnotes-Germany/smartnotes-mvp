import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const frontendEnv = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z
      .url("VITE_CONVEX_URL muss eine gültige URL sein."),
    VITE_POSTHOG_KEY: z.string().min(1).optional(),
    VITE_POSTHOG_HOST: z
      .url("VITE_POSTHOG_HOST muss eine gültige URL sein.")
      .optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});

export const resolvedFrontendEnv = {
  convexUrl: frontendEnv.VITE_CONVEX_URL,
  posthog: {
    key: frontendEnv.VITE_POSTHOG_KEY,
    host:
      frontendEnv.VITE_POSTHOG_HOST ??
      "https://eu.i.posthog.com",
  },
} as const;
