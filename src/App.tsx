import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
  Target,
  Upload,
} from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import logoImage from './assets/images/logo.png';

const flowSteps = [
  { id: 1, label: 'Eingaben' },
  { id: 2, label: 'Relevanz' },
  { id: 3, label: 'Verständnis' },
  { id: 4, label: 'Sicherheit' },
] as const;

const initialFiles = ['Biologie_Kapitel5.pptx', 'Whiteboard_Zellatmung.jpg', 'Notizen_Stoffwechsel.pdf'];

const relevanceCore = ['Zellatmung: Ablauf und Bilanz', 'ATP-Ertrag pro Glukose', 'Ort der Reaktionen in der Zelle'];
const relevanceLower = ['Historischer Kontext der Entdeckung', 'Sonderfälle außerhalb des Lehrplans'];

const understandingTasks = [
  {
    id: 'q1',
    type: 'Offene Frage',
    text: 'Erkläre, warum bei Sauerstoffmangel deutlich weniger ATP entsteht.',
  },
  {
    id: 'q2',
    type: 'Rechenaufgabe',
    text: 'Berechne die ATP-Ausbeute für 2 Moleküle Glukose und begründe die Zwischenschritte.',
  },
  {
    id: 'q3',
    type: 'Begründungsaufgabe',
    text: 'Begründe, weshalb die Atmungskette als entscheidender Schritt der Energiegewinnung gilt.',
  },
] as const;

const confidenceRows = [
  { label: 'Photosynthese', value: 86 },
  { label: 'Zellatmung', value: 63 },
  { label: 'Diffusion und Osmose', value: 41 },
] as const;

const teacherHintExamples = [
  'Ableitungen anwenden, keine Beweise',
  'Kapitel 3-5, Schwerpunkt Energie',
  'Aufgaben wie im letzten Test',
] as const;

function StepTracker({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-4">
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
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full bg-cream-dark/70 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-5 pb-12 pt-8 md:px-8 md:pt-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-cream-border bg-cream-light/70 px-5 py-4 backdrop-blur-sm md:px-7">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-sm border border-cream-border bg-surface-white">
              <img src={logoImage} alt="Smartnotes Logo" className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-accent">Smartnotes</p>
              <h1 className="editorial-heading text-[1.2rem]">Prüfungsrelevanz und Verständnis</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[0.72rem] font-medium text-ink-secondary">
            <span className="rounded-full border border-cream-border bg-surface-white px-3 py-1.5">{subject}</span>
            <span className="rounded-full border border-cream-border bg-surface-white px-3 py-1.5">{grade}</span>
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-cream-border bg-surface-white p-6 shadow-[0_14px_34px_rgba(30,24,18,0.08)] md:p-8"
        >
          <span className="section-label">Schritt {currentStep} von 4</span>
          <h2 className="editorial-heading mt-4 text-[1.9rem] leading-[1.12] md:text-[2.3rem]">{title}</h2>
          <p className="mt-3 max-w-3xl text-[0.9rem] leading-relaxed text-ink-secondary">{subtitle}</p>
          <StepTracker currentStep={currentStep} />
          <div className="mt-6">{children}</div>
        </motion.section>
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
      title="Unterlagen und Lernziel festlegen"
      subtitle="Lade dein Material hoch, wähle Fach und Klassenstufe und starte direkt die Vorbereitung."
      subject={subject}
      grade={grade}
    >
      <div className="rounded-xl border border-cream-border bg-cream-light p-4 md:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">Deine Unterlagen</p>
        <div className="mt-3 grid gap-2">
          {files.map((file) => (
            <div
              key={file}
              className="flex items-center gap-2.5 rounded-xl border border-cream-border bg-surface-white px-3 py-2.5 text-[0.8rem] text-ink-secondary"
            >
              <FileImage size={14} className="text-accent" />
              <span>{file}</span>
            </div>
          ))}
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
          Fach
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
          Klassenstufe
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
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-cream-border bg-cream-light p-4 md:p-5">
        <label className="block text-[0.78rem] font-medium text-ink">
          Hat der Lehrer etwas explizit für den Test gesagt?
          <span className="ml-1 text-ink-muted">(optional)</span>
        </label>

        <textarea
          value={teacherHint}
          onChange={(event) => setTeacherHint(event.target.value)}
          maxLength={180}
          rows={3}
          placeholder="Zum Beispiel: Aufgaben wie im letzten Test"
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

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleStart}
          disabled={isStarting}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-[0.82rem] font-semibold tracking-wide text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-75"
        >
          {isStarting ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
          {isStarting ? 'Lernsession wird gestartet...' : 'Auf Test vorbereiten'}
        </button>
      </div>
    </PageShell>
  );
}

function RelevancePage({ subject, grade, teacherHint }: { subject: string; grade: string; teacherHint: string }) {
  const navigate = useNavigate();

  return (
    <PageShell
      currentStep={2}
      title="Prüfungsrelevante Kernthemen"
      subtitle="Wir priorisieren sofort, was du für die Prüfung sicher beherrschen solltest."
      subject={subject}
      grade={grade}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-cream-border bg-cream-light p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-cream-border bg-surface-white text-accent">
              <Layers size={14} />
            </div>
            <h3 className="text-[0.9rem] font-semibold text-ink">Das musst du sicher können</h3>
          </div>
          <ul className="space-y-2">
            {relevanceCore.map((topic) => (
              <li key={topic} className="flex items-start gap-2 text-[0.8rem] text-ink-secondary">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-accent" />
                <span>{topic}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-cream-border bg-surface-white p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-cream-border bg-cream text-[#8b6914]">
              <CircleAlert size={14} />
            </div>
            <h3 className="text-[0.9rem] font-semibold text-ink">Das ist weniger wichtig</h3>
          </div>
          <ul className="space-y-2">
            {relevanceLower.map((topic) => (
              <li key={topic} className="flex items-start gap-2 text-[0.8rem] text-ink-secondary">
                <span className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
                <span>{topic}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-cream-border bg-cream-light px-4 py-3 text-[0.78rem] text-ink-secondary">
        Fokus gesetzt für <strong className="text-ink">{subject}</strong> in der <strong className="text-ink">{grade}</strong>.
      </div>

      {teacherHint.trim().length > 0 && (
        <div className="mt-3 rounded-xl border border-cream-border bg-surface-white px-4 py-3 text-[0.78rem] text-ink-secondary">
          <span className="mb-1 block text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-accent">Lehrerhinweis berücksichtigt</span>
          „{teacherHint.trim()}“
        </div>
      )}

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
          Weiter zum Verständnis-Check
          <ArrowRight size={14} />
        </button>
      </div>
    </PageShell>
  );
}

function UnderstandingPage({ subject, grade }: { subject: string; grade: string }) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState<string[]>([]);

  const toggleTask = (taskId: string) => {
    setChecked((previous) =>
      previous.includes(taskId) ? previous.filter((entry) => entry !== taskId) : [...previous, taskId],
    );
  };

  const completedCount = useMemo(() => checked.length, [checked.length]);

  return (
    <PageShell
      currentStep={3}
      title="Verständnis-Check"
      subtitle="Gezielte Fragen und Aufgaben im Prüfungsstil, damit du nicht nur erkennst, sondern wirklich verstehst."
      subject={subject}
      grade={grade}
    >
      <div className="space-y-3">
        {understandingTasks.map((task) => {
          const isChecked = checked.includes(task.id);

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => toggleTask(task.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                isChecked ? 'border-accent/60 bg-accent/8' : 'border-cream-border bg-cream-light hover:bg-cream'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">{task.type}</span>
                {isChecked ? <CheckCircle2 size={14} className="text-accent" /> : <Target size={14} className="text-ink-muted" />}
              </div>
              <p className="text-[0.86rem] leading-relaxed text-ink-secondary">{task.text}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-cream-border bg-surface-white px-4 py-3 text-[0.8rem] text-ink-secondary">
        <span className="font-medium text-ink">{completedCount}</span> von {understandingTasks.length} Aufgaben markiert.
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
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.78rem] font-semibold text-cream transition-colors hover:bg-ink/90"
        >
          Weiter zur Sicherheitsanzeige
          <ArrowRight size={14} />
        </button>
      </div>
    </PageShell>
  );
}

function ConfidencePage({ subject, grade, onRestart }: { subject: string; grade: string; onRestart: () => void }) {
  const navigate = useNavigate();

  return (
    <PageShell
      currentStep={4}
      title="Sicherheitsanzeige"
      subtitle="Du siehst auf einen Blick, wo du stark bist und an welchen Themen du vor der Prüfung noch arbeiten solltest."
      subject={subject}
      grade={grade}
    >
      <div className="rounded-xl border border-cream-border bg-cream-light p-4">
        <div className="mb-4 flex items-center gap-2 text-[0.78rem] font-medium text-ink-secondary">
          <Sparkles size={14} className="text-accent" />
          Lernprofil für diese Session
        </div>

        <div className="space-y-3">
          {confidenceRows.map((row) => (
            <div key={row.label}>
              <div className="mb-1.5 flex items-center justify-between text-[0.78rem]">
                <span className="text-ink-secondary">{row.label}</span>
                <span className="font-semibold text-ink-muted">{row.value}%</span>
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

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-cream-border bg-surface-white p-4">
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent">Du bist sicher</p>
          <ul className="space-y-1.5 text-[0.8rem] text-ink-secondary">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-accent" />
              Photosynthese-Grundlagen
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-accent" />
              Aufbau der Pflanzenzelle
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-cream-border bg-surface-white p-4">
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#c2746b]">Hier gibt es Lücken</p>
          <ul className="space-y-1.5 text-[0.8rem] text-ink-secondary">
            <li className="flex items-center gap-2">
              <CircleAlert size={13} className="text-[#c2746b]" />
              Diffusion und Osmose
            </li>
            <li className="flex items-center gap-2">
              <CircleAlert size={13} className="text-[#c2746b]" />
              ATP-Bilanz sicher anwenden
            </li>
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
  const files = initialFiles;

  const resetSession = () => {
    setSubject('Biologie');
    setGrade('10. Klasse');
    setTeacherHint('');
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
        <Route path="/verstaendnis" element={<UnderstandingPage subject={subject} grade={grade} />} />
        <Route path="/sicherheit" element={<ConfidencePage subject={subject} grade={grade} onRestart={resetSession} />} />
        <Route path="*" element={<Navigate to="/start" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
