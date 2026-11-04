import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Loader2, Trash2 } from "lucide-react";
import { Dialog } from "./Dialog";
import { formatError } from "../errorUtils";

const MAX_EXAM_TITLE_LENGTH = 80;

const fieldClassName =
  "border-cream-border bg-cream-light focus:border-accent min-h-12 w-full rounded-full border px-5 text-sm font-medium transition outline-none";

const errorClassName =
  "mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400";

const todayAsDateInput = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
};

export function CreateExamDialog({
  isCreating,
  onCreate,
  onClose,
}: {
  isCreating: boolean;
  onCreate: (title: string, examDate: string) => Promise<void>;
  onClose: () => void;
}) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!title.trim()) {
      setError("Bitte gib der Prüfung einen Namen.");
      return;
    }

    setError(null);
    try {
      await onCreate(title, examDate);
    } catch (createError: unknown) {
      setError(
        formatError(createError, {
          fallback:
            "Die Prüfung konnte nicht erstellt werden. Bitte versuche es erneut.",
        }),
      );
    }
  };

  return (
    <Dialog
      title="Prüfung erstellen"
      description="Danach lädst du deine Unterlagen hoch."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label
          htmlFor="exam-title"
          className="text-ink mb-2 block text-sm font-medium"
        >
          Name der Prüfung
        </label>
        <input
          ref={nameInputRef}
          id="exam-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="z. B. Abschlussprüfung Teil 1"
          maxLength={MAX_EXAM_TITLE_LENGTH}
          className={`${fieldClassName} mb-5`}
        />

        <label
          htmlFor="exam-date"
          className="text-ink mb-2 flex items-baseline justify-between gap-4 text-sm font-medium"
        >
          Prüfungstermin
          <span className="text-ink-muted text-xs font-normal">Optional</span>
        </label>
        <input
          id="exam-date"
          type="date"
          value={examDate}
          min={todayAsDateInput()}
          onChange={(event) => setExamDate(event.target.value)}
          className={`${fieldClassName} mb-6 [color-scheme:light] dark:[color-scheme:dark]`}
        />

        {error && <p className={errorClassName}>{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="pill-button pill-button--quiet"
          >
            Abbrechen
          </button>
          <button type="submit" disabled={isCreating} className="pill-button">
            Erstellen
            <span className="pill-button__arrow" aria-hidden="true">
              {isCreating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
            </span>
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function ShareExamDialog({
  title,
  getShareUrl,
  onClose,
}: {
  title: string;
  getShareUrl: () => Promise<string>;
  onClose: () => void;
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    getShareUrl()
      .then((url) => {
        if (!isCancelled) {
          setShareUrl(url);
        }
      })
      .catch((shareError: unknown) => {
        if (!isCancelled) {
          setError(
            formatError(shareError, {
              fallback: "Der Link konnte nicht erstellt werden.",
            }),
          );
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [getShareUrl]);

  const copyLink = async () => {
    if (!shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setError("Kopieren hat nicht geklappt. Markiere den Link von Hand.");
    }
  };

  return (
    <Dialog
      title="Prüfung teilen"
      description={`Wer den Link öffnet, bekommt „${title}“ als eigene Kopie, mit deinen Unterlagen, Themen und Fragen. Dein Fortschritt und deine Analyse bleiben privat.`}
      onClose={onClose}
    >
      <label
        htmlFor="share-url"
        className="text-ink mb-2 block text-sm font-medium"
      >
        Link
      </label>
      <input
        id="share-url"
        readOnly
        value={shareUrl ?? "Link wird erstellt …"}
        onFocus={(event) => event.target.select()}
        className={`${fieldClassName} text-ink-secondary mb-6`}
      />

      {error && <p className={errorClassName}>{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="pill-button pill-button--quiet"
        >
          Schließen
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          disabled={!shareUrl}
          className="pill-button"
        >
          {isCopied ? "Kopiert" : "Link kopieren"}
          <span className="pill-button__arrow" aria-hidden="true">
            {shareUrl ? (
              isCopied ? (
                <Check size={16} />
              ) : (
                <Copy size={16} />
              )
            ) : (
              <Loader2 size={16} className="animate-spin" />
            )}
          </span>
        </button>
      </div>
    </Dialog>
  );
}

export function DeleteExamDialog({
  title,
  onDelete,
  onClose,
}: {
  title: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (deleteError: unknown) {
      setError(
        formatError(deleteError, {
          fallback: "Die Prüfung konnte nicht gelöscht werden.",
        }),
      );
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      title="Prüfung löschen?"
      description={`„${title}“ wird mit Unterlagen und Fortschritt aus deinem Konto gelöscht. Wer die Prüfung über deinen Link bekommen hat, behält seine Kopie.`}
      onClose={onClose}
    >
      {error && <p className={errorClassName}>{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="pill-button pill-button--quiet"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={() => void confirmDelete()}
          disabled={isDeleting}
          className="pill-button bg-red-600 hover:bg-red-700"
        >
          Löschen
          <span className="pill-button__arrow" aria-hidden="true">
            {isDeleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </span>
        </button>
      </div>
    </Dialog>
  );
}
