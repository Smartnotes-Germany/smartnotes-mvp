import { CheckCircle2, CircleDashed } from "lucide-react";

type StageBadgeProps = {
  label: string;
  active: boolean;
  done: boolean;
};

export function StageBadge({ label, active, done }: StageBadgeProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-full px-5 py-3.5 text-sm font-semibold transition-all duration-300 ${
        active
          ? "bg-action shadow-action/15 text-white shadow-md"
          : done
            ? "text-accent"
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
