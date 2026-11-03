import { useState } from "react";
import type { ChangeEvent } from "react";
import { ArrowRight, Link2, Loader2, Upload, XCircle } from "lucide-react";
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
import { LinkImportDialog } from "./LinkImportDialog";

type UploadStageProps = {
  documents: StudyDocument[];
  isUploading: boolean;
  uploadError: string | null;
  isGeneratingQuiz: boolean;
  isRemovingDocument: StudyDocumentId | null;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportLink: (url: string) => Promise<boolean>;
  onGenerateQuiz: () => Promise<void>;
  onRemoveDocument: (documentId: StudyDocumentId) => Promise<void>;
};

const sourceTileClassName =
  "border-cream-border bg-surface-white hover:border-accent/60 flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-[22px] border-2 border-dashed px-6 py-10 text-center transition md:py-16";

export function UploadStage({
  documents,
  isUploading,
  uploadError,
  isGeneratingQuiz,
  isRemovingDocument,
  onFileInputChange,
  onImportLink,
  onGenerateQuiz,
  onRemoveDocument,
}: UploadStageProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

  const readyDocuments = documents.filter(
    (document) => document.extractionStatus === "ready",
  );
  const isUploadingFiles = isUploading && !isLinkDialogOpen;

  return (
    <section className="flex h-full min-h-full flex-col items-center py-4 text-center">
      <div className="my-auto w-full max-w-3xl">
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <label
            className={`${sourceTileClassName} ${isUploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <span className="bg-action/10 text-accent grid h-16 w-16 place-items-center rounded-full">
              {isUploadingFiles ? (
                <Loader2 size={28} className="animate-spin" />
              ) : (
                <Upload size={28} />
              )}
            </span>
            <div>
              <p className="text-xl font-medium tracking-[-0.03em] md:text-2xl">
                {isUploadingFiles ? "Wird verarbeitet..." : "Dateien hochladen"}
              </p>
              <p className="text-ink-secondary mt-1 text-sm">
                {ACCEPTED_FILE_TYPES_LABEL} – maximal {MAX_UPLOAD_FILE_LABEL}{" "}
                pro Datei
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

          <button
            type="button"
            onClick={() => setIsLinkDialogOpen(true)}
            disabled={isUploading}
            className={`${sourceTileClassName} disabled:pointer-events-none disabled:opacity-60`}
          >
            <span className="bg-action/10 text-accent grid h-16 w-16 place-items-center rounded-full">
              <Link2 size={28} />
            </span>
            <div>
              <p className="text-xl font-medium tracking-[-0.03em] md:text-2xl">
                Link hinzufügen
              </p>
              <p className="text-ink-secondary mt-1 text-sm">
                GitHub-Repository, README, mdBook oder eine andere Webseite
              </p>
            </div>
          </button>
        </div>

        <LinkImportDialog
          open={isLinkDialogOpen}
          isImporting={isUploading}
          error={uploadError}
          onClose={() => setIsLinkDialogOpen(false)}
          onImportLink={onImportLink}
        />

        {uploadError && !isLinkDialogOpen && (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm whitespace-pre-line text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {uploadError}
          </p>
        )}

        <div className="mb-8 w-full space-y-2">
          {documents.length === 0 ? (
            <p className="border-cream-border bg-cream-light text-ink-muted rounded-2xl border px-6 py-4 text-sm">
              Noch keine Dateien oder Links hinzugefügt.
            </p>
          ) : (
            documents.map((document) => (
              <div
                key={document._id}
                className="border-cream-border bg-cream-light flex items-center justify-between rounded-2xl border p-4 text-left"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-ink truncate text-sm font-semibold">
                    {document.fileName}
                  </p>
                  <p className="text-ink-muted flex items-center gap-1.5 text-xs font-medium">
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
            className="pill-button"
          >
            {isGeneratingQuiz
              ? "Themen werden extrahiert..."
              : "Themen auswählen"}
            <span className="pill-button__arrow" aria-hidden="true">
              {isUploading || isGeneratingQuiz ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
            </span>
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
