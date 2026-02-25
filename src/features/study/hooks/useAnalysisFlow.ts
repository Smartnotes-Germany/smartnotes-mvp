import { useCallback, useState } from "react";
import { useAction } from "convex/react";
import { analyzePerformanceRef, generateTopicDeepDiveRef } from "../convexRefs";
import { createClientRequestId, formatError } from "../errorUtils";
import {
  trackAnalysisFailed,
  trackAnalysisRequested,
  trackAnalysisSucceeded,
  trackDeepDiveFailed,
  trackDeepDiveRequested,
  trackDeepDiveSucceeded,
} from "../analytics";

type UseAnalysisFlowArgs = {
  grantToken: string | null;
  sessionId: string | null;
  answeredQuestions?: number;
  totalQuestions?: number;
};

export function useAnalysisFlow({
  grantToken,
  sessionId,
  answeredQuestions,
  totalQuestions,
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

    const startedAt = Date.now();
    const clientRequestId = createClientRequestId("analyzePerformance");
    setIsAnalyzing(true);
    setAnalysisError(null);
    trackAnalysisRequested({ answeredQuestions, totalQuestions });

    try {
      await analyzePerformance({ grantToken, sessionId, clientRequestId });
      trackAnalysisSucceeded(Date.now() - startedAt, {
        answeredQuestions,
        totalQuestions,
      });
    } catch (error: unknown) {
      trackAnalysisFailed(Date.now() - startedAt, {
        answeredQuestions,
        totalQuestions,
      });
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
    answeredQuestions,
    grantToken,
    sessionId,
    totalQuestions,
  ]);

  const deepDiveTopic = useCallback(
    async (topic: string) => {
      if (!grantToken || !sessionId) {
        return;
      }

      const startedAt = Date.now();
      const clientRequestId = createClientRequestId("generateDeepDive");
      setTopicLoading(topic);
      setAnalysisError(null);
      trackDeepDiveRequested(topic.length);

      try {
        const result = (await generateTopicDeepDive({
          grantToken,
          sessionId,
          topic,
          clientRequestId,
        })) as { questionCount?: number };

        trackDeepDiveSucceeded(Date.now() - startedAt, result.questionCount);
      } catch (error: unknown) {
        trackDeepDiveFailed(Date.now() - startedAt);
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
    [generateTopicDeepDive, grantToken, sessionId],
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
