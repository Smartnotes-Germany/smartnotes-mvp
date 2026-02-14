import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  CircleAlert,
  FileImage,
  Layers,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import logoImage from './assets/images/logo.png';

const flowSteps = [
  { id: 1, label: 'Eingaben' },
  { id: 2, label: 'Priorisierung' },
  { id: 3, label: 'Selbstcheck' },
  { id: 4, label: 'Auswertung' },
] as const;

const initialFiles = ['Biologie_Kapitel5.pptx', 'Whiteboard_Zellatmung.jpg', 'Notizen_Stoffwechsel.pdf'];

const prioritizedTopics = [
  {
    id: 'prio1',
    priority: 'Priorität 1',
    title: 'Zellatmung: Ablauf und Bilanz',
    reason: 'Grundlage für mehrere typische Testaufgaben im Kapitel Stoffwechsel.',
  },
  {
    id: 'prio2',
    priority: 'Priorität 2',
    title: 'ATP-Ertrag pro Glukose anwenden',
    reason: 'Rechenaufgaben dazu sind in Klasse 10 oft direkt punkterelevant.',
  },
  {
    id: 'prio3',
    priority: 'Priorität 3',
    title: 'Ort der Reaktionen in der Zelle',
    reason: 'Wird häufig als Begründung oder Zuordnungsfrage abgefragt.',
  },
] as const;

const understandingTasks = [
  {
    id: 'q1',
    topic: 'Sauerstoffmangel und ATP',
    type: 'Offene Frage',
    text: 'Erkläre, warum bei Sauerstoffmangel deutlich weniger ATP entsteht.',
  },
  {
    id: 'q2',
    topic: 'ATP-Bilanz rechnen',
    type: 'Rechenaufgabe',
    text: 'Berechne die ATP-Ausbeute für 2 Moleküle Glukose und begründe die Zwischenschritte.',
  },
  {
    id: 'q3',
    topic: 'Atmungskette begründen',
    type: 'Begründungsaufgabe',
    text: 'Begründe, weshalb die Atmungskette als entscheidender Schritt der Energiegewinnung gilt.',
  },
] as const;

type SelfCheckRating = 'sicher' | 'teilweise' | 'unsicher';
type UnderstandingRatings = Record<string, SelfCheckRating | undefined>;

const selfCheckOptions: Array<{ id: SelfCheckRating; label: string; helper: string }> = [
  { id: 'sicher', label: 'Kann ich sicher', helper: 'ohne Hilfe erklären oder rechnen' },
  { id: 'teilweise', label: 'Teilweise sicher', helper: 'Grundidee klar, bei Details unsicher' },
  { id: 'unsicher', label: 'Noch unsicher', helper: 'ich brauche Wiederholung' },
];

const ratingToScore: Record<SelfCheckRating, number> = {
  sicher: 85,
  teilweise: 60,
  unsicher: 35,
};

const ratingToLabel: Record<SelfCheckRating, string> = {
  sicher: 'Sicher',
  teilweise: 'Teilweise sicher',
  unsicher: 'Unsicher',
};

const teacherHintExamples = [
  'Ableitungen anwenden, keine Beweise',
  'Kapitel 3-5, Schwerpunkt Energie',
  'Aufgaben wie im letzten Test',
] as const;

function StepTracker({
  currentStep,
  className,
}: {
  currentStep: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 sm:grid-cols-4 ${className ?? ''}`}>
      {flowSteps.map((step) => {
        const isDone = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <div
            key={step.id}
            className={`rounded-lg border px-3 py-2 text-[0.72rem] transition-colors ${
              isActive
                ? 'border-accent/55 bg-accent/10 text-ink'
                : isDone
                  ? 'border-cream-border bg-cream-light text-ink-secondary'
                  : 'border-cream-border bg-surface-white text-ink-muted'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-semibold ${
                  isActive ? 'bg-accent text-cream' : isDone ? 'bg-ink text-cream' : 'bg-cream-dark text-ink-muted'
                }`}
              >
                <span className="leading-none text-center">{isDone ? '✓' : step.id}</span>
              </span>
              <span className="font-medium">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PageShell({
  currentStep,
  title,
  subtitle,
  subject,
  grade,
  children,
}: {
  currentStep: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  subject: string;
  grade: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-20 h-80 w-80 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute right-0 top-0 h-[30rem] w-[30rem] rounded-full bg-cream-dark/70 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-6 md:px-8 md:pt-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-cream-border pb-5 md:pb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-sm border border-cream-border bg-surface-white">
              <img src={logoImage} alt="Smartnotes Logo" className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-accent">Smartnotes</p>
              <h1 className="editorial-heading text-[1.2rem]">Prüfungsrelevanz und Verständnis</h1>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-xl border border-cream-border bg-cream-light/75 p-4 md:p-5">
            <p className="section-label">Lernfluss</p>
            <p className="mt-2 text-[0.88rem] font-medium text-ink-secondary">Schritt {currentStep} von 4</p>
            <StepTracker currentStep={currentStep} className="mt-4 sm:grid-cols-2 lg:grid-cols-1" />
            <hr className="editorial-separator my-4" />
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">Aktueller Kontext</p>
            <div className="mt-2 space-y-2 text-[0.75rem] text-ink-secondary">
              <div className="rounded-md border border-cream-border bg-surface-white px-2.5 py-2">
                Fach: <span className="font-semibold text-ink">{subject}</span>
              </div>
              <div className="rounded-md border border-cream-border bg-surface-white px-2.5 py-2">
                Stufe: <span className="font-semibold text-ink">{grade}</span>
              </div>
            </div>
          </aside>

          <motion.main
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[70vh] rounded-xl border border-cream-border bg-surface-white/90 p-6 shadow-[0_14px_34px_rgba(30,24,18,0.06)] md:p-8"
          >
            <span className="section-label">Schritt {currentStep} von 4</span>
            <h2 className="editorial-heading mt-4 text-[1.9rem] leading-[1.12] md:text-[2.4rem]">{title}</h2>
            <p className="mt-3 max-w-3xl text-[0.9rem] leading-relaxed text-ink-secondary">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </motion.main>
        </div>
      </div>
    </div>
  );
}

function StartPage({
  subject,
  setSubject,
  grade,
  setGrade,
  files,
  teacherHint,
  setTeacherHint,
}: {
  subject: string;
  setSubject: (value: string) => void;
  grade: string;
  setGrade: (value: string) => void;
  files: string[];
  teacherHint: string;
  setTeacherHint: (value: string) => void;
}) {
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleStart = () => {
    setIsStarting(true);
    timerRef.current = window.setTimeout(() => {
      navigate('/relevanz');
    }, 1000);
  };

  return (
    <PageShell
      currentStep={1}
      title="Material eingeben und Analyse starten"
      subtitle="Alle Unterlagen werden beim Start automatisch analysiert. Fach, Klassenstufe und Lehrerhinweis steuern, was danach als testrelevant priorisiert wird."
      subject={subject}
      grade={grade}
    >
      <div className="rounded-xl border border-cream-border bg-cream-light p-4 md:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">Deine Unterlagen</p>
        <p className="mt-1 text-[0.76rem] text-ink-secondary">Diese Dateien werden in Schritt 2 direkt für die Priorisierung genutzt.</p>
        <div className="mt-3 grid gap-2">
          {files.map((file, index) => {
            const isAnalyzed = index < 2;

            return (
              <div
                key={file}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-cream-border bg-surface-white px-3 py-2.5 text-[0.8rem] text-ink-secondary"
              >
                <span className="flex items-center gap-2.5">
                  <FileImage size={14} className="text-accent" />
                  <span>{file}</span>
                </span>
                {isAnalyzed ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#b7ddb9] bg-[#e8f5e9] px-2 py-0.5 text-[0.65rem] font-semibold text-[#2f7d32]">
                    <CheckCircle2 size={11} />
                    Analysiert
                  </span>
                ) : (
                  <span className="rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 text-[0.65rem] font-semibold text-accent">
                    Wird analysiert...
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-cream-border bg-surface-white px-3 py-2 text-[0.75rem] font-medium text-ink-secondary"
        >
          <Upload size={13} />
          Weitere Datei hinzufügen
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="rounded-xl border border-cream-border bg-cream-light px-4 py-3 text-[0.75rem] text-ink-secondary">
          Fach (für passende Aufgabentypen)
          <select
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1.5 w-full bg-transparent text-[0.86rem] font-medium text-ink outline-none"
          >
            <option>Biologie</option>
            <option>Geschichte</option>
            <option>Mathematik</option>
            <option>Chemie</option>
          </select>
        </label>

        <label className="rounded-xl border border-cream-border bg-cream-light px-4 py-3 text-[0.75rem] text-ink-secondary">
          Klassenstufe (beeinflusst die Relevanz)
          <select
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            className="mt-1.5 w-full bg-transparent text-[0.86rem] font-medium text-ink outline-none"
          >
            <option>8. Klasse</option>
            <option>9. Klasse</option>
            <option>10. Klasse</option>
            <option>11. Klasse</option>
          </select>
          <span className="mt-1 block text-[0.68rem] text-ink-muted">Beispiel: In Klasse 10 werden Grundlagen höher gewichtet als Randthemen.</span>
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-cream-border bg-cream-light p-4 md:p-5">
        <label className="block text-[0.78rem] font-medium text-ink">
          Gibt es konkrete Hinweise für den Test?
          <span className="ml-1 text-ink-muted">(optional)</span>
        </label>

        <textarea
          value={teacherHint}
          onChange={(event) => setTeacherHint(event.target.value)}
          maxLength={180}
          rows={3}
          placeholder="Zum Beispiel: Schwerpunkt Energieumwandlung, keine Detailfragen zu Sonderfällen"
          className="mt-2.5 w-full resize-none rounded-xl border border-cream-border bg-surface-white px-3 py-2.5 text-[0.82rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent/50"
        />

        <div className="mt-2 flex items-center justify-between text-[0.68rem] text-ink-muted">
          <span>1-2 Sätze. Kein Roman.</span>
          <span>{teacherHint.length}/180</span>
        </div>

        <div className="mt-3">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">Beispiel-Eingaben</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {teacherHintExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setTeacherHint(example)}
                className="rounded-lg border border-cream-border bg-surface-white px-3 py-1.5 text-[0.7rem] text-ink-secondary transition-colors hover:border-accent/45 hover:text-ink"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-cream-border bg-surface-white px-4 py-3 text-[0.78rem] text-ink-secondary">
        <span className="mb-2 block text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-accent">Was nach dem Klick passiert</span>
        <p>1) Dateien werden analysiert, 2) testrelevante Themen werden priorisiert, 3) du schätzt deinen Stand dazu ein.</p>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleStart}
          disabled={isStarting}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-[0.82rem] font-semibold tracking-wide text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-75"
        >
          {isStarting ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
          {isStarting ? 'Analyse wird gestartet...' : 'Analyse starten'}
        </button>
      </div>
    </PageShell>
  );
}

function RelevancePage({ subject, grade, teacherHint }: { subject: string; grade: string; teacherHint: string }) {
  const navigate = useNavigate();
  const hasTeacherHint = teacherHint.trim().length > 0;

  return (
    <PageShell
      currentStep={2}
      title="Was für den Test zuerst zählt"
      subtitle="Diese Priorisierung basiert auf deinen Unterlagen, dem Fach, der Klassenstufe und optional deinem Lehrerhinweis."
      subject={subject}
      grade={grade}
    >
      <div className="rounded-xl border border-cream-border bg-cream-light p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-cream-border bg-surface-white text-accent">
            <Layers size={14} />
          </div>
          <h3 className="text-[0.9rem] font-semibold text-ink">Priorisierte Themen für deinen Test</h3>
        </div>

        <div className="space-y-2.5">
          {prioritizedTopics.map((topic) => (
            <div key={topic.id} className="rounded-xl border border-cream-border bg-surface-white px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.78rem] font-semibold text-ink">{topic.title}</p>
                  <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-secondary">{topic.reason}</p>
                </div>
                <span className="rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 text-[0.65rem] font-semibold text-accent">
                  {topic.priority}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-cream-border bg-surface-white px-4 py-3 text-[0.78rem] text-ink-secondary">
        <span className="mb-2 block text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-accent">Eingaben in dieser Priorisierung</span>
        <p>
          Fach: <strong className="text-ink">{subject}</strong> | Klassenstufe: <strong className="text-ink">{grade}</strong> | Lehrerhinweis:{' '}
          <strong className="text-ink">{hasTeacherHint ? 'berücksichtigt' : 'kein Hinweis angegeben'}</strong>
        </p>
      </div>

      {hasTeacherHint && (
        <div className="mt-3 rounded-xl border border-cream-border bg-surface-white px-4 py-3 text-[0.78rem] text-ink-secondary">
          <span className="mb-1 block text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-accent">Lehrerhinweis</span>
          "{teacherHint.trim()}"
        </div>
      )}

      <div className="mt-3 rounded-xl border border-cream-border bg-cream-light px-4 py-3 text-[0.78rem] text-ink-secondary">
        Wenn wenig Zeit bleibt: Starte mit <strong className="text-ink">Priorität 1</strong> und <strong className="text-ink">Priorität 2</strong>.
        </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/start')}
          className="inline-flex items-center gap-2 rounded-lg border border-cream-border bg-surface-white px-4 py-2.5 text-[0.78rem] font-semibold text-ink-secondary transition-colors hover:bg-cream-light"
        >
          <ArrowLeft size={14} />
          Zurück
        </button>
        <button
          type="button"
          onClick={() => navigate('/verstaendnis')}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.78rem] font-semibold text-cream transition-colors hover:bg-ink/90"
        >
          Weiter zum Selbstcheck
          <ArrowRight size={14} />
        </button>
      </div>
    </PageShell>
  );
}

function UnderstandingPage({
  subject,
  grade,
  ratings,
  setRatings,
}: {
  subject: string;
  grade: string;
  ratings: UnderstandingRatings;
  setRatings: Dispatch<SetStateAction<UnderstandingRatings>>;
}) {
  const navigate = useNavigate();
  const answeredCount = useMemo(
    () => understandingTasks.filter((task) => ratings[task.id] !== undefined).length,
    [ratings],
  );
  const allTasksRated = answeredCount === understandingTasks.length;

  const handleSelect = (taskId: string, rating: SelfCheckRating) => {
    setRatings((prev) => ({ ...prev, [taskId]: rating }));
  };

  return (
    <PageShell
      currentStep={3}
      title="Selbstcheck zu den Prioritäten"
      subtitle="Schätze pro Aufgabe ehrlich ein, wie sicher du sie aktuell lösen könntest. Das ist der Zwischenschritt vor der Auswertung."
      subject={subject}
      grade={grade}
    >
      <div className="space-y-3">
        {understandingTasks.map((task) => {
          const selectedRating = ratings[task.id];

          return (
            <div
              key={task.id}
              className={`w-full rounded-xl border p-4 text-left ${
                selectedRating ? 'border-accent/50 bg-accent/8' : 'border-cream-border bg-cream-light'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">{task.type}</span>
                <span className="rounded-md border border-cream-border bg-surface-white px-2 py-0.5 text-[0.64rem] font-semibold text-ink-secondary">
                  {task.topic}
                </span>
              </div>
              <p className="text-[0.86rem] leading-relaxed text-ink-secondary">{task.text}</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {selfCheckOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(task.id, option.id)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      selectedRating === option.id
                        ? 'border-accent/60 bg-surface-white text-ink'
                        : 'border-cream-border bg-surface-white text-ink-secondary hover:border-accent/35'
                    }`}
                  >
                    <span className="block text-[0.74rem] font-semibold">{option.label}</span>
                    <span className="mt-1 block text-[0.68rem] leading-snug text-ink-muted">{option.helper}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-cream-border bg-surface-white px-4 py-3 text-[0.8rem] text-ink-secondary">
        <span className="font-medium text-ink">{answeredCount}</span> von {understandingTasks.length} Aufgaben eingeschätzt.
        {!allTasksRated && <span className="ml-1">Bitte für jede Aufgabe eine Einschätzung auswählen.</span>}
      </div>

      <div className="mt-3 rounded-xl border border-cream-border bg-cream-light px-4 py-3 text-[0.78rem] text-ink-secondary">
        Danach erstellen wir deine Auswertung: Priorität aus Schritt 2 + Selbstcheck aus diesem Schritt.
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/relevanz')}
          className="inline-flex items-center gap-2 rounded-lg border border-cream-border bg-surface-white px-4 py-2.5 text-[0.78rem] font-semibold text-ink-secondary transition-colors hover:bg-cream-light"
        >
          <ArrowLeft size={14} />
          Zurück
        </button>
        <button
          type="button"
          onClick={() => navigate('/sicherheit')}
          disabled={!allTasksRated}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.78rem] font-semibold text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Auswertung anzeigen
          <ArrowRight size={14} />
        </button>
      </div>
    </PageShell>
  );
}

function ConfidencePage({
  subject,
  grade,
  ratings,
  onRestart,
}: {
  subject: string;
  grade: string;
  ratings: UnderstandingRatings;
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  const confidenceRows = understandingTasks.map((task) => {
    const rating = ratings[task.id];
    return {
      label: task.topic,
      value: rating ? ratingToScore[rating] : 50,
      ratingLabel: rating ? ratingToLabel[rating] : 'Nicht eingeschätzt',
    };
  });

  const secureTopics = confidenceRows.filter((row) => row.value >= 75);
  const gapTopics = confidenceRows.filter((row) => row.value < 55);

  return (
    <PageShell
      currentStep={4}
      title="Auswertung für diesen Test"
      subtitle="Die Prozentwerte zeigen deine Selbsteinschätzung aus Schritt 3 auf den priorisierten Themen aus Schritt 2."
      subject={subject}
      grade={grade}
    >
      <div className="rounded-xl border border-cream-border bg-cream-light p-4">
        <div className="mb-4 flex items-center gap-2 text-[0.78rem] font-medium text-ink-secondary">
          <Sparkles size={14} className="text-accent" />
          Testprofil für diese Session
        </div>

        <div className="space-y-3">
          {confidenceRows.map((row) => (
            <div key={row.label}>
              <div className="mb-1.5 flex items-center justify-between text-[0.78rem]">
                <span className="text-ink-secondary">{row.label}</span>
                <span className="font-semibold text-ink-muted">
                  {row.value}% ({row.ratingLabel})
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream-border">
                <div
                  style={{ width: `${row.value}%` }}
                  className={`h-full rounded-full ${row.value >= 75 ? 'bg-accent' : row.value >= 55 ? 'bg-[#8b6914]' : 'bg-[#c2746b]'}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-cream-border bg-surface-white px-4 py-3 text-[0.78rem] text-ink-secondary">
        <span className="mb-1 block text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-accent">Was die Prozentwerte bedeuten</span>
        85% = du fühlst dich sicher, 60% = teilweise sicher, 35% = aktuell unsicher. Das ist keine automatische Note, sondern eine klare Standortbestimmung vor dem Test.
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-cream-border bg-surface-white p-4">
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent">Hier bist du aktuell sicher</p>
          <ul className="space-y-1.5 text-[0.8rem] text-ink-secondary">
            {secureTopics.length > 0 ? (
              secureTopics.map((topic) => (
                <li key={topic.label} className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-accent" />
                  {topic.label}
                </li>
              ))
            ) : (
              <li>Noch kein Thema als sicher markiert.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-cream-border bg-surface-white p-4">
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#c2746b]">Vor dem Test wiederholen</p>
          <ul className="space-y-1.5 text-[0.8rem] text-ink-secondary">
            {gapTopics.length > 0 ? (
              gapTopics.map((topic) => (
                <li key={topic.label} className="flex items-center gap-2">
                  <CircleAlert size={13} className="text-[#c2746b]" />
                  {topic.label}
                </li>
              ))
            ) : (
              <li>Keine akuten Lücken in den priorisierten Themen.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/verstaendnis')}
          className="inline-flex items-center gap-2 rounded-lg border border-cream-border bg-surface-white px-4 py-2.5 text-[0.78rem] font-semibold text-ink-secondary transition-colors hover:bg-cream-light"
        >
          <ArrowLeft size={14} />
          Zurück
        </button>

        <button
          type="button"
          onClick={() => {
            onRestart();
            navigate('/start');
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.78rem] font-semibold text-cream transition-colors hover:bg-ink/90"
        >
          Neue Lernsession starten
          <ArrowRight size={14} />
        </button>
      </div>
    </PageShell>
  );
}

function App() {
  const [subject, setSubject] = useState('Biologie');
  const [grade, setGrade] = useState('10. Klasse');
  const [teacherHint, setTeacherHint] = useState('');
  const [understandingRatings, setUnderstandingRatings] = useState<UnderstandingRatings>({});
  const files = initialFiles;

  const resetSession = () => {
    setSubject('Biologie');
    setGrade('10. Klasse');
    setTeacherHint('');
    setUnderstandingRatings({});
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/start" replace />} />
        <Route
          path="/start"
          element={
            <StartPage
              subject={subject}
              setSubject={setSubject}
              grade={grade}
              setGrade={setGrade}
              files={files}
              teacherHint={teacherHint}
              setTeacherHint={setTeacherHint}
            />
          }
        />
        <Route path="/relevanz" element={<RelevancePage subject={subject} grade={grade} teacherHint={teacherHint} />} />
        <Route
          path="/verstaendnis"
          element={
            <UnderstandingPage
              subject={subject}
              grade={grade}
              ratings={understandingRatings}
              setRatings={setUnderstandingRatings}
            />
          }
        />
        <Route
          path="/sicherheit"
          element={<ConfidencePage subject={subject} grade={grade} ratings={understandingRatings} onRestart={resetSession} />}
        />
        <Route path="*" element={<Navigate to="/start" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
