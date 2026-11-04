import { Loader2 } from "lucide-react";

type LoadingScreenProps = {
  error?: string | null;
  onSignOut?: () => Promise<void>;
};

export function LoadingScreen({ error, onSignOut }: LoadingScreenProps) {
  if (error) {
    return (
      <div className="app-glow text-ink flex min-h-screen items-center justify-center px-6 py-10">
        <div className="sp-card w-full max-w-md p-6">
          <p className="text-ink-secondary mb-4 text-sm">{error}</p>
          {onSignOut && (
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="pill-button pill-button--quiet w-full justify-center"
            >
              Abmelden
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-glow text-ink flex min-h-screen items-center justify-center px-6 py-10">
      <div className="sp-card flex items-center gap-3 p-5">
        <Loader2 size={20} className="text-accent animate-spin" />
        <p className="text-ink-secondary text-sm font-medium">
          Arbeitsbereich wird vorbereitet...
        </p>
      </div>
    </div>
  );
}
