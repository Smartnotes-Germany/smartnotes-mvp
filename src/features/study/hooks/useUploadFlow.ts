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

type UseUploadFlowArgs = {
  grantToken: string | null;
  sessionId: string | null;
};

export function useUploadFlow({ grantToken, sessionId }: UseUploadFlowArgs) {
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
  }, [generateQuiz, grantToken, sessionId]);

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
    removeDocumentById,
  };
}
