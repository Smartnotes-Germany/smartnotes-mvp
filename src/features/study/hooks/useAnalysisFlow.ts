import { useCallback, useState } from "react";
import { useAction } from "convex/react";
import { analyzePerformanceRef, generateTopicDeepDiveRef } from "../convexRefs";
import { createClientRequestId, formatError } from "../errorUtils";
import {
  isVertexNativeCandidate,
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILE_LABEL,
} from "../../../../shared/uploadPolicy";
import { topicsMatchForFocusMode } from "../../../../shared/topicMatching";
import type { QuizQuestion, StudyDocument, StudySessionId } from "../types";

type UseAnalysisFlowArgs = {
  grantToken: string | null;
  sessionId: StudySessionId | null;
  documents: StudyDocument[];
  quizQuestions: QuizQuestion[];
  currentFocusTopic?: string | null;
  hasExistingAnalysis: boolean;
};

export function useAnalysisFlow({
  grantToken,
  sessionId,
  documents,
  quizQuestions,
  currentFocusTopic,
  hasExistingAnalysis,
}: UseAnalysisFlowArgs) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [topicLoading, setTopicLoading] = useState<string | null>(null);

  const analyzePerformance = useAction(analyzePerformanceRef);
  const generateTopicDeepDive = useAction(generateTopicDeepDiveRef);

  const analyzeSession = useCallback(async () => {
    if (!grantToken || !sessionId) {
      return;
    }

    const normalizedFocusTopic = currentFocusTopic?.trim() ?? "";
    const hasFocusTopic = normalizedFocusTopic.length > 0;
    const matchingQuestionCount = hasFocusTopic
      ? quizQuestions.filter((question) => {
          return topicsMatchForFocusMode(question.topic, normalizedFocusTopic);
        }).length
      : 0;
    const focusedQuizRatio =
      quizQuestions.length > 0
        ? matchingQuestionCount / quizQuestions.length
        : 0;
    const shouldRunFocusAnalysis =
      hasExistingAnalysis && hasFocusTopic && focusedQuizRatio >= 0.6;

    const clientRequestId = createClientRequestId("analyzePerformance");
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      await analyzePerformance({
        grantToken,
        sessionId,
        mode: shouldRunFocusAnalysis ? "focus" : "full",
        ...(shouldRunFocusAnalysis ? { focusTopic: normalizedFocusTopic } : {}),
        clientRequestId,
      });
    } catch (error: unknown) {
      setAnalysisError(
        formatError(error, {
          fallback:
            "Die Lernanalyse konnte nicht erstellt werden. Bitte versuche es erneut.",
          clientRequestId,
        }),
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    analyzePerformance,
    currentFocusTopic,
    grantToken,
    hasExistingAnalysis,
    quizQuestions,
    sessionId,
  ]);

  const deepDiveTopic = useCallback(
    async (topic: string) => {
      if (!grantToken || !sessionId) {
        return;
      }

      const oversizedReadyDocuments = documents.filter(
        (document) =>
          document.extractionStatus === "ready" &&
          isVertexNativeCandidate(document.fileType, document.fileName) &&
          document.fileSizeBytes > MAX_UPLOAD_FILE_BYTES,
      );

      if (oversizedReadyDocuments.length > 0) {
        const names = oversizedReadyDocuments
          .slice(0, 3)
          .map((document) => document.fileName)
          .join(", ");
        const suffix = oversizedReadyDocuments.length > 3 ? " ..." : "";

        setAnalysisError(
          `Mindestens eine Datei ist für die aktuelle KI-Verarbeitung zu groß (maximal ${MAX_UPLOAD_FILE_LABEL}). Bitte verkleinere die Datei oder teile sie auf: ${names}${suffix}`,
        );
        return;
      }

      const clientRequestId = createClientRequestId("generateDeepDive");
      setTopicLoading(topic);
      setAnalysisError(null);

      try {
        await generateTopicDeepDive({
          grantToken,
          sessionId,
          topic,
          clientRequestId,
        });
      } catch (error: unknown) {
        setAnalysisError(
          formatError(error, {
            fallback: "Die Vertiefung konnte nicht geladen werden.",
            clientRequestId,
          }),
        );
      } finally {
        setTopicLoading(null);
      }
    },
    [documents, generateTopicDeepDive, grantToken, sessionId],
  );

  return {
    isAnalyzing,
    analysisError,
    topicLoading,
    setAnalysisError,
    analyzeSession,
    deepDiveTopic,
  };
}
