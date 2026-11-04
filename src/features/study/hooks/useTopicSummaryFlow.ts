import { useCallback, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { dismissTopicSummaryRef, generateTopicSummaryRef } from "../convexRefs";
import { createClientRequestId } from "../errorUtils";
import type { StudySessionId } from "../types";

type UseTopicSummaryFlowArgs = {
  sessionId: StudySessionId | null;
};

export function useTopicSummaryFlow({ sessionId }: UseTopicSummaryFlowArgs) {
  const [isDismissing, setIsDismissing] = useState(false);

  const generateTopicSummary = useAction(generateTopicSummaryRef);
  const dismissTopicSummaryMutation = useMutation(dismissTopicSummaryRef);

  // Der Status landet über startTopicSummary in der Sitzung. Fehler zeigt die
  // Zusammenfassung selbst an, deshalb wird hier nur protokolliert.
  const startTopicSummary = useCallback(
    async (focusTopics: string[]) => {
      if (!sessionId || focusTopics.length === 0) {
        return;
      }

      try {
        await generateTopicSummary({
          sessionId,
          focusTopics,
          clientRequestId: createClientRequestId("generateTopicSummary"),
        });
      } catch (error) {
        console.error("Zusammenfassung fehlgeschlagen:", error);
      }
    },
    [generateTopicSummary, sessionId],
  );

  const dismissTopicSummary = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    setIsDismissing(true);
    try {
      await dismissTopicSummaryMutation({ sessionId });
    } finally {
      setIsDismissing(false);
    }
  }, [dismissTopicSummaryMutation, sessionId]);

  return { startTopicSummary, dismissTopicSummary, isDismissing };
}
