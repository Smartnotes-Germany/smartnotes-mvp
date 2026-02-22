import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_OPTIONS } from "../constants";
import type { ThemePreference } from "../types";

type ThemeToggleProps = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export function ThemeToggle({ preference, setPreference }: ThemeToggleProps) {
  const icons: Record<ThemePreference, typeof Sun> = {
    light: Sun,
    system: Monitor,
    dark: Moon,
  };

  return (
    <div className="border-cream-border bg-cream-light inline-flex items-center gap-0.5 rounded-full border p-1">
      {THEME_OPTIONS.map((option) => {
        const Icon = icons[option.value];
        const isActive = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            title={option.label}
            className={`inline-flex items-center justify-center rounded-full p-2 transition ${
              isActive
                ? "bg-accent text-white shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
