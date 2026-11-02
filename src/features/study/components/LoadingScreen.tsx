import { Loader2 } from "lucide-react";

export function LoadingScreen() {
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
