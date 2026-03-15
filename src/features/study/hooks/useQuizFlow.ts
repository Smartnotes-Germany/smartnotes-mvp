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
  const [displayQuestion, setDisplayQuestion] = useState<QuizQuestion | null>(
    currentQuestion,
  );
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const latestSessionContextRef = useRef({
    grantToken,
    sessionId,
  });
  const latestQuestionRef = useRef(currentQuestion);
  const seenQuestionIdsRef = useRef(new Set<string>());
  const progressRef = useRef({ answeredQuestions, totalQuestions });

  const evaluateAnswer = useAction(evaluateAnswerRef);

  useEffect(() => {
    latestSessionContextRef.current = {
      grantToken,
      sessionId,
    };
  }, [grantToken, sessionId]);

  useEffect(() => {
    latestQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    progressRef.current = { answeredQuestions, totalQuestions };
  }, [answeredQuestions, totalQuestions]);

  useEffect(() => {
    setAnswerInput("");
    setDisplayQuestion(null);
    setFeedback(null);
    setQuizError(null);
    setIsSubmittingAnswer(false);
    setQuestionStartedAt(Date.now());
  }, [grantToken, sessionId]);

  useEffect(() => {
    setQuizError(null);
    // Keep the submitted question visible while the answer is still being
    // evaluated or while its feedback is on screen.
    if (feedback || isSubmittingAnswer) {
      return;
    }

    setDisplayQuestion(currentQuestion);
    setAnswerInput("");
    setQuestionStartedAt(Date.now());

    if (!currentQuestion?.id) {
      return;
    }

    if (seenQuestionIdsRef.current.has(currentQuestion.id)) {
      return;
    }

    seenQuestionIdsRef.current.add(currentQuestion.id);
    trackQuizQuestionViewed(progressRef.current);
  }, [currentQuestion?.id, currentQuestion, feedback, isSubmittingAnswer]);

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
      const submittedQuestion = currentQuestion;
      const submittedAnswer = dontKnowSubmission ? "" : answerInput;

      setDisplayQuestion(submittedQuestion);
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
          questionId: submittedQuestion.id,
          userAnswer: submittedAnswer,
          answeredWithDontKnow: dontKnowSubmission,
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

        setFeedback({
          ...result,
          answeredWithDontKnow: dontKnowSubmission,
        });
        trackQuizAnswerEvaluated(
          result.score,
          Date.now() - evaluationStartedAt,
          result.isCorrect,
          dontKnowSubmission,
          {
            answeredQuestions,
            totalQuestions,
          },
        );
      } catch (error: unknown) {
        trackQuizAnswerEvaluationFailed(
          Date.now() - evaluationStartedAt,
          dontKnowSubmission,
          {
            answeredQuestions,
            totalQuestions,
          },
        );
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
        setDisplayQuestion(latestQuestionRef.current);
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
      answeredQuestions,
      questionStartedAt,
      sessionId,
      totalQuestions,
    ],
  );

  const continueAfterFeedback = useCallback(() => {
    setFeedback(null);
    setDisplayQuestion(latestQuestionRef.current);
  }, []);

  return {
    answerInput,
    displayQuestion,
    isSubmittingAnswer,
    quizError,
    feedback,
    setAnswerInput,
    submitAnswer,
    continueAfterFeedback,
  };
}
