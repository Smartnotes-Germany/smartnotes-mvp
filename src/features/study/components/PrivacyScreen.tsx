import { CheckCircle2, Loader2 } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import type { ThemePreference } from "../types";

type PrivacyScreenProps = {
  logoImage: string;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  onAcceptPrivacy: () => Promise<void>;
  isAcceptingPrivacy: boolean;
};

export function PrivacyScreen({
  logoImage,
  preference,
  setPreference,
  onAcceptPrivacy,
  isAcceptingPrivacy,
}: PrivacyScreenProps) {
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
            Datenschutz
          </p>
          <h1 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">
            Ein letzter Schritt
          </h1>
          <p className="text-ink-secondary mb-6 text-sm leading-relaxed">
            Um Smartnotes stetig zu verbessern, analysieren wir
            Interaktionsdaten und hochgeladene Inhalte. Durch deine Zustimmung
            erlaubst du uns, deine Dokumente und Nutzungsdaten zur
            Bereitstellung des Services sowie zur Fehlerbehebung und
            Weiterentwicklung unserer KI-Modelle zu verwenden.
          </p>

          <a
            href="https://www.smartnotes.tech/datenschutz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent mb-8 inline-block text-xs font-bold tracking-wide underline decoration-2 underline-offset-4 hover:opacity-80"
          >
            Vollständige Datenschutzerklärung lesen
          </a>

          <button
            type="button"
            onClick={() => void onAcceptPrivacy()}
            disabled={isAcceptingPrivacy}
            className="bg-accent inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {isAcceptingPrivacy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            Akzeptieren & Fortfahren
          </button>
        </div>
      </div>
    </div>
  );
}
