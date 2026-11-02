import { ArrowRight, Loader2 } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
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
    <div className="app-glow text-ink flex min-h-screen flex-col items-center justify-center px-6 py-10 md:px-10">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle preference={preference} setPreference={setPreference} />
      </div>

      <div className="w-full max-w-xl">
        <div className="mb-10 flex justify-center">
          <BrandLogo logoImage={logoImage} />
        </div>

        <div className="sp-card p-6 md:p-10">
          <p className="text-accent mb-2 text-sm font-semibold">Datenschutz</p>
          <h1 className="mb-3 text-3xl leading-tight font-medium tracking-[-0.045em] md:text-4xl">
            Ein letzter Schritt
          </h1>
          <p className="text-ink-secondary mb-6 text-sm leading-relaxed">
            Um StackPrep stetig zu verbessern, analysieren wir Interaktionsdaten
            und hochgeladene Inhalte. Durch deine Zustimmung erlaubst du uns,
            deine Dokumente und Nutzungsdaten zur Bereitstellung des Services
            sowie zur Fehlerbehebung und Weiterentwicklung unserer KI-Modelle zu
            verwenden.
          </p>

          <a
            href="https://www.smartnotes.tech/datenschutz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent mb-8 inline-block text-sm font-medium underline underline-offset-4 hover:opacity-80"
          >
            Vollständige Datenschutzerklärung lesen
          </a>

          <button
            type="button"
            onClick={() => void onAcceptPrivacy()}
            disabled={isAcceptingPrivacy}
            className="pill-button w-full justify-between"
          >
            Akzeptieren & fortfahren
            <span className="pill-button__arrow" aria-hidden="true">
              {isAcceptingPrivacy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
