import { ArrowRight, Loader2 } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
import type { ThemePreference } from "../types";

type AuthScreenProps = {
  logoImage: string;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  isConsumingMagicLink: boolean;
  accessCodeInput: string;
  onAccessCodeChange: (value: string) => void;
  onRedeemCode: () => Promise<void>;
  isRedeemingCode: boolean;
  authError: string | null;
};

export function AuthScreen({
  logoImage,
  preference,
  setPreference,
  isConsumingMagicLink,
  accessCodeInput,
  onAccessCodeChange,
  onRedeemCode,
  isRedeemingCode,
  authError,
}: AuthScreenProps) {
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
          <p className="text-accent mb-2 text-sm font-semibold">Zugang</p>
          <h1 className="mb-3 text-3xl leading-tight font-medium tracking-[-0.045em] md:text-4xl">
            {isConsumingMagicLink
              ? "Link wird verifiziert..."
              : "Zugangscode eingeben"}
          </h1>
          <p className="text-ink-secondary mb-6 text-sm">
            Kein Konto erforderlich. Ein Einmal-Code gibt dir temporären Zugang.
          </p>

          {isConsumingMagicLink ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 size={48} className="text-accent animate-spin" />
              <p className="text-ink-muted mt-4 text-sm font-medium">
                Deine Anmeldung wird sicher vorbereitet...
              </p>
            </div>
          ) : (
            <>
              <label className="text-ink-secondary mb-2 block text-sm font-medium">
                Zugangscode
              </label>
              <input
                value={accessCodeInput}
                onChange={(event) => onAccessCodeChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void onRedeemCode();
                  }
                }}
                placeholder="STACKPREP-DEMO-2026"
                className="border-cream-border bg-cream-light focus:border-accent mb-5 min-h-12 w-full rounded-full border px-5 py-3 text-sm font-medium transition outline-none"
              />

              {authError && (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {authError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void onRedeemCode()}
                disabled={isRedeemingCode}
                className="pill-button w-full justify-between"
              >
                Weiter
                <span className="pill-button__arrow" aria-hidden="true">
                  {isRedeemingCode ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
