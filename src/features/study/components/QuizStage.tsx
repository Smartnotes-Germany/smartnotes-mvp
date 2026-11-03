import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Loader2,
  XCircle,
} from "lucide-react";
import { useFeatureFlagVariantKey } from "@posthog/react";
import type { FeedbackState, QuizQuestion } from "../types";
import { ANALYTICS_FEATURE_FLAGS } from "../analytics";
import { QuestionPrompt } from "./QuestionPrompt";

// Bis zu so vielen Fragen bekommt jede Frage ein eigenes Segment im Fortschritt.
const MAX_PROGRESS_SEGMENTS = 20;

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

  const analysisCtaVariant = useFeatureFlagVariantKey(
    ANALYTICS_FEATURE_FLAGS.analysisCtaVariant,
  );
  const useCompactAnalysisCopy = analysisCtaVariant === "kompakt";

  const progressPercentage = Math.min(
    100,
    (answeredQuestionsInFocus / minQuestionsRequired) * 100,
  );
  const isOnQuestion = currentQuestion !== null && !feedback;
  const isQuizComplete =
    answeredQuestionsInFocus >= minQuestionsRequired && !isOnQuestion;
  // Auf der Feedback-Seite zählt die gerade beantwortete Frage noch als aktuelle.
  const currentQuestionNumber = Math.min(
    minQuestionsRequired,
    Math.max(1, answeredQuestionsInFocus + (isOnQuestion ? 1 : 0)),
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
        <div className="mb-8 w-full max-w-3xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-ink min-w-0 truncate text-sm font-medium">
              {activeTopic === "all" ? "Alles gemischt" : activeTopic}
            </p>
            <p className="text-ink-secondary shrink-0 text-sm tabular-nums">
              {isQuizComplete ? (
                "Alle Fragen beantwortet"
              ) : (
                <>
                  Frage{" "}
                  <span className="text-ink font-semibold">
                    {currentQuestionNumber}
                  </span>{" "}
                  von {minQuestionsRequired}
                </>
              )}
            </p>
          </div>
          {minQuestionsRequired <= MAX_PROGRESS_SEGMENTS ? (
            <div
              className="flex gap-1.5"
              role="progressbar"
              aria-label="Fortschritt"
              aria-valuemin={0}
              aria-valuemax={minQuestionsRequired}
              aria-valuenow={answeredQuestionsInFocus}
            >
              {Array.from({ length: minQuestionsRequired }, (_, index) => (
                <span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                    index < answeredQuestionsInFocus
                      ? "progress-fill"
                      : index === answeredQuestionsInFocus && isOnQuestion
                        ? "bg-accent/40"
                        : "bg-ink/15"
                  }`}
                />
              ))}
            </div>
          ) : (
            <div className="bg-ink/15 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="progress-fill h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="my-auto w-full max-w-3xl text-center">
        {showSelection ? (
          <div className="animate-in fade-in zoom-in-95 w-full duration-700">
            <div className="mb-10 md:mb-16">
              <h2 className="text-ink mb-4 text-3xl leading-[1.08] font-medium tracking-[-0.045em] text-balance md:text-5xl">
                Was ist relevant für deine Prüfung?
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
                className={`group relative flex flex-col items-center justify-center rounded-[22px] border p-8 transition-all ${
                  selectedTopics.includes("all")
                    ? "border-accent bg-action/5 shadow-[0_0_0_1px_var(--color-accent)]"
                    : "sp-card hover:border-accent/50"
                } ${isPreparing ? "cursor-wait opacity-70" : ""}`}
              >
                {selectedTopics.includes("all") && (
                  <span className="bg-accent/10 text-accent absolute top-2.5 right-3 flex h-8 w-8 items-center justify-center rounded-full">
                    <CheckCircle2 size={18} />
                  </span>
                )}
                <h3 className="text-lg font-medium tracking-[-0.03em] md:text-xl">
                  Alles gemischt
                </h3>
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
                    className={`group relative flex flex-col items-center justify-center rounded-[22px] border p-8 transition-all ${
                      isSelected
                        ? "border-accent bg-action/5 shadow-[0_0_0_1px_var(--color-accent)]"
                        : "sp-card hover:border-accent/50"
                    } ${isPreparing ? "cursor-wait opacity-70" : ""}`}
                  >
                    {isSelected && (
                      <span className="bg-accent/10 text-accent absolute top-2.5 right-3 flex h-8 w-8 items-center justify-center rounded-full">
                        <CheckCircle2 size={18} />
                      </span>
                    )}
                    <h3 className="text-lg font-medium tracking-[-0.03em] md:text-xl">
                      {topic}
                    </h3>
                    <p className="text-ink-muted mt-1 text-sm">
                      +5 Fokus-Fragen
                    </p>
                  </button>
                );
              })}
            </div>

            {isAnyTopicSelected && (
              <div className="flex flex-col items-center justify-center gap-5 pt-8 pb-4">
                <p className="text-ink-muted text-sm md:text-base">
                  {selectedTopics.includes("all")
                    ? "Es werden 10 gemischte Fragen generiert."
                    : `Es werden ${selectedQuestionCount} Fragen generiert.`}
                </p>
                <button
                  type="button"
                  onClick={handleStartBatch}
                  disabled={isPreparing}
                  className="pill-button relative min-h-14 w-full max-w-sm justify-center px-14 text-base shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_4px_12px_-6px_rgba(46,91,255,0.35)]"
                >
                  {isPreparing
                    ? "Fragen werden erstellt..."
                    : `${selectedQuestionCount} Fragen starten`}
                  <span
                    className="pill-button__arrow absolute top-1/2 right-2.5 -translate-y-1/2"
                    aria-hidden="true"
                  >
                    {isPreparing ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </span>
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
                className={`flex h-14 w-14 items-center justify-center rounded-full md:h-16 md:w-16 ${
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
                className={`text-sm font-semibold md:text-base ${
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
              <div className="sp-card p-5 text-left md:p-10">
                <p className="text-accent mb-3 text-sm font-semibold md:mb-4">
                  Erklärung
                </p>
                <p className="text-ink-secondary text-base leading-relaxed md:text-xl">
                  {feedback.explanation}
                </p>
              </div>

              <div className="border-cream-border bg-cream-light rounded-[22px] border p-5 text-left md:p-10">
                <p className="text-accent mb-3 text-sm font-semibold md:mb-4">
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
                  className="pill-button mb-5 text-base"
                >
                  {shouldContinueToAnalysis
                    ? useCompactAnalysisCopy
                      ? "Analyse erstellen"
                      : "Weiter zur Lernanalyse"
                    : "Nächste Frage"}
                  <span className="pill-button__arrow" aria-hidden="true">
                    {shouldContinueToAnalysis && isAnalyzing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </span>
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
          <div className="animate-in fade-in w-full space-y-4 text-left duration-700">
            <div className="sp-card p-6 md:p-10">
              <p className="text-accent mb-3 text-sm font-semibold md:mb-4">
                Frage
              </p>
              <h2 className="text-ink text-xl leading-snug font-medium tracking-[-0.03em] break-words whitespace-pre-wrap md:text-3xl">
                <QuestionPrompt
                  prompt={currentQuestion.prompt}
                  glossary={currentQuestion.glossary}
                />
              </h2>
            </div>

            <div className="sp-card p-5 md:p-8">
              <label
                htmlFor="quiz-answer"
                className="text-accent mb-3 block text-sm font-semibold md:mb-4"
              >
                Deine Antwort
              </label>
              <textarea
                id="quiz-answer"
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
                rows={4}
                disabled={isSubmittingAnswer}
                placeholder="Schreib deine Antwort in eigenen Worten..."
                className="border-cream-border bg-cream-light focus:border-accent placeholder:text-ink-muted w-full overflow-hidden rounded-2xl border px-4 py-3 text-base leading-relaxed transition outline-none disabled:opacity-50 md:text-lg"
                style={{ resize: "none" }}
              />

              {quizError && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {quizError}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void onSubmitAnswer(true)}
                  disabled={isSubmittingAnswer}
                  className="pill-button pill-button--quiet justify-center"
                >
                  Ich weiß es gerade nicht
                </button>

                <button
                  type="button"
                  onClick={() => void onSubmitAnswer(false)}
                  disabled={isSubmittingAnswer || !answerInput.trim()}
                  className="pill-button justify-between shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_4px_12px_-6px_rgba(46,91,255,0.35)]"
                >
                  Antwort absenden
                  <span className="pill-button__arrow" aria-hidden="true">
                    {isSubmittingAnswer ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : !showSelection && !feedback ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="text-accent animate-spin" />
            <p className="text-ink-secondary text-sm font-medium">
              Vorbereitung...
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
