import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // Frontend API URL der Clerk-Instanz, z. B. https://xyz.clerk.accounts.dev
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
