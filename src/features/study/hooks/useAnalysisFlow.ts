import { useCallback, useState } from "react";
import { useAction } from "convex/react";
import { analyzePerformanceRef, generateTopicDeepDiveRef } from "../convexRefs";
import { createClientRequestId, formatError } from "../errorUtils";

type UseAnalysisFlowArgs = {
  grantToken: string | null;
  sessionId: string | null;
};

export function useAnalysisFlow({
  grantToken,
  sessionId,
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

    const clientRequestId = createClientRequestId("analyzePerformance");
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      await analyzePerformance({ grantToken, sessionId, clientRequestId });
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
  }, [analyzePerformance, grantToken, sessionId]);

  const deepDiveTopic = useCallback(
    async (topic: string) => {
      if (!grantToken || !sessionId) {
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
