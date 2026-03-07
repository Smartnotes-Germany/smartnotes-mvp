import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { useAction, useMutation } from "convex/react";
import {
  extractDocumentContentRef,
  generatePdfSummaryRef,
  generateQuizRef,
  generateUploadUrlRef,
  registerUploadedDocumentRef,
  removeDocumentRef,
  startQuizRef,
} from "../convexRefs";
import { createClientRequestId, formatError } from "../errorUtils";
import { uploadFileToConvexStorage } from "../upload";
import {
  isVertexNativeCandidate,
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILE_LABEL,
  validateUploadFile,
} from "../../../../shared/uploadPolicy";
import type { StudyDocument } from "../types";

type UseUploadFlowArgs = {
  grantToken: string | null;
  sessionId: string | null;
  documents: StudyDocument[];
  quizQuestionsCount: number;
};

export function useUploadFlow({
  grantToken,
  sessionId,
  documents,
  quizQuestionsCount,
}: UseUploadFlowArgs) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isRemovingDocument, setIsRemovingDocument] = useState<string | null>(
    null,
  );

  const generateUploadUrl = useMutation(generateUploadUrlRef);
  const registerUploadedDocument = useMutation(registerUploadedDocumentRef);
  const removeDocument = useMutation(removeDocumentRef);
  const startQuiz = useMutation(startQuizRef);
  const extractDocumentContent = useAction(extractDocumentContentRef);
  const generateQuiz = useAction(generateQuizRef);
  const generatePdfSummary = useAction(generatePdfSummaryRef);

  const generatePdfSummaryQuestions = useCallback(async () => {
    if (!grantToken || !sessionId) {
      return;
    }

    const clientRequestId = createClientRequestId("generatePdfSummary");
    setIsGeneratingQuiz(true);
    setUploadError(null);

    try {
      await generatePdfSummary({
        grantToken,
        sessionId,
        clientRequestId,
      });
    } catch (error: unknown) {
      setUploadError(
        formatError(error, {
          fallback: "Die Lernübersicht konnte nicht erstellt werden.",
          clientRequestId,
        }),
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [generatePdfSummary, grantToken, sessionId]);

  const startQuizStudySession = useCallback(async () => {
    if (!grantToken || !sessionId) {
      return;
    }

    const clientRequestId = createClientRequestId("startQuiz");
    setIsGeneratingQuiz(true);
    setUploadError(null);

    try {
      if (quizQuestionsCount > 0) {
        await startQuiz({ grantToken, sessionId });
      } else {
        await generateQuiz({
          grantToken,
          sessionId,
          questionCount: 30,
          clientRequestId,
        });
      }
    } catch (error: unknown) {
      setUploadError(
        formatError(error, {
          fallback: "Das Quiz konnte nicht gestartet werden.",
          clientRequestId,
        }),
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [generateQuiz, grantToken, quizQuestionsCount, sessionId, startQuiz]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!grantToken || !sessionId || files.length === 0) {
        return;
      }

      setIsUploading(true);
      setUploadError(null);
      const errors: string[] = [];

      for (const file of files) {
        const clientRequestId = createClientRequestId("extractDocument");

        const uploadValidation = validateUploadFile({
          name: file.name,
          size: file.size,
        });
        if (!uploadValidation.valid) {
          errors.push(`${file.name}: ${uploadValidation.message}`);
          continue;
        }

        try {
          const uploadData = await generateUploadUrl({ grantToken, sessionId });
          if (uploadData.storageProvider !== "convex") {
            throw new Error(
              "Aktuell wird nur Convex-Speicher für Lernmaterial unterstützt.",
            );
          }

          const uploadResult = await uploadFileToConvexStorage(
            uploadData.uploadUrl,
            file,
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

          await extractDocumentContent({
            grantToken,
            sessionId,
            documentId,
            clientRequestId,
          });
        } catch (error: unknown) {
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

    const clientRequestId = createClientRequestId("generateQuiz");
    setIsGeneratingQuiz(true);
    setUploadError(null);

    try {
      await generateQuiz({
        grantToken,
        sessionId,
        questionCount: 30,
        clientRequestId,
      });
    } catch (error: unknown) {
      setUploadError(
        formatError(error, {
          fallback: "Quizfragen konnten nicht erstellt werden.",
          clientRequestId,
        }),
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [documents, generateQuiz, grantToken, sessionId]);

  const removeDocumentById = useCallback(
    async (documentId: string) => {
      if (!grantToken || !sessionId) {
        return;
      }

      setIsRemovingDocument(documentId);
      try {
        await removeDocument({ grantToken, sessionId, documentId });
      } catch (error: unknown) {
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
    generatePdfSummaryQuestions,
    removeDocumentById,
    startQuizStudySession,
  };
}
