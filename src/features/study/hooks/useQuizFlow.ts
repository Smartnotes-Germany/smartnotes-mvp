import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { evaluateAnswerRef } from "../convexRefs";
import { createClientRequestId, formatError } from "../errorUtils";
import type { FeedbackState, QuizQuestion } from "../types";
import {
  trackQuizAnswerEvaluated,
  trackQuizAnswerEvaluationFailed,
  trackQuizAnswerSubmitted,
  trackQuizQuestionViewed,
} from "../analytics";

type UseQuizFlowArgs = {
  grantToken: string | null;
  sessionId: string | null;
  currentQuestion: QuizQuestion | null;
  answeredQuestions?: number;
  totalQuestions?: number;
};

export function useQuizFlow({
  grantToken,
  sessionId,
  currentQuestion,
  answeredQuestions,
  totalQuestions,
}: UseQuizFlowArgs) {
  const [answerInput, setAnswerInput] = useState("");
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const seenQuestionIdsRef = useRef(new Set<string>());
  const progressRef = useRef({ answeredQuestions, totalQuestions });

  const evaluateAnswer = useAction(evaluateAnswerRef);

  useEffect(() => {
    progressRef.current = { answeredQuestions, totalQuestions };
  }, [answeredQuestions, totalQuestions]);

  useEffect(() => {
    setAnswerInput("");
    setFeedback(null);
    setQuizError(null);
    setQuestionStartedAt(Date.now());

    if (!currentQuestion?.id) {
      return;
    }

    if (seenQuestionIdsRef.current.has(currentQuestion.id)) {
      return;
    }

    seenQuestionIdsRef.current.add(currentQuestion.id);
    trackQuizQuestionViewed(progressRef.current);
  }, [currentQuestion?.id]);

  const submitAnswer = useCallback(
    async (dontKnowSubmission: boolean = false) => {
      if (!grantToken || !sessionId || !currentQuestion) {
        return;
      }
      if (!answerInput.trim() && !dontKnowSubmission) {
        return;
      }

      const clientRequestId = createClientRequestId("evaluateAnswer");
      setIsSubmittingAnswer(true);
      setQuizError(null);
      const evaluationStartedAt = Date.now();

      try {
        const timeSpentSeconds = Math.max(
          1,
          Math.round((Date.now() - questionStartedAt) / 1000),
        );

        trackQuizAnswerSubmitted(timeSpentSeconds, dontKnowSubmission, {
          answeredQuestions,
          totalQuestions,
        });

        const result = await evaluateAnswer({
          grantToken,
          sessionId,
          questionId: currentQuestion.id,
          userAnswer: dontKnowSubmission ? "" : answerInput,
          timeSpentSeconds,
          clientRequestId,
        });

        setFeedback(result);
        trackQuizAnswerEvaluated(
          result.score,
          Date.now() - evaluationStartedAt,
          result.isCorrect,
          {
            answeredQuestions,
            totalQuestions,
          },
        );
      } catch (error: unknown) {
        trackQuizAnswerEvaluationFailed(Date.now() - evaluationStartedAt, {
          answeredQuestions,
          totalQuestions,
        });
        setQuizError(
          formatError(error, {
            fallback:
              "Deine Antwort konnte nicht bewertet werden. Bitte versuche es erneut.",
            clientRequestId,
          }),
        );
      } finally {
        setIsSubmittingAnswer(false);
      }
    },
    [
      answerInput,
      currentQuestion,
      evaluateAnswer,
      grantToken,
      answeredQuestions,
      questionStartedAt,
      sessionId,
      totalQuestions,
    ],
  );

  const continueAfterFeedback = useCallback(() => {
    setFeedback(null);
    setAnswerInput("");
  }, []);

  return {
    answerInput,
    isSubmittingAnswer,
    quizError,
    feedback,
    setAnswerInput,
    submitAnswer,
    continueAfterFeedback,
  };
}
