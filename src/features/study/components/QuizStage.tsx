import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Lightbulb,
  Loader2,
  LogOut,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import { useFeatureFlagVariantKey } from "@posthog/react";
import type { FeedbackState, QuizQuestion, StudyStats } from "../types";
import { ANALYTICS_FEATURE_FLAGS } from "../analytics";

type QuizStageProps = {
  currentQuestion: QuizQuestion | null;
  stats: StudyStats;
  feedback: FeedbackState | null;
  answerInput: string;
  onAnswerInputChange: (value: string) => void;
  onSubmitAnswer: (dontKnowSubmission?: boolean) => Promise<void>;
  isSubmittingAnswer: boolean;
  quizError: string | null;
  onAnalyzeSession: () => Promise<void>;
  isAnalyzing: boolean;
  onGenerateQuiz: () => Promise<void>;
  isGeneratingQuiz: boolean;
  onContinueAfterFeedback: () => void;
};

export function QuizStage({
  currentQuestion,
  stats,
  feedback,
  answerInput,
  onAnswerInputChange,
  onSubmitAnswer,
  isSubmittingAnswer,
  quizError,
  onAnalyzeSession,
  isAnalyzing,
  onGenerateQuiz,
  isGeneratingQuiz,
  onContinueAfterFeedback,
}: QuizStageProps) {
  const analysisCtaVariant = useFeatureFlagVariantKey(
    ANALYTICS_FEATURE_FLAGS.analysisCtaVariant,
  );
  const useCompactAnalysisCopy = analysisCtaVariant === "kompakt";

  return (
    <section className="flex h-full min-h-full flex-col items-center py-4">
      <div className="my-auto w-full max-w-3xl text-center">
        {!currentQuestion && stats.totalQuestions > 0 && !feedback ? (
          <div className="border-cream-border bg-cream-light animate-in zoom-in-95 rounded-[2.5rem] border p-8 text-center duration-500 md:p-16">
            <h2 className="mb-4 text-3xl font-black tracking-tighter md:text-5xl">
              Starke Leistung!
            </h2>
            <p className="text-ink-secondary mb-10 text-lg md:text-xl">
              Bereit für die Analyse? Wir nutzen deine Antworten, um deinen
              Lernstand zu schätzen.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void onAnalyzeSession()}
                disabled={isAnalyzing}
                className="bg-accent inline-flex items-center justify-center gap-3 rounded-full px-10 py-5 text-lg font-bold text-white transition hover:scale-105 active:scale-95 disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Brain size={24} />
                )}
                {isAnalyzing
                  ? "Analysiere..."
                  : useCompactAnalysisCopy
                    ? "Analyse starten"
                    : "Lernanalyse starten"}
              </button>
              <button
                type="button"
                onClick={() => void onGenerateQuiz()}
                disabled={isGeneratingQuiz}
                className="border-cream-border bg-surface-white text-ink-secondary hover:bg-cream-light inline-flex items-center justify-center gap-3 rounded-full border-2 px-10 py-5 text-lg font-bold transition disabled:opacity-60"
              >
                {isGeneratingQuiz ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <RefreshCcw size={24} />
                )}
                Mehr Fragen (+30)
              </button>
            </div>
          </div>
        ) : feedback ? (
          <div className="animate-in fade-in slide-in-from-bottom-8 w-full duration-500">
            <div className="mb-8 flex flex-col items-center gap-4 md:mb-12">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg md:h-16 md:w-16 ${
                  feedback.isCorrect
                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400"
                    : feedback.score > 0
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                      : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                }`}
              >
                {feedback.isCorrect ? (
                  <CheckCircle2 size={28} className="md:h-8 md:w-8" />
                ) : feedback.score > 0 ? (
                  <Lightbulb size={28} className="md:h-8 md:w-8" />
                ) : (
                  <XCircle size={28} className="md:h-8 md:w-8" />
                )}
              </div>
              <p
                className={`text-[10px] font-black tracking-[0.3em] uppercase md:text-sm ${
                  feedback.isCorrect
                    ? "text-emerald-600 dark:text-emerald-400"
                    : feedback.score > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {feedback.isCorrect
                  ? "Richtig"
                  : feedback.score > 0
                    ? "Teilweise"
                    : "Falsch"}
              </p>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div className="border-cream-border bg-surface-white rounded-[1.5rem] border p-5 text-left shadow-sm md:rounded-[2rem] md:p-10">
                <p className="text-accent mb-3 text-[9px] font-bold tracking-[0.3em] uppercase md:mb-4 md:text-[10px]">
                  Erklärung
                </p>
                <p className="text-ink-secondary text-base leading-relaxed md:text-xl">
                  {feedback.explanation}
                </p>
              </div>

              <div className="border-cream-border bg-cream-light/50 rounded-[1.5rem] border p-5 text-left md:rounded-[2rem] md:p-10">
                <p className="text-accent mb-3 text-[9px] font-bold tracking-[0.3em] uppercase md:mb-4 md:text-[10px]">
                  Ideale Antwort
                </p>
                <p className="text-ink text-base leading-relaxed font-medium md:text-xl">
                  {feedback.idealAnswer}
                </p>
              </div>

              <div className="flex justify-center pt-6 md:pt-8">
                <button
                  type="button"
                  onClick={onContinueAfterFeedback}
                  className="bg-accent shadow-accent/30 mb-5 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-xl transition hover:scale-105 active:scale-95 md:gap-3 md:px-12 md:py-5 md:text-lg"
                >
                  Nächste Frage
                  <ArrowRight size={20} className="md:h-[22px] md:w-[22px]" />
                </button>
              </div>
            </div>
          </div>
        ) : currentQuestion ? (
          <div className="animate-in fade-in w-full duration-700">
            <div className="mb-10 md:mb-24">
              <h2 className="text-ink text-center text-2xl leading-tight font-black tracking-tighter md:text-left md:text-5xl">
                {currentQuestion.prompt}
              </h2>
            </div>

            <div className="mx-auto w-full max-w-2xl">
              <textarea
                value={answerInput}
                onChange={(event) => {
                  onAnswerInputChange(event.target.value);
                  event.target.style.height = "auto";
                  event.target.style.height = `${event.target.scrollHeight}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void onSubmitAnswer();
                  }
                }}
                rows={1}
                disabled={isSubmittingAnswer}
                placeholder="Deine Antwort hier tippen..."
                data-ph-sensitive="true"
                className="ph-no-capture border-cream-border focus:border-accent placeholder:text-ink-muted/20 w-full overflow-hidden border-b-2 bg-transparent pb-4 text-center text-xl font-medium transition outline-none disabled:opacity-50 md:text-3xl"
                style={{ resize: "none" }}
              />

              {quizError && (
                <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {quizError}
                </p>
              )}

              <div className="mt-8 flex flex-col items-center gap-3 md:mt-12 md:gap-4">
                <p className="text-ink-muted/50 text-[9px] font-bold tracking-[0.2em] uppercase md:text-[10px]">
                  {isSubmittingAnswer
                    ? "KI bewertet..."
                    : "Eingabetaste zum Bestätigen"}
                </p>

                <button
                  type="button"
                  onClick={() => void onSubmitAnswer(false)}
                  disabled={isSubmittingAnswer || !answerInput.trim()}
                  className="bg-accent shadow-accent/25 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[10px] font-bold tracking-[0.12em] text-white uppercase shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-60 md:px-8 md:py-4 md:text-xs"
                >
                  {isSubmittingAnswer ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                  Antwort absenden
                </button>

                <button
                  type="button"
                  onClick={() => void onSubmitAnswer(true)}
                  disabled={isSubmittingAnswer}
                  className="bg-ink/5 text-ink-secondary hover:bg-ink/10 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[10px] font-bold tracking-[0.12em] uppercase transition disabled:opacity-60 md:px-8 md:py-4 md:text-xs"
                >
                  Ich weiß es gerade nicht
                </button>

                <button
                  type="button"
                  onClick={() => void onAnalyzeSession()}
                  disabled={isAnalyzing}
                  className="hover:text-cream mt-10 mb-7 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-red-50 px-6 py-3.5 text-[10px] font-bold tracking-[0.12em] text-red-600 uppercase shadow-lg shadow-red-500/10 transition hover:bg-red-500 disabled:opacity-60 md:px-8 md:py-4 md:text-xs dark:bg-red-800/30 dark:text-red-300 dark:hover:bg-red-500"
                >
                  {isAnalyzing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <LogOut size={14} />
                  )}
                  {isAnalyzing
                    ? "Analysiere..."
                    : useCompactAnalysisCopy
                      ? "Analyse starten"
                      : "Analyse jetzt starten"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="text-accent animate-spin" />
            <p className="text-ink-muted text-sm font-bold tracking-widest uppercase">
              Vorbereitung...
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
