import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { useAction, useMutation } from "convex/react";
import {
  extractDocumentContentRef,
  generateQuizRef,
  generateUploadUrlRef,
  registerUploadedDocumentRef,
  removeDocumentRef,
} from "../convexRefs";
import { createClientRequestId, formatError } from "../errorUtils";
import { uploadFileToConvexStorage } from "../upload";
import {
  trackDocumentExtractionFailed,
  trackDocumentRemoved,
  trackDocumentUploadFailed,
  trackDocumentUploadStarted,
  trackDocumentUploadSucceeded,
  trackQuizGenerationFailed,
  trackQuizGenerationRequested,
  trackQuizGenerationSucceeded,
} from "../analytics";

type UseUploadFlowArgs = {
  grantToken: string | null;
  sessionId: string | null;
  documentCount: number;
  readyDocumentCount: number;
};

type ExtractionResult = {
  extractionStatus?: "ready" | "failed";
};

export function useUploadFlow({
  grantToken,
  sessionId,
  documentCount,
  readyDocumentCount,
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
  const extractDocumentContent = useAction(extractDocumentContentRef);
  const generateQuiz = useAction(generateQuizRef);

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

        try {
          const uploadUrl = await generateUploadUrl({ grantToken, sessionId });
          const uploadResult = await uploadFileToConvexStorage(uploadUrl, file);
          const documentId = await registerUploadedDocument({
            grantToken,
            sessionId,
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

    const startedAt = Date.now();
    const clientRequestId = createClientRequestId("generateQuiz");
    setIsGeneratingQuiz(true);
    setUploadError(null);
    trackQuizGenerationRequested({
      documents: documentCount,
      readyDocuments: readyDocumentCount,
    });

    try {
      await generateQuiz({
        grantToken,
        sessionId,
        questionCount: 30,
        clientRequestId,
      });
      trackQuizGenerationSucceeded(Date.now() - startedAt, {
        documents: documentCount,
        readyDocuments: readyDocumentCount,
      });
    } catch (error: unknown) {
      trackQuizGenerationFailed(Date.now() - startedAt, {
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
  }, [documentCount, generateQuiz, grantToken, readyDocumentCount, sessionId]);

  const removeDocumentById = useCallback(
    async (documentId: string) => {
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
    removeDocumentById,
  };
}
