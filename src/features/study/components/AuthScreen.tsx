import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";
import { useConvex } from "convex/react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
import { checkAccessCodeRef } from "../convexRefs";
import {
  clearPendingAccessCode,
  readPendingAccessCode,
  storePendingAccessCode,
} from "../pendingAccessCode";
import type { ThemePreference } from "../types";

const SIGN_UP_PATH = "/registrieren";

type AuthScreenProps = {
  mode: "sign-in" | "sign-up";
  logoImage: string;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export function AuthScreen({
  mode,
  logoImage,
  preference,
  setPreference,
}: AuthScreenProps) {
  const { pathname } = useLocation();
  // Nur der erste Schritt der Registrierung braucht den Zugangscode, die
  // Bestätigung der E-Mail-Adresse zeigt Clerk wie gewohnt.
  const isSignUpStart =
    mode === "sign-up" && pathname.replace(/\/$/, "") === SIGN_UP_PATH;

  return (
    <div className="app-glow text-ink flex min-h-screen flex-col items-center justify-center px-6 py-10 md:px-10">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle preference={preference} setPreference={setPreference} />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <BrandLogo logoImage={logoImage} />
        </div>

        <div className="sp-card p-6 md:p-8">
          {mode === "sign-in" ? (
            <SignIn routing="path" path="/anmelden" />
          ) : isSignUpStart ? (
            <SignUpWithAccessCode />
          ) : (
            <SignUp routing="path" path={SIGN_UP_PATH} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Clerks Registrierung kennt keine eigenen Felder. Der Zugangscode wird
 * deshalb vorher geprüft und vorgemerkt; nach dem Anlegen des Kontos löst
 * useAuthSession ihn automatisch ein. Ohne gültigen Code gibt es kein Konto.
 */
function SignUpWithAccessCode() {
  const convex = useConvex();
  const [pendingCode] = useState(readPendingAccessCode);
  const [accessCode, setAccessCode] = useState(pendingCode?.code ?? "");
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  // Beim ersten Anzeigen gibt es keinen Übergang, danach gleitet der neue
  // Schritt aus der Richtung herein, in die es weitergeht.
  const [stepDirection, setStepDirection] = useState<"forward" | "back" | null>(
    null,
  );

  const verifyCode = useCallback(
    async (code: string) => {
      if (!code.trim()) {
        setError("Bitte gib deinen Zugangscode ein.");
        return;
      }

      setIsChecking(true);
      setError(null);
      try {
        const { status } = await convex.query(checkAccessCodeRef, { code });
        if (status === "valid") {
          storePendingAccessCode(code, pendingCode?.source ?? "manual_code");
          setVerifiedCode(code.trim());
          setStepDirection("forward");
        } else {
          setError(
            status === "already_used"
              ? "Dieser Zugangscode wurde bereits verwendet."
              : "Zugangscode wurde nicht erkannt.",
          );
        }
      } catch {
        setError("Der Zugangscode konnte nicht geprüft werden.");
      } finally {
        setIsChecking(false);
      }
    },
    [convex, pendingCode],
  );

  // Ein vorgemerkter Code, etwa aus einem Magic Link, wird gleich geprüft.
  useEffect(() => {
    if (pendingCode) {
      void verifyCode(pendingCode.code);
    }
  }, [pendingCode, verifyCode]);

  const changeCode = () => {
    clearPendingAccessCode();
    setVerifiedCode(null);
    setStepDirection("back");
  };

  const stepAnimation =
    stepDirection === "forward"
      ? "animate-step-forward"
      : stepDirection === "back"
        ? "animate-step-back"
        : undefined;

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-medium tracking-[-0.04em]">
        Konto erstellen
      </h1>

      <AnimatedHeight>
        <div key={verifiedCode ? "form" : "code"} className={stepAnimation}>
          {verifiedCode ? (
            <>
              <p className="text-ink-secondary mb-6 flex items-center justify-center gap-2 text-sm">
                <CheckCircle2 size={16} className="text-accent shrink-0" />
                <span>
                  Zugangscode{" "}
                  <span className="text-ink font-medium">{verifiedCode}</span>
                </span>
                <button
                  type="button"
                  onClick={changeCode}
                  className="text-accent font-medium underline underline-offset-4 hover:opacity-80"
                >
                  Ändern
                </button>
              </p>
              <SignUp
                routing="path"
                path={SIGN_UP_PATH}
                appearance={{ elements: { header: "hidden" } }}
              />
            </>
          ) : (
            <>
              <p className="text-ink-secondary mb-6 text-center text-sm">
                Gib zuerst deinen Zugangscode ein.
              </p>

              <label
                htmlFor="sign-up-access-code"
                className="text-ink mb-2 block text-sm font-medium"
              >
                Zugangscode
              </label>
              <input
                id="sign-up-access-code"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void verifyCode(accessCode);
                  }
                }}
                placeholder="STACKPREP-XXXX"
                autoComplete="off"
                spellCheck={false}
                className="border-cream-border bg-cream-light focus:border-accent mb-5 min-h-11 w-full rounded-full border px-4 text-sm font-medium transition outline-none"
              />

              {error && (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => void verifyCode(accessCode)}
                disabled={isChecking}
                className="pill-button w-full justify-between"
              >
                Weiter
                <span className="pill-button__arrow" aria-hidden="true">
                  {isChecking ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                </span>
              </button>

              <p className="text-ink-muted mt-6 text-center text-sm">
                Bereits ein Konto?{" "}
                <Link
                  to="/anmelden"
                  className="text-accent font-medium hover:opacity-80"
                >
                  Anmelden
                </Link>
              </p>
            </>
          )}
        </div>
      </AnimatedHeight>
    </>
  );
}

/**
 * Folgt der Höhe des Inhalts mit einer Transition, damit die Karte beim
 * Wechsel der Schritte (und beim Nachladen von Clerk) nicht springt.
 */
function AnimatedHeight({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [isResizing, setIsResizing] = useState(false);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    let previousHeight: number | undefined;
    const observer = new ResizeObserver(() => {
      const nextHeight = content.offsetHeight;
      if (previousHeight !== undefined && previousHeight !== nextHeight) {
        setIsResizing(true);
      }
      previousHeight = nextHeight;
      setHeight(nextHeight);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      // Nur während der Transition abschneiden, sonst fehlen Schatten und
      // Fokus-Rahmen am Rand.
      className={`animated-height ${isResizing ? "overflow-hidden" : ""}`}
      style={{ height }}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) {
          setIsResizing(false);
        }
      }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
