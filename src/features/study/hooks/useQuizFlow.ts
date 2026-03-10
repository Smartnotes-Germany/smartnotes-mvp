import { useCallback, useEffect, useRef, useState } from "react";
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
  const latestSessionContextRef = useRef({
    grantToken,
    sessionId,
  });

  const evaluateAnswer = useAction(evaluateAnswerRef);

  useEffect(() => {
    latestSessionContextRef.current = {
      grantToken,
      sessionId,
    };
  }, [grantToken, sessionId]);

  useEffect(() => {
    setAnswerInput("");
    setFeedback(null);
    setQuizError(null);
    setIsSubmittingAnswer(false);
    setQuestionStartedAt(Date.now());
  }, [grantToken, sessionId]);

  useEffect(() => {
    setQuizError(null);
    // Convex can advance to the next unanswered question before the action
    // result reaches the client. Keep existing feedback visible in that case.
    if (feedback) {
      return;
    }

    setAnswerInput("");
    setQuestionStartedAt(Date.now());
  }, [currentQuestion?.id, feedback]);

  const submitAnswer = useCallback(
    async (dontKnowSubmission: boolean = false) => {
      if (!grantToken || !sessionId || !currentQuestion) {
        return;
      }
      if (!answerInput.trim() && !dontKnowSubmission) {
        return;
      }

      const clientRequestId = createClientRequestId("evaluateAnswer");
      const submissionContext = {
        grantToken,
        sessionId,
      };
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

        const latestContext = latestSessionContextRef.current;
        if (
          latestContext.grantToken !== submissionContext.grantToken ||
          latestContext.sessionId !== submissionContext.sessionId
        ) {
          return;
        }

        setFeedback(result);
      } catch (error: unknown) {
        const latestContext = latestSessionContextRef.current;
        if (
          latestContext.grantToken !== submissionContext.grantToken ||
          latestContext.sessionId !== submissionContext.sessionId
        ) {
          return;
        }

        setQuizError(
          formatError(error, {
            fallback:
              "Deine Antwort konnte nicht bewertet werden. Bitte versuche es erneut.",
            clientRequestId,
          }),
        );
      } finally {
        const latestContext = latestSessionContextRef.current;
        const isStaleSubmission =
          latestContext.grantToken !== submissionContext.grantToken ||
          latestContext.sessionId !== submissionContext.sessionId;
        if (!isStaleSubmission) {
          setIsSubmittingAnswer(false);
        }
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
    setQuizError(null);
    setQuestionStartedAt(Date.now());
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
