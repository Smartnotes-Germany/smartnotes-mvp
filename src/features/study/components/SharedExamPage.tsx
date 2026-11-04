import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Loader2,
  Tags,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
import { importSharedExamRef, sharedExamRef } from "../convexRefs";
import { formatError } from "../errorUtils";
import { clearPendingShareToken } from "../pendingShareLink";
import type { ThemePreference } from "../types";

type SharedExamPageProps = {
  logoImage: string;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const formatExamDate = (examDate: string) =>
  new Date(`${examDate}T00:00:00`).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Geöffneter Teilen-Link: Vorschau und Übernahme in die eigenen Prüfungen. */
export function SharedExamPage({
  logoImage,
  preference,
  setPreference,
}: SharedExamPageProps) {
  const token = useParams().token ?? "";
  const navigate = useNavigate();
  const sharedExam = useQuery(sharedExamRef, { token });
  const importSharedExam = useMutation(importSharedExamRef);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearPendingShareToken();
  }, []);

  const addToExams = async () => {
    setIsImporting(true);
    setError(null);
    try {
      const sessionId = await importSharedExam({ token });
      // Die Startseite hebt die neue Prüfung kurz hervor.
      navigate("/", { state: { addedExamId: sessionId } });
    } catch (importError: unknown) {
      setError(
        formatError(importError, {
          fallback: "Die Prüfung konnte nicht hinzugefügt werden.",
        }),
      );
      setIsImporting(false);
    }
  };

  return (
    <div className="app-glow text-ink flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle preference={preference} setPreference={setPreference} />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <BrandLogo logoImage={logoImage} />
        </div>

        <div className="sp-card animate-step-forward p-6 md:p-8">
          {sharedExam === undefined ? (
            <div className="flex justify-center py-10">
              <Loader2 size={28} className="text-accent animate-spin" />
            </div>
          ) : sharedExam === null ? (
            <>
              <h1 className="mb-3 text-2xl font-medium tracking-[-0.04em]">
                Link ungültig
              </h1>
              <p className="text-ink-secondary mb-8 text-sm leading-relaxed">
                Diese Prüfung gibt es nicht mehr oder der Link ist falsch.
              </p>
              <Link to="/" className="pill-button">
                Zu deinen Prüfungen
              </Link>
            </>
          ) : (
            <>
              <p className="text-accent mb-2 text-sm font-semibold">
                {sharedExam.isOwner ? "Dein geteilter Link" : "Mit dir geteilt"}
              </p>
              <h1 className="mb-5 text-2xl leading-tight font-medium tracking-[-0.04em] md:text-3xl">
                {sharedExam.title}
              </h1>

              <ul className="text-ink-secondary mb-8 space-y-2.5 text-sm">
                <li className="flex items-center gap-2.5">
                  <FileText size={16} aria-hidden="true" />
                  {sharedExam.documentCount === 1
                    ? "1 Unterlage"
                    : `${sharedExam.documentCount} Unterlagen`}
                </li>
                <li className="flex items-center gap-2.5">
                  <Tags size={16} aria-hidden="true" />
                  {sharedExam.topicCount === 1
                    ? "1 Thema"
                    : `${sharedExam.topicCount} Themen`}
                </li>
                {sharedExam.examDate && (
                  <li className="flex items-center gap-2.5">
                    <CalendarDays size={16} aria-hidden="true" />
                    Prüfung am {formatExamDate(sharedExam.examDate)}
                  </li>
                )}
              </ul>

              {error && (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {error}
                </p>
              )}

              {sharedExam.ownSessionId ? (
                <>
                  <p className="text-ink-secondary mb-4 text-sm">
                    {sharedExam.isOwner
                      ? "Das ist deine eigene Prüfung."
                      : "Diese Prüfung ist schon in deinen Prüfungen."}
                  </p>
                  <Link
                    to={`/pruefung/${sharedExam.ownSessionId}`}
                    className="pill-button w-full justify-between"
                  >
                    Öffnen
                    <span className="pill-button__arrow" aria-hidden="true">
                      <ArrowRight size={16} />
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-ink-secondary mb-4 text-sm leading-relaxed">
                    Du bekommst eine eigene Kopie. Deine Antworten sieht niemand
                    außer dir.
                  </p>
                  <button
                    type="button"
                    onClick={() => void addToExams()}
                    disabled={isImporting}
                    className="pill-button w-full justify-between"
                  >
                    Zu meinen Prüfungen hinzufügen
                    <span className="pill-button__arrow" aria-hidden="true">
                      {isImporting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <ArrowRight size={16} />
                      )}
                    </span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
