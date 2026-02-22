import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="bg-cream text-ink flex min-h-screen items-center justify-center px-6 py-10">
      <div className="border-cream-border bg-surface-white flex items-center gap-3 rounded-2xl border p-5 shadow-sm">
        <Loader2 size={20} className="text-accent animate-spin" />
        <p className="text-ink-secondary text-sm font-medium">
          Arbeitsbereich wird vorbereitet...
        </p>
      </div>
    </div>
  );
}
