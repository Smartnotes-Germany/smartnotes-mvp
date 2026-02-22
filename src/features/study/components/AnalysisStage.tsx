import { Brain, Loader2, Sparkles } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { SessionAnalysis } from "../types";

type AnalysisStageProps = {
  analysis: SessionAnalysis | undefined;
  isAnalyzing: boolean;
  analysisError: string | null;
  topicLoading: string | null;
  onAnalyzeSession: () => Promise<void>;
  onDeepDive: (topic: string) => Promise<void>;
};

export function AnalysisStage({
  analysis,
  isAnalyzing,
  analysisError,
  topicLoading,
  onAnalyzeSession,
  onDeepDive,
}: AnalysisStageProps) {
  return (
    <section className="pb-10">
      <header className="mb-8 md:mb-12">
        <p className="text-accent mb-2 text-[10px] font-bold tracking-[0.2em] uppercase">
          Abschluss
        </p>
        <h1 className="text-3xl font-black tracking-tighter md:text-5xl">
          Lernanalyse
        </h1>
        <p className="text-ink-secondary mt-3 text-sm md:text-lg">
          Hier sind deine Erkenntnisse. Vertiefe Lücken oder starte neu.
        </p>
      </header>

      {analysisError && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {analysisError}
        </p>
      )}

      {!analysis ? (
        <div className="flex flex-col items-center py-12">
          {isAnalyzing ? (
            <>
              <Loader2 size={64} className="text-accent animate-spin" />
              <p className="text-ink-secondary mt-6 text-xl font-bold">
                KI wertet Ergebnisse aus...
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void onAnalyzeSession()}
              className="bg-accent inline-flex items-center gap-3 rounded-full px-10 py-5 text-lg font-bold text-white transition hover:scale-105"
            >
              <Brain size={20} />
              Analyse erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Lernstand"
              value={`${analysis.overallReadiness}%`}
            />
            <KpiCard
              label="Stärken"
              value={analysis.strongestTopics.join(", ") || "Noch offen"}
            />
            <KpiCard
              label="Lücken"
              value={analysis.weakestTopics.join(", ") || "Keine"}
            />
          </div>

          <div className="border-accent/10 bg-surface-white relative mb-8 overflow-hidden rounded-[1.5rem] border-2 p-5 shadow-sm md:mb-10 md:rounded-[2rem] md:p-10">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles size={60} className="md:h-20 md:w-20" />
            </div>
            <p className="text-accent mb-3 text-[9px] font-bold tracking-[0.2em] uppercase md:mb-4 md:text-[10px]">
              Empfehlung
            </p>
            <p className="text-ink-secondary text-base leading-relaxed font-medium md:text-xl">
              {analysis.recommendedNextStep}
            </p>
          </div>

          <div className="space-y-4">
            {analysis.topics.map((topic) => (
              <div
                key={topic.topic}
                className="border-cream-border bg-surface-white hover:border-accent/30 flex flex-col justify-between gap-6 rounded-[1.5rem] border p-5 shadow-sm transition md:flex-row md:items-center md:rounded-[2rem] md:p-8"
              >
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-bold md:text-xl">
                    {topic.topic}
                  </h3>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="bg-cream-light h-1.5 w-24 overflow-hidden rounded-full md:w-32">
                      <div
                        className="bg-accent h-full transition-all duration-1000"
                        style={{ width: `${topic.comfortScore}%` }}
                      />
                    </div>
                    <span className="text-accent text-[9px] font-black md:text-[10px]">
                      {topic.comfortScore}% Sicherheit
                    </span>
                  </div>
                  <p className="text-ink-secondary mb-4 text-xs leading-relaxed md:text-base">
                    {topic.rationale}
                  </p>
                  <div className="bg-cream-light text-ink-muted inline-block rounded-lg px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase md:text-[10px]">
                    Tipp: {topic.recommendation}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void onDeepDive(topic.topic)}
                  disabled={topicLoading === topic.topic}
                  className="bg-accent shadow-accent/20 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] font-bold tracking-[0.1em] text-white uppercase shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-60 md:px-6 md:py-3 md:text-xs"
                >
                  {topicLoading === topic.topic ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {topicLoading === topic.topic
                    ? "KI vertieft..."
                    : "Vertiefung"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
