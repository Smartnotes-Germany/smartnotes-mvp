import { useEffect, useId, type ReactNode } from "react";

type DialogProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
};

/** Zentriertes Fenster über der Seite. Escape oder ein Klick daneben schließt es. */
export function Dialog({ title, description, onClose, children }: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sp-card animate-step-forward w-full max-w-md p-6 md:p-8"
      >
        <h2
          id={titleId}
          className="mb-2 text-2xl font-medium tracking-[-0.04em]"
        >
          {title}
        </h2>
        {description && (
          <p className="text-ink-secondary mb-6 text-sm leading-relaxed">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
