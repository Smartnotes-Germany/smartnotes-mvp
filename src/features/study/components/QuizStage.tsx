import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Loader2,
  XCircle,
} from "lucide-react";
import type { FeedbackState, QuizQuestion } from "../types";

type QuizStageProps = {
  currentQuestion: QuizQuestion | null;
  feedback: FeedbackState | null;
  answerInput: string;
  onAnswerInputChange: (value: string) => void;
  onSubmitAnswer: (dontKnowSubmission?: boolean) => Promise<void>;
  isSubmittingAnswer: boolean;
  quizError: string | null;
  isGeneratingQuiz: boolean;
  onContinueAfterFeedback: () => Promise<void> | void;
  sourceTopics: string[];
  focusTopics: string[];
  activeTopic: string | null;
  onSetFocusTopics: (topics: string[]) => Promise<void>;
  answeredQuestionsInFocus: number;
  minQuestionsRequired: number;
  topicLoading: string | null;
  isAnalyzing: boolean;
  shouldContinueToAnalysis: boolean;
};

export function QuizStage({
  currentQuestion,
  feedback,
  answerInput,
  onAnswerInputChange,
  onSubmitAnswer,
  isSubmittingAnswer,
  quizError,
  onContinueAfterFeedback,
  sourceTopics,
  focusTopics,
  activeTopic,
  onSetFocusTopics,
  answeredQuestionsInFocus,
  minQuestionsRequired,
  topicLoading,
  isGeneratingQuiz,
  isAnalyzing,
  shouldContinueToAnalysis,
}: QuizStageProps) {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(focusTopics);
  const [isStartingBatch, setIsStartingBatch] = useState(false);

  useEffect(() => {
    if (focusTopics.length > 0) {
      setSelectedTopics(focusTopics);
    }
  }, [focusTopics]);

  const feedbackTone = !feedback
    ? null
    : feedback.isCorrect
      ? "correct"
      : feedback.answeredWithDontKnow
        ? "dontKnow"
        : feedback.score > 0
          ? "partial"
          : "incorrect";

  const progressPercentage = Math.min(
    100,
    (answeredQuestionsInFocus / minQuestionsRequired) * 100,
  );

  const isPreparing =
    topicLoading !== null || isGeneratingQuiz || isStartingBatch;
  const selectedQuestionCount = selectedTopics.includes("all")
    ? 10
    : selectedTopics.length * 5;

  const showSelection =
    focusTopics.length === 0 || (!currentQuestion && !feedback && !isPreparing);

  const toggleTopic = (topic: string) => {
    if (isPreparing) {
      return;
    }

    if (topic === "all") {
      setSelectedTopics(["all"]);
      return;
    }

    setSelectedTopics((prev) => {
      const filtered = prev.filter((t) => t !== "all");
      if (filtered.includes(topic)) {
        return filtered.filter((t) => t !== topic);
      }
      return [...filtered, topic];
    });
  };

  const handleStartBatch = async () => {
    setIsStartingBatch(true);
    try {
      await onSetFocusTopics(selectedTopics);
    } finally {
      setIsStartingBatch(false);
    }
  };

  const isAnyTopicSelected = selectedTopics.length > 0;

  return (
    <section className="flex h-full min-h-full flex-col items-center py-4">
      {focusTopics.length > 0 && activeTopic && (
        <div className="mb-8 w-full max-w-2xl px-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-ink-muted text-[10px] font-bold tracking-widest uppercase">
              {activeTopic === "all"
                ? "Alles gemischt"
                : `Thema: ${activeTopic}`}
            </p>
            <p className="text-ink-muted text-[10px] font-bold tracking-widest uppercase">
              {answeredQuestionsInFocus} / {minQuestionsRequired} Fragen
            </p>
          </div>
          <div className="bg-ink/5 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-accent h-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      <div className="my-auto w-full max-w-3xl text-center">
        {showSelection ? (
          <div className="animate-in fade-in zoom-in-95 w-full duration-700">
            <div className="mb-10 md:mb-16">
              <h2 className="text-ink mb-4 text-3xl font-black tracking-tighter md:text-5xl">
                Was ist relevant für die Klassenarbeit?
              </h2>
              <p className="text-ink-secondary text-lg md:text-xl">
                Wähle deine Themen einmal aus. Danach generieren wir direkt 5
                Fragen pro Thema.
              </p>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 text-center sm:grid-cols-2">
              <button
                type="button"
                onClick={() => toggleTopic("all")}
                disabled={isPreparing}
                className={`group relative flex flex-col items-center justify-center rounded-3xl border-2 p-8 transition-all hover:scale-[1.02] active:scale-95 ${
                  selectedTopics.includes("all")
                    ? "border-accent bg-accent/5"
                    : "border-cream-border bg-surface-white"
                } ${isPreparing ? "cursor-wait opacity-70" : ""}`}
              >
                {selectedTopics.includes("all") && (
                  <span className="bg-accent/10 text-accent absolute top-2.5 right-3 flex h-8 w-8 items-center justify-center rounded-full">
                    <CheckCircle2 size={18} />
                  </span>
                )}
                <h3 className="text-lg font-bold md:text-xl">Alles gemischt</h3>
                <p className="text-ink-muted mt-1 text-sm">
                  10 zufällige Fragen querbeet
                </p>
              </button>

              {sourceTopics.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    disabled={isPreparing}
                    className={`group relative flex flex-col items-center justify-center rounded-3xl border-2 p-8 transition-all hover:scale-[1.02] active:scale-95 ${
                      isSelected
                        ? "border-accent bg-accent/5"
                        : "border-cream-border bg-surface-white"
                    } ${isPreparing ? "cursor-wait opacity-70" : ""}`}
                  >
                    {isSelected && (
                      <span className="bg-accent/10 text-accent absolute top-2.5 right-3 flex h-8 w-8 items-center justify-center rounded-full">
                        <CheckCircle2 size={18} />
                      </span>
                    )}
                    <h3 className="text-lg font-bold md:text-xl">{topic}</h3>
                    <p className="text-ink-muted mt-1 text-sm">
                      +5 Fokus-Fragen
                    </p>
                  </button>
                );
              })}
            </div>

            {isAnyTopicSelected && (
              <div className="flex flex-col items-center justify-center gap-4 pt-4">
                <p className="text-ink-muted text-sm md:text-base">
                  {selectedTopics.includes("all")
                    ? "Es werden 10 gemischte Fragen generiert."
                    : `Es werden ${selectedQuestionCount} Fragen generiert.`}
                </p>
                <button
                  type="button"
                  onClick={handleStartBatch}
                  disabled={isPreparing}
                  className="bg-accent shadow-accent/25 flex w-full max-w-sm items-center justify-center gap-3 rounded-full py-5 text-xl font-bold text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {isPreparing ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <ArrowRight size={24} />
                  )}
                  {isPreparing
                    ? "Fragen werden erstellt..."
                    : `${selectedQuestionCount} Fragen starten`}
                </button>
              </div>
            )}

            {quizError && (
              <p className="mx-auto mt-5 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                {quizError}
              </p>
            )}
          </div>
        ) : feedback ? (
          <div className="animate-in fade-in slide-in-from-bottom-8 w-full duration-500">
            <div className="mb-8 flex flex-col items-center gap-4 md:mb-12">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg md:h-16 md:w-16 ${
                  feedbackTone === "correct"
                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400"
                    : feedbackTone === "partial" || feedbackTone === "dontKnow"
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                      : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                }`}
              >
                {feedbackTone === "correct" ? (
                  <CheckCircle2 size={28} className="md:h-8 md:w-8" />
                ) : feedbackTone === "partial" ||
                  feedbackTone === "dontKnow" ? (
                  <Lightbulb size={28} className="md:h-8 md:w-8" />
                ) : (
                  <XCircle size={28} className="md:h-8 md:w-8" />
                )}
              </div>
              <p
                className={`text-[10px] font-black tracking-[0.3em] uppercase md:text-sm ${
                  feedbackTone === "correct"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : feedbackTone === "partial" || feedbackTone === "dontKnow"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {feedbackTone === "correct"
                  ? "Richtig"
                  : feedbackTone === "dontKnow"
                    ? "Noch nicht gewusst"
                    : feedbackTone === "partial"
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
                  onClick={() => void onContinueAfterFeedback()}
                  disabled={shouldContinueToAnalysis && isAnalyzing}
                  className="bg-accent shadow-accent/30 mb-5 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-xl transition hover:scale-105 active:scale-95 disabled:opacity-70 md:gap-3 md:px-12 md:py-5 md:text-lg"
                >
                  {shouldContinueToAnalysis && isAnalyzing ? (
                    <Loader2
                      size={20}
                      className="animate-spin md:h-[22px] md:w-[22px]"
                    />
                  ) : (
                    <ArrowRight size={20} className="md:h-[22px] md:w-[22px]" />
                  )}
                  {shouldContinueToAnalysis
                    ? "Weiter zur Lernanalyse"
                    : "Nächste Frage"}
                </button>
              </div>

              {quizError && (
                <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {quizError}
                </p>
              )}
            </div>
          </div>
        ) : currentQuestion ? (
          <div className="animate-in fade-in w-full duration-700">
            <div className="mb-10 md:mb-24">
              <h2 className="text-ink text-center text-2xl leading-tight font-black tracking-tighter break-words whitespace-pre-wrap md:text-left md:text-5xl">
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
                className="border-cream-border focus:border-accent placeholder:text-ink-muted/20 w-full overflow-hidden border-b-2 bg-transparent pb-4 text-center text-xl font-medium transition outline-none disabled:opacity-50 md:text-3xl"
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
              </div>
            </div>
          </div>
        ) : !showSelection && !feedback ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="text-accent animate-spin" />
            <p className="text-ink-muted text-sm font-bold tracking-widest uppercase">
              Vorbereitung...
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
