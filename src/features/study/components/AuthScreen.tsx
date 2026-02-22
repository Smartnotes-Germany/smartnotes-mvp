import { ArrowRight, Loader2 } from "lucide-react";
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
    <div className="bg-cream text-ink flex min-h-screen flex-col items-center justify-center px-6 py-10 md:px-10">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle preference={preference} setPreference={setPreference} />
      </div>

      <div className="w-full max-w-xl">
        <div className="mb-10 flex items-center justify-center gap-3">
          <img
            src={logoImage}
            alt="Smartnotes"
            className="border-cream-border h-10 w-10 rounded-xl border"
          />
          <p className="text-accent text-lg font-black tracking-[0.16em] uppercase">
            Smartnotes
          </p>
        </div>

        <div className="border-cream-border bg-surface-white rounded-[2rem] border p-6 shadow-sm md:p-10">
          <p className="text-accent mb-2 text-xs font-bold tracking-[0.18em] uppercase">
            Zugang
          </p>
          <h1 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">
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
              <label className="text-ink-muted mb-2 block text-xs font-bold tracking-[0.14em] uppercase">
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
                placeholder="SMARTNOTES-DEMO-2026"
                className="border-cream-border bg-cream-light focus:border-accent mb-5 w-full rounded-2xl border px-4 py-3 text-sm font-medium transition outline-none"
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
                className="bg-accent inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {isRedeemingCode ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ArrowRight size={18} />
                )}
                Weiter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
