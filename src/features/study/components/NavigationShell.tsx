import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, LogOut, Menu, RefreshCcw, X } from "lucide-react";
import { StageBadge } from "./StageBadge";
import { ThemeToggle } from "./ThemeToggle";
import type { StudyStage, ThemePreference } from "../types";

type NavigationShellProps = {
  logoImage: string;
  stage: StudyStage;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  onStartFreshSession: () => Promise<void>;
  isCreatingSession: boolean;
  onSignOut: () => void;
  isSigningOut: boolean;
  children: ReactNode;
};

export function NavigationShell({
  logoImage,
  stage,
  preference,
  setPreference,
  onStartFreshSession,
  isCreatingSession,
  onSignOut,
  isSigningOut,
  children,
}: NavigationShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isQuizStep = stage === "mode_selection" || stage === "quiz";

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
      return;
    }
    document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const handleStartFreshSession = async () => {
    setIsMobileMenuOpen(false);
    await onStartFreshSession();
  };

  const handleSignOut = () => {
    setIsMobileMenuOpen(false);
    onSignOut();
  };

  return (
    <div className="bg-cream text-ink flex min-h-dvh flex-col overflow-hidden md:h-screen md:min-h-screen md:flex-row">
      <header className="bg-surface-white border-cream-border z-50 flex items-center justify-between border-b px-5 py-4 md:hidden">
        <div className="flex items-center gap-2">
          <img
            src={logoImage}
            alt="Logo"
            className="border-cream-border h-8 w-8 rounded-lg border"
          />
          <p className="text-accent text-xs font-black tracking-[0.16em] uppercase">
            Smartnotes
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="text-ink-muted hover:text-ink p-2 transition"
          aria-label="Menü öffnen"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {isMobileMenuOpen && (
        <div className="bg-cream/95 animate-in fade-in slide-in-from-top fixed inset-0 z-40 duration-300 md:hidden">
          <div className="flex h-full flex-col px-6 pt-20 pb-10">
            <nav className="mb-8 space-y-4">
              <StageBadge
                label="1. Hochladen"
                active={stage === "upload"}
                done={stage !== "upload"}
              />
              <StageBadge
                label="2. Quiz"
                active={isQuizStep}
                done={stage === "analysis"}
              />
              <StageBadge
                label="3. Analyse"
                active={stage === "analysis"}
                done={false}
              />
            </nav>

            <div className="mt-auto space-y-3">
              <div className="flex justify-center pb-2">
                <ThemeToggle
                  preference={preference}
                  setPreference={setPreference}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleStartFreshSession()}
                disabled={isCreatingSession}
                className="border-cream-border bg-surface-white text-ink inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-xs font-bold tracking-[0.12em] uppercase transition disabled:opacity-60"
              >
                {isCreatingSession ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCcw size={14} />
                )}
                Neue Sitzung
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="border-cream-border bg-surface-white text-ink-muted inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-xs font-bold tracking-[0.12em] uppercase transition disabled:opacity-60"
              >
                {isSigningOut ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <LogOut size={14} />
                )}
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="border-cream-border bg-surface-white hidden w-[300px] flex-shrink-0 flex-col border-r p-6 md:flex">
        <div className="mb-8 flex items-center gap-3">
          <img
            src={logoImage}
            alt="Smartnotes"
            className="border-cream-border h-10 w-10 rounded-xl border"
          />
          <p className="text-accent text-base font-black tracking-[0.16em] uppercase">
            Smartnotes
          </p>
        </div>

        <nav className="space-y-3">
          <StageBadge
            label="1. Hochladen"
            active={stage === "upload"}
            done={stage !== "upload"}
          />
          <StageBadge
            label="2. Quiz"
            active={isQuizStep}
            done={stage === "analysis"}
          />
          <StageBadge
            label="3. Analyse"
            active={stage === "analysis"}
            done={false}
          />
        </nav>

        <div className="mt-auto space-y-2 pt-6">
          <div className="flex justify-center pb-2">
            <ThemeToggle
              preference={preference}
              setPreference={setPreference}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleStartFreshSession()}
            disabled={isCreatingSession}
            className="border-cream-border bg-surface-white text-ink hover:bg-cream-light inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase transition disabled:opacity-60"
          >
            {isCreatingSession ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCcw size={14} />
            )}
            Neue Sitzung
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="border-cream-border bg-surface-white text-ink-muted hover:text-ink inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase transition disabled:opacity-60"
          >
            {isSigningOut ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LogOut size={14} />
            )}
            Abmelden
          </button>
        </div>
      </aside>

      <main className="bg-cream flex-1 overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:p-8 md:pb-8 lg:p-12 lg:pb-12">
        <div className="mx-auto h-full min-h-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
