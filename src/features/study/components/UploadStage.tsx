import type { ChangeEvent } from "react";
import { Loader2, Sparkles, Upload, XCircle } from "lucide-react";
import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_FILE_TYPES_LABEL,
  MAX_UPLOAD_FILE_LABEL,
} from "../constants";
import type {
  ExtractionStatus,
  StudyDocument,
  StudyDocumentId,
} from "../types";

type UploadStageProps = {
  documents: StudyDocument[];
  isUploading: boolean;
  uploadError: string | null;
  isGeneratingQuiz: boolean;
  isRemovingDocument: StudyDocumentId | null;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGenerateQuiz: () => Promise<void>;
  onRemoveDocument: (documentId: StudyDocumentId) => Promise<void>;
};

export function UploadStage({
  documents,
  isUploading,
  uploadError,
  isGeneratingQuiz,
  isRemovingDocument,
  onFileInputChange,
  onGenerateQuiz,
  onRemoveDocument,
}: UploadStageProps) {
  const readyDocuments = documents.filter(
    (document) => document.extractionStatus === "ready",
  );

  return (
    <section className="flex h-full min-h-full flex-col items-center py-4 text-center">
      <div className="my-auto w-full max-w-3xl">
        <label className="border-cream-border bg-cream-light hover:border-accent/40 mb-6 flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition md:py-24">
          {isUploading ? (
            <Loader2 size={48} className="text-accent animate-spin" />
          ) : (
            <Upload size={40} className="text-accent" />
          )}
          <div>
            <p className="text-xl font-bold md:text-2xl">
              {isUploading
                ? "Inhalte werden verarbeitet..."
                : "Dateien zum Hochladen auswählen"}
            </p>
            <p className="text-ink-muted text-base">
              {ACCEPTED_FILE_TYPES_LABEL} - maximal {MAX_UPLOAD_FILE_LABEL} pro
              Datei
            </p>
          </div>
          <input
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={onFileInputChange}
            disabled={isUploading}
          />
        </label>

        {uploadError && (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm whitespace-pre-line text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {uploadError}
          </p>
        )}

        <div className="mb-8 w-full space-y-2">
          {documents.length === 0 ? (
            <p className="border-cream-border bg-cream-light text-ink-muted rounded-2xl border px-6 py-4 text-sm italic">
              Noch keine Dateien hochgeladen.
            </p>
          ) : (
            documents.map((document) => (
              <div
                key={document._id}
                className="border-cream-border bg-surface-white flex items-center justify-between rounded-xl border p-4 text-left shadow-sm"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-ink truncate text-sm font-semibold">
                    {document.fileName}
                  </p>
                  <p className="text-ink-muted flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
                    {(document.extractionStatus === "pending" ||
                      document.extractionStatus === "processing") && (
                      <Loader2 size={10} className="text-accent animate-spin" />
                    )}
                    {renderExtractionStatus(document.extractionStatus)}
                  </p>
                  {document.extractionStatus === "failed" &&
                    document.extractionError && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {document.extractionError}
                      </p>
                    )}
                </div>

                <button
                  type="button"
                  onClick={() => void onRemoveDocument(document._id)}
                  disabled={isRemovingDocument === document._id}
                  className="text-ink-muted p-2 transition hover:text-red-500 disabled:opacity-60"
                >
                  {isRemovingDocument === document._id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <XCircle size={18} />
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {readyDocuments.length > 0 && (
          <button
            type="button"
            onClick={() => void onGenerateQuiz()}
            disabled={isUploading || isGeneratingQuiz}
            className="bg-accent shadow-accent/20 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-60"
          >
            {isUploading || isGeneratingQuiz ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Sparkles size={20} />
            )}
            {isGeneratingQuiz
              ? "Themen werden extrahiert..."
              : "Themen Auswählen"}
          </button>
        )}
      </div>
    </section>
  );
}

const renderExtractionStatus = (status: ExtractionStatus) => {
  switch (status) {
    case "pending":
      return "Wartet...";
    case "processing":
      return "Wird analysiert...";
    case "ready":
      return "Bereit";
    case "failed":
      return "Fehler";
    default:
      return status;
  }
};
