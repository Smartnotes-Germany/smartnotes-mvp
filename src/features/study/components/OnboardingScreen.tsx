import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  MAX_COMPANY_NAME_LENGTH,
  MAX_SCHOOL_CHALLENGE_LENGTH,
} from "../../../../shared/onboarding";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
import { completeOnboardingRef } from "../convexRefs";
import { formatError } from "../errorUtils";
import type { ThemePreference } from "../types";

type OnboardingScreenProps = {
  logoImage: string;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const fieldClassName =
  "border-cream-border bg-cream-light focus:border-accent min-h-12 w-full rounded-full border px-5 text-sm font-medium transition outline-none";

/**
 * Einmalige Fragen direkt nach der Registrierung. Sobald die Antworten
 * gespeichert sind, meldet der Viewer `onboarded` und die App geht weiter.
 */
export function OnboardingScreen({
  logoImage,
  preference,
  setPreference,
}: OnboardingScreenProps) {
  const completeOnboarding = useMutation(completeOnboardingRef);
  const [companyName, setCompanyName] = useState("");
  const [schoolChallenge, setSchoolChallenge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    if (!companyName.trim()) {
      setError("Bitte gib dein Unternehmen an.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await completeOnboarding({
        companyName,
        schoolChallenge,
      });
    } catch (submitError: unknown) {
      setError(
        formatError(submitError, {
          fallback:
            "Deine Angaben konnten nicht gespeichert werden. Bitte versuche es erneut.",
        }),
      );
      setIsSaving(false);
    }
  };

  return (
    <div className="app-glow text-ink flex min-h-screen flex-col items-center justify-center px-6 py-10 md:px-10">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle preference={preference} setPreference={setPreference} />
      </div>

      <div className="w-full max-w-xl">
        <div className="mb-10 flex justify-center">
          <BrandLogo logoImage={logoImage} />
        </div>

        <form
          className="sp-card animate-step-forward p-6 md:p-10"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="text-accent mb-2 text-sm font-semibold">
            Fast geschafft
          </p>
          <h1 className="mb-3 text-3xl leading-tight font-medium tracking-[-0.045em] md:text-4xl">
            Erzähl uns kurz von dir
          </h1>
          <p className="text-ink-secondary mb-8 text-sm leading-relaxed">
            Damit wir StackPrep auf deine Ausbildung zuschneiden können.
          </p>

          <label
            htmlFor="onboarding-company"
            className="text-ink mb-2 block text-sm font-medium"
          >
            Unternehmen
          </label>
          <input
            id="onboarding-company"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Name deines Ausbildungsbetriebs"
            autoComplete="organization"
            maxLength={MAX_COMPANY_NAME_LENGTH}
            className={`${fieldClassName} mb-8`}
          />

          <label
            htmlFor="onboarding-school-challenge"
            className="text-ink mb-2 flex items-baseline justify-between gap-4 text-sm font-medium"
          >
            Wo hakt es in der Schule?
            <span className="text-ink-muted text-xs font-normal">Optional</span>
          </label>
          <input
            id="onboarding-school-challenge"
            value={schoolChallenge}
            onChange={(event) => setSchoolChallenge(event.target.value)}
            placeholder="z. B. Subnetting oder SQL"
            maxLength={MAX_SCHOOL_CHALLENGE_LENGTH}
            className={`${fieldClassName} mb-8`}
          />

          {error && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="pill-button w-full justify-between"
          >
            Weiter
            <span className="pill-button__arrow" aria-hidden="true">
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
