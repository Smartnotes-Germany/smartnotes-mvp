import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="border-cream-border bg-surface-white flex items-center gap-1 rounded-full border p-1 shadow-sm">
      <button
        onClick={() => setTheme("light")}
        className={`flex items-center justify-center rounded-full p-2 transition-colors ${
          theme === "light"
            ? "bg-cream-light text-accent shadow-sm"
            : "text-ink-muted hover:text-ink hover:bg-cream/50"
        }`}
        aria-label="Helles Design"
        title="Hell"
      >
        <Sun size={16} />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`flex items-center justify-center rounded-full p-2 transition-colors ${
          theme === "system"
            ? "bg-cream-light text-accent shadow-sm"
            : "text-ink-muted hover:text-ink hover:bg-cream/50"
        }`}
        aria-label="System Design"
        title="System"
      >
        <Monitor size={16} />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`flex items-center justify-center rounded-full p-2 transition-colors ${
          theme === "dark"
            ? "bg-cream-light text-accent shadow-sm"
            : "text-ink-muted hover:text-ink hover:bg-cream/50"
        }`}
        aria-label="Dunkles Design"
        title="Dunkel"
      >
        <Moon size={16} />
      </button>
    </div>
  );
}
