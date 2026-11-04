import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkProvider, useAuth } from "@clerk/react";
import { deDE } from "@clerk/localizations";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { resolvedFrontendEnv } from "./env";
import { clerkAppearance } from "./features/study/clerkAppearance";

/** Initialization of the Convex React client */
const convex = new ConvexReactClient(resolvedFrontendEnv.convexUrl);

/** deDE lässt einzelne Texte leer, Clerk zeigt dort sonst Englisch. */
const clerkLocalization = {
  ...deDE,
  formFieldInputPlaceholder__signUpPassword: "Passwort festlegen",
};

/**
 * Clerk handles accounts; Convex receives Clerk's token with every request.
 * Clerk navigates through React Router so its sign-in steps stay client-side.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={resolvedFrontendEnv.clerkPublishableKey}
      localization={clerkLocalization}
      appearance={clerkAppearance}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/anmelden"
      signUpUrl="/registrieren"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/anmelden"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
