import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Link2,
  Loader2,
  LogOut,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import {
  CreateExamDialog,
  DeleteExamDialog,
  ShareExamDialog,
} from "./ExamDialogs";
import { ThemeToggle } from "./ThemeToggle";
import { useExams } from "../hooks";
import { trackSessionResumed } from "../analytics";
import type { ExamSummary, ThemePreference } from "../types";

const STAGE_STEPS: Record<
  ExamSummary["stage"],
  { step: number; label: string }
> = {
  upload: { step: 1, label: "Unterlagen hochladen" },
  quiz: { step: 2, label: "Quiz" },
  analysis: { step: 3, label: "Analyse" },
};

type ExamsPageProps = {
  logoImage: string;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
};

/** Startseite: alle Prüfungen des Kontos und der Einstieg in eine neue. */
export function ExamsPage({
  logoImage,
  preference,
  setPreference,
  onSignOut,
  isSigningOut,
}: ExamsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { exams, createExam, isCreating, getShareUrl, deleteExam } = useExams();
  // Kommt man von einem geteilten Link, wird die neue Prüfung hervorgehoben.
  const [addedExamId] = useState<string | null>(
    () =>
      (location.state as { addedExamId?: string } | null)?.addedExamId ?? null,
  );
  const [isAddedNoticeVisible, setIsAddedNoticeVisible] = useState(
    Boolean(addedExamId),
  );
  const addedExamTitle = exams?.find((exam) => exam._id === addedExamId)?.title;

  useEffect(() => {
    if (!addedExamId) {
      return;
    }
    // Ohne den Zustand spielt die Animation nach einem Neuladen nicht erneut.
    navigate(location.pathname, { replace: true, state: null });
    const timeout = window.setTimeout(
      () => setIsAddedNoticeVisible(false),
      4000,
    );
    return () => window.clearTimeout(timeout);
  }, [addedExamId, location.pathname, navigate]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [examToShare, setExamToShare] = useState<ExamSummary | null>(null);
  const [examToDelete, setExamToDelete] = useState<ExamSummary | null>(null);

  const handleCreate = async (title: string, examDate: string) => {
    const sessionId = await createExam({ title, examDate });
    navigate(`/pruefung/${sessionId}`);
  };

  const createButton = (
    <button
      type="button"
      onClick={() => setIsDialogOpen(true)}
      className="pill-button"
    >
      Prüfung erstellen
      <span className="pill-button__arrow" aria-hidden="true">
        <Plus size={16} />
      </span>
    </button>
  );

  return (
    <div className="app-glow text-ink min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-6 md:px-8">
        <BrandLogo logoImage={logoImage} />
        <div className="flex items-center gap-2">
          <ThemeToggle preference={preference} setPreference={setPreference} />
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={isSigningOut}
            aria-label="Abmelden"
            className="pill-button pill-button--quiet gap-2 px-3 sm:px-4"
          >
            {isSigningOut ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LogOut size={14} />
            )}
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-4 pb-16 md:px-8 md:pt-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6 md:mb-10">
          <div>
            <p className="text-accent mb-2 text-sm font-semibold">
              Deine Prüfungen
            </p>
            <h1 className="text-3xl leading-tight font-medium tracking-[-0.045em] md:text-5xl">
              Worauf lernst du gerade?
            </h1>
          </div>
          {exams && exams.length > 0 && createButton}
        </div>

        {exams === undefined ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="sp-card h-44 animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : exams.length === 0 ? (
          <div className="sp-card flex flex-col items-center px-6 py-14 text-center md:py-20">
            <span className="bg-action/15 text-accent mb-6 grid h-14 w-14 place-items-center rounded-full">
              <GraduationCap size={26} aria-hidden="true" />
            </span>
            <h2 className="mb-2 text-2xl font-medium tracking-[-0.03em]">
              Noch keine Prüfung
            </h2>
            <p className="text-ink-secondary mb-8 max-w-md">
              Leg deine erste Prüfung an, lade deine Unterlagen hoch und starte
              das Quiz.
            </p>
            {createButton}
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {exams.map((exam) => (
              <li key={exam._id}>
                <ExamCard
                  exam={exam}
                  isNew={exam._id === addedExamId}
                  onShare={() => setExamToShare(exam)}
                  onDelete={() => setExamToDelete(exam)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {isDialogOpen && (
        <CreateExamDialog
          isCreating={isCreating}
          onCreate={handleCreate}
          onClose={() => setIsDialogOpen(false)}
        />
      )}

      {isAddedNoticeVisible && addedExamTitle && (
        <div
          role="status"
          className="border-cream-border animate-fade-up fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border bg-white px-5 py-3 text-sm font-medium shadow-xl dark:bg-[#0f1426]"
        >
          <CheckCircle2
            size={18}
            className="text-accent shrink-0"
            aria-hidden="true"
          />
          <span className="truncate">
            „{addedExamTitle}“ ist jetzt in deinen Prüfungen.
          </span>
        </div>
      )}

      {examToShare && (
        <ShareExamDialog
          title={examToShare.title}
          getShareUrl={() => getShareUrl(examToShare._id)}
          onClose={() => setExamToShare(null)}
        />
      )}

      {examToDelete && (
        <DeleteExamDialog
          title={examToDelete.title}
          onDelete={() => deleteExam(examToDelete._id)}
          onClose={() => setExamToDelete(null)}
        />
      )}
    </div>
  );
}

const formatExamDate = (examDate: string) =>
  new Date(`${examDate}T00:00:00`).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** „in 12 Tagen“, „morgen“ oder „vorbei“, gezählt in Kalendertagen. */
const describeDaysUntil = (examDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round(
    (new Date(`${examDate}T00:00:00`).getTime() - today.getTime()) / 86_400_000,
  );

  if (days < 0) return "vorbei";
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
};

function ExamCard({
  exam,
  isNew,
  onShare,
  onDelete,
}: {
  exam: ExamSummary;
  isNew: boolean;
  onShare: () => void;
  onDelete: () => void;
}) {
  const { step, label } = STAGE_STEPS[exam.stage];

  return (
    // Das Menü liegt neben dem Link, Buttons dürfen nicht in einem Link stecken.
    <div
      className={`sp-card group hover:border-accent/60 relative h-full transition ${
        isNew ? "animate-card-added" : ""
      }`}
    >
      <ExamCardMenu onShare={onShare} onDelete={onDelete} />
      <Link
        to={`/pruefung/${exam._id}`}
        onClick={() => trackSessionResumed()}
        className="flex h-full flex-col rounded-[inherit] p-6 pr-16 md:p-7 md:pr-16"
      >
        <h2 className="text-ink mb-3 line-clamp-2 text-xl font-medium tracking-[-0.03em]">
          {exam.title}
        </h2>

        <p className="text-ink-secondary mb-6 flex items-center gap-2 text-sm">
          <CalendarDays size={15} className="shrink-0" aria-hidden="true" />
          {exam.examDate ? (
            <>
              {formatExamDate(exam.examDate)}
              <span className="text-accent font-medium">
                · {describeDaysUntil(exam.examDate)}
              </span>
            </>
          ) : (
            "Kein Termin"
          )}
        </p>

        <div className="mt-auto">
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="text-ink font-medium">{label}</span>
            <span className="text-ink-muted tabular-nums">
              Schritt {step} von 3
            </span>
          </div>
          <div className="mb-5 flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((segment) => (
              <span
                key={segment}
                className={`h-1.5 flex-1 rounded-full ${
                  segment < step
                    ? "progress-fill"
                    : segment === step
                      ? "bg-accent/40"
                      : "bg-ink/15"
                }`}
              />
            ))}
          </div>
          <span className="text-accent inline-flex items-center gap-1.5 text-sm font-semibold">
            {exam.stage === "analysis" ? "Analyse ansehen" : "Fortsetzen"}
            <ArrowRight
              size={15}
              className="transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </div>
  );
}

function ExamCardMenu({
  onShare,
  onDelete,
}: {
  onShare: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const choose = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const itemClassName =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition";

  return (
    <div ref={menuRef} className="absolute top-4 right-4 z-10">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Optionen"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="text-ink-secondary hover:text-ink hover:bg-cream-light grid h-9 w-9 place-items-center rounded-full transition"
      >
        <MoreHorizontal size={18} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="border-cream-border absolute top-11 right-0 w-48 rounded-2xl border bg-white p-1.5 shadow-xl dark:bg-[#0f1426]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onShare)}
            className={`${itemClassName} text-ink hover:bg-cream-light`}
          >
            <Link2 size={16} className="text-accent" aria-hidden="true" />
            Link teilen
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onDelete)}
            className={`${itemClassName} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950`}
          >
            <Trash2 size={16} aria-hidden="true" />
            Löschen
          </button>
        </div>
      )}
    </div>
  );
}
