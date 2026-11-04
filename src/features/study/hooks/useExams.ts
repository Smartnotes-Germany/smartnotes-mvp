import { useCallback, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  createShareLinkRef,
  deleteSessionRef,
  listSessionsRef,
  startSessionRef,
} from "../convexRefs";
import { trackSessionStarted } from "../analytics";
import type { StudySessionId } from "../types";

type CreateExamArgs = {
  title: string;
  examDate?: string;
};

/** Prüfungen des Kontos für die Startseite: anlegen, teilen und löschen. */
export function useExams() {
  const exams = useQuery(listSessionsRef);
  const startSession = useMutation(startSessionRef);
  const createShareLink = useMutation(createShareLinkRef);
  const deleteSession = useMutation(deleteSessionRef);
  const [isCreating, setIsCreating] = useState(false);

  const createExam = useCallback(
    async ({ title, examDate }: CreateExamArgs): Promise<StudySessionId> => {
      setIsCreating(true);
      try {
        const sessionId = await startSession({
          title,
          ...(examDate ? { examDate } : {}),
        });
        trackSessionStarted("fresh");
        return sessionId;
      } finally {
        setIsCreating(false);
      }
    },
    [startSession],
  );

  const getShareUrl = useCallback(
    async (sessionId: StudySessionId) => {
      const token = await createShareLink({ sessionId });
      return `${window.location.origin}/teilen/${token}`;
    },
    [createShareLink],
  );

  const deleteExam = useCallback(
    async (sessionId: StudySessionId) => {
      await deleteSession({ sessionId });
    },
    [deleteSession],
  );

  return { exams, createExam, isCreating, getShareUrl, deleteExam };
}
