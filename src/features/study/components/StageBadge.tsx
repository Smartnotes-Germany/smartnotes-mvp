import { CheckCircle2, CircleDashed } from "lucide-react";

type StageBadgeProps = {
  label: string;
  active: boolean;
  done: boolean;
};

export function StageBadge({ label, active, done }: StageBadgeProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-5 py-4 text-xs font-bold tracking-[0.15em] uppercase transition-all duration-300 ${
        active
          ? "bg-accent shadow-accent/20 translate-x-1 text-white shadow-lg"
          : done
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-ink-muted"
      }`}
    >
      {done ? (
        <CheckCircle2 size={16} />
      ) : (
        <CircleDashed size={16} className={active ? "animate-spin-slow" : ""} />
      )}
      {label}
    </div>
  );
}
