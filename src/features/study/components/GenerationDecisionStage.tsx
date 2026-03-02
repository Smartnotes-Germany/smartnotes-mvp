import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  Loader2,
  Sparkles,
} from "lucide-react";

type GenerationDecisionStageProps = {
  isGeneratingQuiz: boolean;
  uploadError: string | null;
  onBackToUpload: () => void;
  onStartDirectQuiz: () => Promise<void>;
  onStartLearnFirst: () => Promise<void>;
};

const QUICK_START_BENEFITS = [
  "Ideal, wenn du sofort wissen willst, wo du stehst.",
  "Du bekommst direkte Rückmeldungen zu jeder Antwort.",
  "Perfekt für schnelle Prüfungssimulationen.",
];

const LEARN_FIRST_BENEFITS = [
  "Strukturierter Themenüberblick für den gesamten Stoff.",
  "Ein kompaktes Lernblatt mit den wichtigsten Kernideen.",
  "Danach startest du den Wissenscheck mit mehr Sicherheit.",
];

export function GenerationDecisionStage({
  isGeneratingQuiz,
  uploadError,
  onBackToUpload,
  onStartDirectQuiz,
  onStartLearnFirst,
}: GenerationDecisionStageProps) {
  return (
    <section className="relative">
      <div className="pointer-events-none absolute -top-20 -right-8 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-300/10" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-52 w-52 rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-300/10" />

      <header className="mb-8 md:mb-10">
        <p className="text-ink-secondary mb-2 text-[10px] font-bold tracking-[0.2em] uppercase">
          Nächster Schritt
        </p>
        <h1 className="text-3xl font-black tracking-tighter md:text-5xl">
          Wähle deinen Lernweg
        </h1>
        <p className="text-ink-secondary mt-3 max-w-3xl text-sm leading-relaxed md:text-lg">
          Bevor Smartnotes das Quiz erstellt, entscheidest du: direkt den
          Wissensstand prüfen oder zuerst mit einer visuell aufbereiteten
          Lernübersicht starten.
        </p>
      </header>

      {uploadError && (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {uploadError}
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <article className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-emerald-50/30 p-5 shadow-sm md:p-8 dark:border-emerald-500/20 dark:bg-emerald-950/20">
          <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-emerald-500/12 blur-2xl dark:bg-emerald-300/12" />

          <div className="relative flex h-full flex-col">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-emerald-700 uppercase dark:text-emerald-300">
                <Brain size={14} />
                Direkt starten
              </div>
            </div>

            <h2 className="mb-2 text-2xl font-black tracking-tight md:text-3xl">
              Direkt Wissenscheck
            </h2>
            <p className="text-ink-secondary mb-6 text-sm leading-relaxed md:text-base">
              Smartnotes erstellt sofort prüfungsnahe Fragen. Du siehst direkt,
              welche Themen schon sitzen und wo du noch üben solltest.
            </p>

            <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-white/70 p-4 dark:bg-emerald-950/20">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold tracking-[0.12em] text-emerald-700 uppercase dark:text-emerald-300">
                  Quiz-Vorschau
                </p>
              </div>
              <div className="flex justify-center py-2">
                <svg
                  width="110"
                  height="120"
                  viewBox="0 0 100 110"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="drop-shadow-sm transition-transform duration-500 hover:scale-105"
                >
                  <rect
                    x="15"
                    y="5"
                    width="70"
                    height="95"
                    rx="6"
                    className="fill-white stroke-emerald-500/20 dark:fill-slate-900"
                    strokeWidth="1.5"
                  />

                  {/* Question */}
                  <rect
                    x="25"
                    y="20"
                    width="45"
                    height="4"
                    rx="2"
                    className="fill-emerald-600/40 dark:fill-emerald-400/40"
                  />
                  <rect
                    x="25"
                    y="28"
                    width="30"
                    height="4"
                    rx="2"
                    className="fill-emerald-600/40 dark:fill-emerald-400/40"
                  />

                  {/* Text Input Area */}
                  <rect
                    x="25"
                    y="42"
                    width="50"
                    height="32"
                    rx="4"
                    className="fill-emerald-50 stroke-emerald-500/30 dark:fill-emerald-900/30"
                    strokeWidth="1.5"
                  />

                  {/* Typed Text */}
                  <rect
                    x="30"
                    y="48"
                    width="35"
                    height="3"
                    rx="1.5"
                    className="fill-emerald-600/60 dark:fill-emerald-400/60"
                  />
                  <rect
                    x="30"
                    y="56"
                    width="40"
                    height="3"
                    rx="1.5"
                    className="fill-emerald-600/60 dark:fill-emerald-400/60"
                  />
                  <rect
                    x="30"
                    y="64"
                    width="15"
                    height="3"
                    rx="1.5"
                    className="fill-emerald-600/60 dark:fill-emerald-400/60"
                  />
                  {/* Cursor */}
                  <rect
                    x="47"
                    y="63"
                    width="1.5"
                    height="5"
                    rx="0.5"
                    className="animate-pulse fill-emerald-500"
                  />

                  {/* Submit Button */}
                  <rect
                    x="50"
                    y="80"
                    width="25"
                    height="10"
                    rx="4"
                    className="fill-emerald-500"
                  />
                  <rect
                    x="57"
                    y="84"
                    width="11"
                    height="2"
                    rx="1"
                    className="fill-white"
                  />

                  {/* Accents */}
                  <circle
                    cx="85"
                    cy="15"
                    r="3"
                    className="fill-emerald-500/40"
                  />
                  <circle
                    cx="20"
                    cy="90"
                    r="2"
                    className="fill-emerald-500/40"
                  />
                  <path
                    d="M15 15 L20 10 L25 15"
                    className="stroke-emerald-500/30"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-2.5">
              {QUICK_START_BENEFITS.map((benefit) => (
                <p
                  key={benefit}
                  className="text-ink-secondary flex items-start gap-2.5 text-sm"
                >
                  <CheckCircle2
                    size={15}
                    className="mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400"
                  />
                  <span>{benefit}</span>
                </p>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void onStartDirectQuiz()}
              disabled={isGeneratingQuiz}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3.5 text-xs font-bold tracking-[0.12em] text-white uppercase shadow-lg shadow-emerald-600/20 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60 dark:bg-emerald-500"
            >
              {isGeneratingQuiz ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              {isGeneratingQuiz
                ? "Quiz wird erstellt..."
                : "Wissenscheck starten"}
            </button>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[2rem] border border-cyan-500/20 bg-cyan-50/30 p-5 shadow-sm md:p-8 dark:border-cyan-500/20 dark:bg-cyan-950/20">
          <div className="absolute -top-10 -right-8 h-32 w-32 rounded-full bg-cyan-500/12 blur-2xl dark:bg-cyan-300/12" />

          <div className="relative flex h-full flex-col">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-cyan-700 uppercase dark:text-cyan-300">
                <BookOpen size={14} />
                Erst lernen
              </div>
            </div>

            <h2 className="mb-2 text-2xl font-black tracking-tight md:text-3xl">
              Lernübersicht zuerst
            </h2>
            <p className="text-ink-secondary mb-6 text-sm leading-relaxed md:text-base">
              Smartnotes bereitet zuerst einen klaren Themenüberblick und ein
              kompaktes Lernblatt auf. Danach kannst du dein Wissen gezielt
              überprüfen.
            </p>

            <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-white/70 p-4 dark:bg-cyan-950/20">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold tracking-[0.12em] text-cyan-700 uppercase dark:text-cyan-300">
                  Lernblatt-Vorschau
                </p>
              </div>
              <div className="flex justify-center py-2">
                <svg
                  width="110"
                  height="120"
                  viewBox="0 0 100 110"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="drop-shadow-sm transition-transform duration-500 hover:scale-105"
                >
                  <rect
                    x="15"
                    y="5"
                    width="70"
                    height="95"
                    rx="6"
                    className="fill-white stroke-cyan-500/20 dark:fill-slate-900"
                    strokeWidth="1.5"
                  />

                  <rect
                    x="25"
                    y="18"
                    width="30"
                    height="5"
                    rx="2.5"
                    className="fill-cyan-600/40 dark:fill-cyan-400/40"
                  />
                  <rect
                    x="25"
                    y="28"
                    width="15"
                    height="3"
                    rx="1.5"
                    className="fill-cyan-600/20 dark:fill-cyan-400/20"
                  />

                  <rect
                    x="25"
                    y="38"
                    width="50"
                    height="24"
                    rx="3"
                    className="fill-cyan-50 stroke-cyan-500/20 dark:fill-cyan-900/30"
                    strokeWidth="1"
                  />
                  <circle cx="38" cy="50" r="6" className="fill-cyan-500/20" />
                  <rect
                    x="50"
                    y="45"
                    width="16"
                    height="3"
                    rx="1.5"
                    className="fill-cyan-500/20"
                  />
                  <rect
                    x="50"
                    y="52"
                    width="10"
                    height="3"
                    rx="1.5"
                    className="fill-cyan-500/20"
                  />

                  <rect
                    x="25"
                    y="70"
                    width="45"
                    height="3"
                    rx="1.5"
                    className="fill-cyan-600/20 dark:fill-cyan-400/20"
                  />
                  <rect
                    x="25"
                    y="78"
                    width="50"
                    height="3"
                    rx="1.5"
                    className="fill-cyan-600/20 dark:fill-cyan-400/20"
                  />
                  <rect
                    x="25"
                    y="86"
                    width="35"
                    height="3"
                    rx="1.5"
                    className="fill-cyan-600/20 dark:fill-cyan-400/20"
                  />

                  <circle cx="85" cy="15" r="3" className="fill-cyan-500/40" />
                  <circle cx="20" cy="90" r="2" className="fill-cyan-500/40" />
                  <path
                    d="M75 95 L80 90 L85 95"
                    className="stroke-cyan-500/30"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-2.5">
              {LEARN_FIRST_BENEFITS.map((benefit) => (
                <p
                  key={benefit}
                  className="text-ink-secondary flex gap-2.5 text-sm"
                >
                  <CheckCircle2
                    size={15}
                    className="mt-0.5 flex-shrink-0 text-cyan-700 dark:text-cyan-300"
                  />
                  <span>{benefit}</span>
                </p>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void onStartLearnFirst()}
              disabled={isGeneratingQuiz}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-cyan-600 px-6 py-3.5 text-xs font-bold tracking-[0.12em] text-white uppercase shadow-lg shadow-cyan-600/20 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60 dark:bg-cyan-500"
            >
              {isGeneratingQuiz ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              {isGeneratingQuiz
                ? "Lernpfad wird vorbereitet..."
                : "Lernübersicht starten"}
            </button>
          </div>
        </article>
      </div>

      <div className="mt-6 flex justify-start">
        <button
          type="button"
          onClick={onBackToUpload}
          disabled={isGeneratingQuiz}
          className="text-ink-secondary hover:text-ink inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-[0.12em] uppercase transition disabled:opacity-60"
        >
          <ArrowLeft size={14} />
          Zurück zu den Dateien
        </button>
      </div>
    </section>
  );
}
