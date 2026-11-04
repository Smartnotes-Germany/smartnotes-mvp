import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, Loader2, LogOut, Menu, X } from "lucide-react";
import { AccountSummary } from "./AccountSummary";
import { BrandLogo } from "./BrandLogo";
import { StageBadge } from "./StageBadge";
import { ThemeToggle } from "./ThemeToggle";
import type { StudyStage, ThemePreference } from "../types";

type NavigationShellProps = {
  logoImage: string;
  stage: StudyStage;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  examTitle: string;
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
  children: ReactNode;
};

export function NavigationShell({
  logoImage,
  stage,
  preference,
  setPreference,
  examTitle,
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

  const handleSignOut = () => {
    setIsMobileMenuOpen(false);
    void onSignOut();
  };

  return (
    <div className="app-glow text-ink flex min-h-dvh flex-col overflow-hidden md:h-screen md:min-h-screen md:flex-row">
      <header className="bg-cream/70 border-cream-border z-50 flex items-center justify-between border-b px-5 py-4 backdrop-blur-md md:hidden">
        <BrandLogo logoImage={logoImage} size="sm" />
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
            <ExamTitle title={examTitle} />
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
              <AccountSummary />
              <div className="flex justify-center pb-2">
                <ThemeToggle
                  preference={preference}
                  setPreference={setPreference}
                />
              </div>
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="pill-button pill-button--quiet text-ink w-full justify-center gap-2"
              >
                <LayoutGrid size={14} />
                Alle Prüfungen
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="pill-button pill-button--quiet w-full justify-center gap-2"
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
        <div className="mb-10">
          <BrandLogo logoImage={logoImage} />
        </div>

        <ExamTitle title={examTitle} />
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
          <AccountSummary />
          <div className="flex justify-center pb-2">
            <ThemeToggle
              preference={preference}
              setPreference={setPreference}
            />
          </div>
          <Link
            to="/"
            className="pill-button pill-button--quiet text-ink w-full justify-center gap-2"
          >
            <LayoutGrid size={14} />
            Alle Prüfungen
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="pill-button pill-button--quiet w-full justify-center gap-2"
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

      <main className="flex-1 overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:p-8 md:pb-8 lg:p-12 lg:pb-12">
        <div className="mx-auto h-full min-h-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

function ExamTitle({ title }: { title: string }) {
  return (
    <div className="mb-6 px-2">
      <p className="text-ink-muted mb-1 text-xs font-medium">Prüfung</p>
      <p className="text-ink line-clamp-2 text-sm font-semibold">{title}</p>
    </div>
  );
}
