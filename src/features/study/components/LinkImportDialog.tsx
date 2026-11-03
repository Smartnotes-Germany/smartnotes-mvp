import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Link2, Loader2, X } from "lucide-react";

type LinkImportDialogProps = {
  open: boolean;
  isImporting: boolean;
  error: string | null;
  onClose: () => void;
  onImportLink: (url: string) => Promise<boolean>;
};

export function LinkImportDialog({
  open,
  isImporting,
  error,
  onClose,
  onImportLink,
}: LinkImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [linkInput, setLinkInput] = useState("");
  // Fehler von früheren Datei-Uploads sollen hier nicht auftauchen.
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    setHasSubmitted(false);
    onClose();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    if (await onImportLink(linkInput)) {
      setLinkInput("");
      handleClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onCancel={(event) => {
        if (isImporting) {
          event.preventDefault();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isImporting) {
          handleClose();
        }
      }}
      className="border-cream-border bg-cream text-ink m-auto w-[calc(100%-2rem)] max-w-lg rounded-[22px] border p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={(event) => void onSubmit(event)} className="p-6 md:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.03em] md:text-2xl">
              Link hinzufügen
            </h2>
            <p className="text-ink-secondary mt-1 text-sm">
              Füge einen Link zu einem GitHub-Repository, einer README, einem
              mdBook oder einer anderen Webseite ein.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            aria-label="Schließen"
            className="text-ink-muted hover:text-ink -mt-1 -mr-2 p-2 transition disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <label htmlFor="link-import" className="sr-only">
          Link
        </label>
        <div className="border-cream-border bg-cream-light focus-within:border-accent mb-4 flex min-h-12 items-center gap-3 rounded-full border px-5 transition">
          <Link2 size={18} className="text-ink-muted shrink-0" />
          <input
            id="link-import"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoFocus
            value={linkInput}
            onChange={(event) => setLinkInput(event.target.value)}
            placeholder="https://github.com/…"
            disabled={isImporting}
            className="min-w-0 flex-1 bg-transparent py-3 text-sm font-medium outline-none"
          />
        </div>

        {hasSubmitted && error && (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm whitespace-pre-line text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isImporting || !linkInput.trim()}
          className="pill-button w-full justify-between"
        >
          {isImporting ? "Inhalte werden geladen..." : "Link hinzufügen"}
          <span className="pill-button__arrow" aria-hidden="true">
            {isImporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArrowRight size={16} />
            )}
          </span>
        </button>
      </form>
    </dialog>
  );
}
