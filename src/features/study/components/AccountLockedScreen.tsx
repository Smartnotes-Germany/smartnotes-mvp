import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
import type { ThemePreference } from "../types";

type AccountLockedScreenProps = {
  logoImage: string;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  accountEmail?: string;
  authError: string | null;
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
};

/**
 * Den Zugangscode gibt man bei der Registrierung ein. Diese Seite sehen nur
 * Konten, für die dabei kein Code eingelöst werden konnte.
 */
export function AccountLockedScreen({
  logoImage,
  preference,
  setPreference,
  accountEmail,
  authError,
  onSignOut,
  isSigningOut,
}: AccountLockedScreenProps) {
  return (
    <div className="app-glow text-ink flex min-h-screen flex-col items-center justify-center px-6 py-10 md:px-10">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle preference={preference} setPreference={setPreference} />
      </div>

      <div className="w-full max-w-xl">
        <div className="mb-10 flex justify-center">
          <BrandLogo logoImage={logoImage} />
        </div>

        <div className="sp-card p-6 md:p-10">
          <h1 className="mb-3 text-3xl leading-tight font-medium tracking-[-0.045em] md:text-4xl">
            Konto nicht freigeschaltet
          </h1>
          <p className="text-ink-secondary mb-6 text-sm">
            Für dieses Konto wurde noch kein Zugangscode eingelöst. Bitte wende
            dich an das StackPrep-Team, damit wir es freischalten.
          </p>

          {authError && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {authError}
            </p>
          )}

          <p className="text-ink-muted text-sm">
            {accountEmail ? `Angemeldet als ${accountEmail}. ` : ""}
            <button
              type="button"
              onClick={() => void onSignOut()}
              disabled={isSigningOut}
              className="text-accent font-medium underline underline-offset-4 hover:opacity-80"
            >
              Abmelden
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
