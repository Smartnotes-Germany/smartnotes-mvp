import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { useAction, useMutation } from "convex/react";
import {
  extractDocumentContentRef,
  generateFocusedQuizRef,
  generateQuizRef,
  generateUploadUrlRef,
  registerUploadedDocumentRef,
  removeDocumentRef,
} from "../convexRefs";
import { createClientRequestId, formatError } from "../errorUtils";
import { uploadFileToManagedStorage } from "../upload";
import {
  isVertexNativeCandidate,
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILE_LABEL,
  validateUploadFile,
} from "../../../../shared/uploadPolicy";
import type { StudyDocument, StudyDocumentId, StudySessionId } from "../types";
import {
  trackDocumentExtractionFailed,
  trackDocumentRemoved,
  trackDocumentUploadFailed,
  trackDocumentUploadStarted,
  trackDocumentUploadSucceeded,
  trackFocusedQuizGenerationFailed,
  trackFocusedQuizGenerationRequested,
  trackFocusedQuizGenerationSucceeded,
  trackTopicSelectionPreparationFailed,
  trackTopicSelectionPreparationRequested,
  trackTopicSelectionPreparationSucceeded,
} from "../analytics";

type UseUploadFlowArgs = {
  grantToken: string | null;
  sessionId: StudySessionId | null;
  documents: StudyDocument[];
  documentCount: number;
  readyDocumentCount: number;
};

type ExtractionResult = {
  extractionStatus?: "ready" | "failed";
};

type FocusedQuizGenerationResult = {
  questionCount?: number;
  focusTopics?: string[];
};

const FOCUSED_QUESTIONS_PER_TOPIC = 5;
const MAX_TRACKED_TOPICS = 6;

export const summarizeTopicSelectionForAnalytics = (focusTopics: string[]) => {
  const normalizedTopics = [
    ...new Set(focusTopics.map((topic) => topic.trim())),
  ].filter((topic) => topic.length > 0);
  const includesAll = normalizedTopics.includes("all");
  const effectiveTopics = includesAll
    ? ["all"]
    : normalizedTopics.filter((topic) => topic !== "all");

  if (effectiveTopics.length === 0) {
    return {
      normalizedTopics: effectiveTopics,
      selectionMode: "focused" as const,
      selectedTopicCount: 0,
      selectedTopics: "",
    };
  }

  if (effectiveTopics[0] === "all") {
    return {
      normalizedTopics: effectiveTopics,
      selectionMode: "all" as const,
      selectedTopicCount: 1,
      selectedTopics: "all",
    };
  }

  return {
    normalizedTopics: effectiveTopics,
    selectionMode: "focused" as const,
    selectedTopicCount: effectiveTopics.length,
    selectedTopics: effectiveTopics.slice(0, MAX_TRACKED_TOPICS).join(", "),
  };
};

export function useUploadFlow({
  grantToken,
  sessionId,
  documents,
  documentCount,
  readyDocumentCount,
}: UseUploadFlowArgs) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isRemovingDocument, setIsRemovingDocument] =
    useState<StudyDocumentId | null>(null);

  const generateUploadUrl = useMutation(generateUploadUrlRef);
  const registerUploadedDocument = useAction(registerUploadedDocumentRef);
  const removeDocument = useMutation(removeDocumentRef);
  const extractDocumentContent = useAction(extractDocumentContentRef);
  const generateQuiz = useAction(generateQuizRef);
  const generateFocusedQuiz = useAction(generateFocusedQuizRef);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!grantToken || !sessionId || files.length === 0) {
        return;
      }

      setIsUploading(true);
      setUploadError(null);
      const errors: string[] = [];
      trackDocumentUploadStarted(files.length);

      for (const file of files) {
        const clientRequestId = createClientRequestId("extractDocument");

        const uploadValidation = validateUploadFile({
          name: file.name,
          size: file.size,
        });
        if (!uploadValidation.valid) {
          trackDocumentUploadFailed();
          errors.push(`${file.name}: ${uploadValidation.message}`);
          continue;
        }

        try {
          const uploadData = await generateUploadUrl({ grantToken, sessionId });
          const uploadResult = await uploadFileToManagedStorage(
            uploadData.uploadUrl,
            file,
            {
              storageProvider: uploadData.storageProvider,
              presetStorageId: uploadData.storageId,
            },
          );
          const documentId = await registerUploadedDocument({
            grantToken,
            sessionId,
            uploadToken: uploadData.uploadToken,
            storageId: uploadResult.storageId,
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileSizeBytes: file.size,
          });

          const extractionResult = (await extractDocumentContent({
            grantToken,
            sessionId,
            documentId,
            clientRequestId,
          })) as ExtractionResult;

          if (extractionResult.extractionStatus === "failed") {
            trackDocumentExtractionFailed();
            trackDocumentUploadFailed();
            errors.push(
              `${file.name}: Die Datei konnte nicht vollständig verarbeitet werden.`,
            );
            continue;
          }

          trackDocumentUploadSucceeded();
        } catch (error: unknown) {
          trackDocumentUploadFailed();
          errors.push(
            `${file.name}: ${formatError(error, {
              fallback:
                "Datei konnte nicht hochgeladen oder verarbeitet werden.",
              clientRequestId,
            })}`,
          );
        }
      }

      if (errors.length > 0) {
        setUploadError(errors.join("\n"));
      }

      setIsUploading(false);
    },
    [
      extractDocumentContent,
      generateUploadUrl,
      grantToken,
      registerUploadedDocument,
      sessionId,
    ],
  );

  const onFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (!fileList) {
        return;
      }
      void uploadFiles(Array.from(fileList));
      event.target.value = "";
    },
    [uploadFiles],
  );

  const generateQuizQuestions = useCallback(async () => {
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

      setUploadError(
        `Mindestens eine Datei ist für die aktuelle KI-Verarbeitung zu groß (maximal ${MAX_UPLOAD_FILE_LABEL}). Bitte verkleinere die Datei oder teile sie auf: ${names}${suffix}`,
      );
      return;
    }

    const startedAt = Date.now();
    const clientRequestId = createClientRequestId("generateQuiz");
    setIsGeneratingQuiz(true);
    setUploadError(null);
    trackTopicSelectionPreparationRequested({
      documents: documentCount,
      readyDocuments: readyDocumentCount,
    });

    try {
      await generateQuiz({
        grantToken,
        sessionId,
        questionCount: 1,
        clientRequestId,
      });
      trackTopicSelectionPreparationSucceeded(Date.now() - startedAt, {
        documents: documentCount,
        readyDocuments: readyDocumentCount,
      });
    } catch (error: unknown) {
      trackTopicSelectionPreparationFailed(Date.now() - startedAt, {
        documents: documentCount,
        readyDocuments: readyDocumentCount,
      });
      setUploadError(
        formatError(error, {
          fallback: "Quizfragen konnten nicht erstellt werden.",
          clientRequestId,
        }),
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [
    documents,
    generateQuiz,
    grantToken,
    sessionId,
    documentCount,
    readyDocumentCount,
  ]);

  const generateFocusedQuizQuestions = useCallback(
    async (focusTopics: string[]) => {
      if (!grantToken || !sessionId || focusTopics.length === 0) {
        return;
      }

      const {
        normalizedTopics,
        selectionMode,
        selectedTopicCount,
        selectedTopics,
      } = summarizeTopicSelectionForAnalytics(focusTopics);
      if (normalizedTopics.length === 0) {
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

        setUploadError(
          `Mindestens eine Datei ist für die aktuelle KI-Verarbeitung zu groß (maximal ${MAX_UPLOAD_FILE_LABEL}). Bitte verkleinere die Datei oder teile sie auf: ${names}${suffix}`,
        );
        return;
      }

      const startedAt = Date.now();
      const clientRequestId = createClientRequestId("generateFocusedQuiz");
      setIsGeneratingQuiz(true);
      setUploadError(null);
      trackFocusedQuizGenerationRequested({
        documents: documentCount,
        readyDocuments: readyDocumentCount,
        selectionMode,
        selectedTopicCount,
        selectedTopics,
        questionsPerTopic: FOCUSED_QUESTIONS_PER_TOPIC,
      });

      try {
        const result = (await generateFocusedQuiz({
          grantToken,
          sessionId,
          focusTopics: normalizedTopics,
          questionsPerTopic: FOCUSED_QUESTIONS_PER_TOPIC,
          clientRequestId,
        })) as FocusedQuizGenerationResult;
        trackFocusedQuizGenerationSucceeded(Date.now() - startedAt, {
          documents: documentCount,
          readyDocuments: readyDocumentCount,
          selectionMode,
          selectedTopicCount,
          selectedTopics,
          questionsPerTopic: FOCUSED_QUESTIONS_PER_TOPIC,
          outputQuestionCount: result.questionCount,
        });
      } catch (error: unknown) {
        trackFocusedQuizGenerationFailed(Date.now() - startedAt, {
          documents: documentCount,
          readyDocuments: readyDocumentCount,
          selectionMode,
          selectedTopicCount,
          selectedTopics,
          questionsPerTopic: FOCUSED_QUESTIONS_PER_TOPIC,
        });
        setUploadError(
          formatError(error, {
            fallback:
              "Die Fragen für die gewählten Themen konnten nicht erstellt werden.",
            clientRequestId,
          }),
        );
      } finally {
        setIsGeneratingQuiz(false);
      }
    },
    [
      documentCount,
      documents,
      generateFocusedQuiz,
      grantToken,
      readyDocumentCount,
      sessionId,
    ],
  );

  const removeDocumentById = useCallback(
    async (documentId: StudyDocumentId) => {
      if (!grantToken || !sessionId) {
        return;
      }

      setIsRemovingDocument(documentId);
      try {
        await removeDocument({ grantToken, sessionId, documentId });
        trackDocumentRemoved("succeeded");
      } catch (error: unknown) {
        trackDocumentRemoved("failed");
        setUploadError(
          formatError(error, {
            fallback: "Die Datei konnte nicht entfernt werden.",
          }),
        );
      } finally {
        setIsRemovingDocument(null);
      }
    },
    [grantToken, removeDocument, sessionId],
  );

  return {
    isUploading,
    uploadError,
    isGeneratingQuiz,
    isRemovingDocument,
    setUploadError,
    onFileInputChange,
    generateQuizQuestions,
    generateFocusedQuizQuestions,
    removeDocumentById,
  };
}
