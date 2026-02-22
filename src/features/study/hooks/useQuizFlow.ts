import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { evaluateAnswerRef } from "../convexRefs";
import { createClientRequestId, formatError } from "../errorUtils";
import type { FeedbackState, QuizQuestion } from "../types";

type UseQuizFlowArgs = {
  grantToken: string | null;
  sessionId: string | null;
  currentQuestion: QuizQuestion | null;
};

export function useQuizFlow({
  grantToken,
  sessionId,
  currentQuestion,
}: UseQuizFlowArgs) {
  const [answerInput, setAnswerInput] = useState("");
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const evaluateAnswer = useAction(evaluateAnswerRef);

  useEffect(() => {
    setAnswerInput("");
    setFeedback(null);
    setQuizError(null);
    setQuestionStartedAt(Date.now());
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

      try {
        const timeSpentSeconds = Math.max(
          1,
          Math.round((Date.now() - questionStartedAt) / 1000),
        );

        const result = await evaluateAnswer({
          grantToken,
          sessionId,
          questionId: currentQuestion.id,
          userAnswer: dontKnowSubmission ? "" : answerInput,
          timeSpentSeconds,
          clientRequestId,
        });

        setFeedback(result);
      } catch (error: unknown) {
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
      questionStartedAt,
      sessionId,
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
