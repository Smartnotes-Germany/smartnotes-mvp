/**
 * @file App.tsx
 * @description Main component of the Smartnotes application.
 * Manages the entire user flow: authentication via access code, 
 * document upload, AI-powered quiz generation, and learning progress analysis.
 */

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  CircleDashed,
  Lightbulb,
  Loader2,
  LogOut,
  Menu,
  RefreshCcw,
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import logoImage from "./assets/images/logo.png";

/**
 * Convex function references (Mutations, Queries, Actions).
 * These are required for type-safe calls to the backend.
 */
const redeemAccessCodeRef = makeFunctionReference<"mutation", { code: string }, { grantToken: string }>(
  "access:redeemAccessCode",
);
const consumeMagicLinkRef = makeFunctionReference<
  "mutation",
  { magicToken: string },
  { grantToken: string; obfuscatedCodes: string[] }
>("access:consumeMagicLink");
const startSessionRef = makeFunctionReference<"mutation", { grantToken: string; title?: string }, string>(
  "study:startSession",
);
const generateUploadUrlRef = makeFunctionReference<"mutation", { grantToken: string; sessionId: string }, string>(
  "study:generateUploadUrl",
);
const registerUploadedDocumentRef = makeFunctionReference<
  "mutation",
  {
    grantToken: string;
    sessionId: string;
    storageId: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
  },
  string
>("study:registerUploadedDocument");
const removeDocumentRef = makeFunctionReference<
  "mutation",
  { grantToken: string; sessionId: string; documentId: string },
  void
>("study:removeDocument");

const validateGrantRef = makeFunctionReference<
  "query",
  { grantToken: string },
  { valid: boolean; reason?: string; expiresAt?: number }
>("access:validateGrant");
const latestSessionIdRef = makeFunctionReference<"query", { grantToken: string }, string | null>(
  "study:getLatestSessionId",
);
const sessionSnapshotRef = makeFunctionReference<
  "query",
  { grantToken: string; sessionId: string },
  {
    session: {
      title: string;
      stage: "upload" | "quiz" | "analysis";
      round: number;
      quizQuestions: {
        id: string;
        topic: string;
        prompt: string;
      }[];
      analysis?: {
        overallReadiness: number;
        strongestTopics: string[];
        weakestTopics: string[];
        recommendedNextStep: string;
        topics: {
          topic: string;
          comfortScore: number;
          rationale: string;
          recommendation: string;
        }[];
      };
    };
    documents: {
      _id: string;
      fileName: string;
      extractionStatus: "pending" | "processing" | "ready" | "failed";
      extractionError?: string;
    }[];
    responses: {
      questionId: string;
      score: number;
    }[];
    stats: {
      totalQuestions: number;
      answeredQuestions: number;
      readyDocuments: number;
    };
  }
>("study:getSessionSnapshot");

const extractDocumentContentRef = makeFunctionReference<
  "action",
  { grantToken: string; sessionId: string; documentId: string },
  unknown
>("ai:extractDocumentContent");
const generateQuizRef = makeFunctionReference<
  "action",
  { grantToken: string; sessionId: string; questionCount?: number },
  unknown
>("ai:generateQuiz");
const evaluateAnswerRef = makeFunctionReference<
  "action",
  {
    grantToken: string;
    sessionId: string;
    questionId: string;
    userAnswer: string;
    timeSpentSeconds: number;
  },
  FeedbackState
>("ai:evaluateAnswer");
const analyzePerformanceRef = makeFunctionReference<"action", { grantToken: string; sessionId: string }, unknown>(
  "ai:analyzePerformance",
);
const generateTopicDeepDiveRef = makeFunctionReference<
  "action",
  { grantToken: string; sessionId: string; topic: string },
  unknown
>("ai:generateTopicDeepDive");

/** Keys for local storage of session data */
const STORAGE_KEYS = {
  grantToken: "smartnotes.grant-token",
  sessionId: "smartnotes.session-id",
} as const;

/** Allowed file types for upload */
const ACCEPTED_FILE_TYPES = ".pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.markdown,.csv,.json,.jpg,.jpeg,.png,.webp";

/**
 * Represents the AI feedback for a answered question.
 */
type FeedbackState = {
  /** Whether the answer was essentially correct */
  isCorrect: boolean;
  /** Score from 0 to 1 */
  score: number;
  /** Brief explanation from the AI */
  explanation: string;
  /** The answer considered ideal by the AI */
  idealAnswer: string;
};

/**
 * Helper function for consistent, user-friendly error messaging.
 * @param error - The encountered error.
 * @returns A human-readable error string in German.
 */
const formatError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("not recognized") || message.includes("nicht erkannt")) {
    return "Dieser Zugangscode ist ungültig. Bitte prüfe die Eingabe.";
  }
  if (message.includes("already consumed") || message.includes("bereits verwendet")) {
    return "Dieser Code wurde bereits benutzt.";
  }
  if (message.includes("invalid or expired") || message.includes("ungültig oder abgelaufen")) {
    return "Dein Link ist leider nicht mehr gültig.";
  }
  if (message.includes("No unused access codes") || message.includes("Keine freien Zugangscodes")) {
    return "Aktuell sind keine freien Zugänge verfügbar.";
  }
  return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.";
};

/**
 * Uploads a file directly to Convex storage.
 * @param uploadUrl - The upload URL generated by Convex.
 * @param file - The file to upload.
 * @returns A promise returning the storageId.
 */
const uploadFileToConvexStorage = (uploadUrl: string, file: File): Promise<{ storageId: string }> => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", uploadUrl, true);
    request.timeout = 130000;

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Upload fehlgeschlagen (${request.status}).`));
        return;
      }

      const responseText = request.responseText ?? "";
      try {
        const parsed = JSON.parse(responseText) as { storageId?: string };
        if (!parsed.storageId) {
          throw new Error("storageId fehlt");
        }
        resolve({ storageId: parsed.storageId });
      } catch {
        const match = responseText.match(/"storageId"\s*:\s*"([^"]+)"/);
        if (match?.[1]) {
          resolve({ storageId: match[1] });
          return;
        }
        reject(new Error("Upload-Antwort konnte nicht gelesen werden."));
      }
    };

    request.onerror = () => reject(new Error("Netzwerkfehler beim Hochladen."));
    request.ontimeout = () => reject(new Error("Zeitüberschreitung beim Hochladen."));
    request.onabort = () => reject(new Error("Upload abgebrochen."));
    request.send(file);
  });
};

/**
 * The main application component.
 */
function App() {
  // --- Layout State ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  /** Prevent body scroll when mobile menu is open */
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // --- Auth & Session State ---
  const [grantToken, setGrantToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.grantToken));
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.sessionId));

  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isConsumingMagicLink, setIsConsumingMagicLink] = useState(false);

  // --- Upload State ---
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isRemovingDocument, setIsRemovingDocument] = useState<string | null>(null);

  // --- Quiz State ---
  const [answerInput, setAnswerInput] = useState("");
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // --- Analysis State ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [topicLoading, setTopicLoading] = useState<string | null>(null);

  // --- Convex Hooks ---
  const redeemAccessCode = useMutation(redeemAccessCodeRef);
  const consumeMagicLink = useMutation(consumeMagicLinkRef);
  const startSession = useMutation(startSessionRef);
  const generateUploadUrl = useMutation(generateUploadUrlRef);
  const registerUploadedDocument = useMutation(registerUploadedDocumentRef);
  const removeDocument = useMutation(removeDocumentRef);

  const extractDocumentContent = useAction(extractDocumentContentRef);
  const generateQuiz = useAction(generateQuizRef);
  const evaluateAnswer = useAction(evaluateAnswerRef);
  const analyzePerformance = useAction(analyzePerformanceRef);
  const generateTopicDeepDive = useAction(generateTopicDeepDiveRef);

  // --- Queries ---
  const grantStatus = useQuery(validateGrantRef, grantToken ? { grantToken } : "skip");
  const latestSessionId = useQuery(latestSessionIdRef, grantToken && grantStatus?.valid ? { grantToken } : "skip");
  const snapshot = useQuery(
    sessionSnapshotRef,
    grantToken && grantStatus?.valid && sessionId && latestSessionId !== undefined && latestSessionId === sessionId
      ? { grantToken, sessionId }
      : "skip",
  );

  /**
   * Effect to check for a magic link token in the URL.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("magicToken");

    if (magicToken && !grantToken) {
      setIsConsumingMagicLink(true);
      void consumeMagicLink({ magicToken })
        .then(async (result) => {
          setGrantToken(result.grantToken);
          localStorage.setItem(STORAGE_KEYS.grantToken, result.grantToken);
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        })
        .catch((error: unknown) => {
          setAuthError(formatError(error));
        })
        .finally(() => {
          setIsConsumingMagicLink(false);
        });
    }
  }, [consumeMagicLink, grantToken]);

  /**
   * Validates the grant token.
   */
  useEffect(() => {
    if (!grantToken || !grantStatus || grantStatus.valid) {
      return;
    }
    setGrantToken(null);
    setSessionId(null);
    localStorage.removeItem(STORAGE_KEYS.grantToken);
    localStorage.removeItem(STORAGE_KEYS.sessionId);
  }, [grantStatus, grantToken]);

  /**
   * Automatically creates or restores a session.
   */
  useEffect(() => {
    if (!grantToken || !grantStatus?.valid || sessionId || latestSessionId === undefined || isCreatingSession) {
      return;
    }
    if (latestSessionId) {
      setSessionId(latestSessionId);
      localStorage.setItem(STORAGE_KEYS.sessionId, latestSessionId);
      return;
    }
    setIsCreatingSession(true);
    void startSession({ grantToken })
      .then((newSessionId) => {
        setSessionId(newSessionId);
        localStorage.setItem(STORAGE_KEYS.sessionId, newSessionId);
      })
      .catch((error: unknown) => setAuthError(formatError(error)))
      .finally(() => setIsCreatingSession(false));
  }, [grantToken, grantStatus, isCreatingSession, latestSessionId, sessionId, startSession]);

  /** Syncs local sessionId with the latest one from the backend */
  useEffect(() => {
    if (!grantToken || !grantStatus?.valid || latestSessionId === undefined) return;
    if (!latestSessionId) {
      if (sessionId) {
        setSessionId(null);
        localStorage.removeItem(STORAGE_KEYS.sessionId);
      }
      return;
    }
    if (sessionId !== latestSessionId) {
      setSessionId(latestSessionId);
      localStorage.setItem(STORAGE_KEYS.sessionId, latestSessionId);
    }
  }, [grantStatus, grantToken, latestSessionId, sessionId]);

  const session = snapshot?.session ?? null;
  const documents = snapshot?.documents ?? [];
  const responses = snapshot?.responses;
  const stats = snapshot?.stats;

  const responseByQuestionId = useMemo(() => {
    return new Map((responses ?? []).map((response) => [response.questionId, response]));
  }, [responses]);

  const currentQuestion = useMemo(() => {
    if (!session) return null;
    return session.quizQuestions.find((question) => !responseByQuestionId.has(question.id)) ?? null;
  }, [responseByQuestionId, session]);

  useEffect(() => {
    setAnswerInput("");
    setFeedback(null);
    setQuestionStartedAt(Date.now());
  }, [currentQuestion?.id]);

  const handleSignOut = () => {
    setIsSigningOut(true);
    setIsMobileMenuOpen(false);
    setTimeout(() => {
      setGrantToken(null);
      setSessionId(null);
      setAuthError(null);
      localStorage.removeItem(STORAGE_KEYS.grantToken);
      localStorage.removeItem(STORAGE_KEYS.sessionId);
      setIsSigningOut(false);
    }, 500);
  };

  const handleRedeemCode = async () => {
    if (!accessCodeInput.trim()) {
      setAuthError("Bitte gib deinen Einmal-Zugangscode ein.");
      return;
    }
    setIsRedeemingCode(true);
    setAuthError(null);
    try {
      const auth = await redeemAccessCode({ code: accessCodeInput });
      const newSessionId = await startSession({ grantToken: auth.grantToken });
      setGrantToken(auth.grantToken);
      setSessionId(newSessionId);
      localStorage.setItem(STORAGE_KEYS.grantToken, auth.grantToken);
      localStorage.setItem(STORAGE_KEYS.sessionId, newSessionId);
      setAccessCodeInput("");
    } catch (error: unknown) {
      setAuthError(formatError(error));
    } finally {
      setIsRedeemingCode(false);
    }
  };

  const handleStartFreshSession = async () => {
    if (!grantToken) return;
    setIsCreatingSession(true);
    setIsMobileMenuOpen(false);
    setAnalysisError(null);
    setUploadError(null);
    try {
      const newSessionId = await startSession({ grantToken });
      setSessionId(newSessionId);
      localStorage.setItem(STORAGE_KEYS.sessionId, newSessionId);
    } catch (error: unknown) {
      setAnalysisError(formatError(error));
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (!grantToken || !sessionId || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    const errors: string[] = [];
    for (const file of files) {
      try {
        const uploadUrl = await generateUploadUrl({ grantToken, sessionId });
        const uploadResult = await uploadFileToConvexStorage(uploadUrl, file);
        const documentId = await registerUploadedDocument({
          grantToken,
          sessionId,
          storageId: uploadResult.storageId,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSizeBytes: file.size,
        });
        await extractDocumentContent({ grantToken, sessionId, documentId });
      } catch (error: unknown) {
        errors.push(`${file.name}: ${formatError(error)}`);
      }
    }
    if (errors.length > 0) setUploadError(errors.join("\n"));
    setIsUploading(false);
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;
    void handleFileUpload(Array.from(fileList));
    event.target.value = "";
  };

  const handleGenerateQuiz = async () => {
    if (!grantToken || !sessionId) return;
    setIsGeneratingQuiz(true);
    setUploadError(null);
    try {
      await generateQuiz({ grantToken, sessionId, questionCount: 30 });
    } catch (error: unknown) {
      setUploadError(formatError(error));
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSubmitAnswer = async (dontKnowSubmission: boolean = false) => {
    if (!grantToken || !sessionId || !currentQuestion) return;
    if (!answerInput.trim() && !dontKnowSubmission) return;
    setIsSubmittingAnswer(true);
    try {
      const timeSpentSeconds = Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000));
      const result = await evaluateAnswer({
        grantToken,
        sessionId,
        questionId: currentQuestion.id,
        userAnswer: dontKnowSubmission ? "" : answerInput,
        timeSpentSeconds,
      });
      setFeedback(result);
    } catch (error: unknown) {
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleAnalyzeSession = async () => {
    if (!grantToken || !sessionId) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      await analyzePerformance({ grantToken, sessionId });
    } catch (error: unknown) {
      setAnalysisError(formatError(error));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeepDive = async (topic: string) => {
    if (!grantToken || !sessionId) return;
    setTopicLoading(topic);
    setAnalysisError(null);
    try {
      await generateTopicDeepDive({ grantToken, sessionId, topic });
    } catch (error: unknown) {
      setAnalysisError(formatError(error));
    } finally {
      setTopicLoading(null);
    }
  };

  // --- RENDERING: AUTH SCREEN ---
  if (!grantToken) {
    return (
      <div className="min-h-screen bg-cream px-6 py-10 text-ink md:px-10 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl">
          <div className="mb-10 flex items-center justify-center gap-3">
            <img src={logoImage} alt="Smartnotes" className="h-10 w-10 rounded-xl border border-cream-border" />
            <p className="text-lg font-black uppercase tracking-[0.16em] text-accent">Smartnotes</p>
          </div>

          <div className="rounded-[2rem] border border-cream-border bg-surface-white p-6 md:p-10 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Zugang</p>
            <h1 className="mb-3 text-2xl md:text-3xl font-bold tracking-tight">
              {isConsumingMagicLink ? "Link wird verifiziert..." : "Zugangscode eingeben"}
            </h1>
            <p className="mb-6 text-sm text-ink-secondary">
              Kein Konto erforderlich. Ein Einmal-Code gibt dir temporären Zugang.
            </p>

            {isConsumingMagicLink ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Loader2 size={48} className="animate-spin text-accent" />
                <p className="mt-4 text-sm font-medium text-ink-muted">Deine Anmeldung wird sicher vorbereitet...</p>
              </div>
            ) : (
              <>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Zugangscode</label>
                <input
                  value={accessCodeInput}
                  onChange={(event) => setAccessCodeInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handleRedeemCode()}
                  placeholder="SMARTNOTES-DEMO-2026"
                  className="mb-5 w-full rounded-2xl border border-cream-border bg-cream-light px-4 py-3 text-sm font-medium outline-none transition focus:border-accent"
                />

                {authError && (
                  <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{authError}</p>
                )}

                <button
                  type="button"
                  onClick={() => void handleRedeemCode()}
                  disabled={isRedeemingCode}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-cream transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {isRedeemingCode ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                  Weiter
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING: LOADING SCREEN ---
  if (!grantStatus || !grantStatus.valid || !sessionId || !session || !stats) {
    return (
      <div className="min-h-screen bg-cream px-6 py-10 text-ink flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-cream-border bg-surface-white p-5 shadow-sm">
          <Loader2 size={20} className="animate-spin text-accent" />
          <p className="text-sm font-medium text-ink-secondary">Arbeitsbereich wird vorbereitet...</p>
        </div>
      </div>
    );
  }

  const stage = session.stage;
  const readyDocuments = documents.filter((doc) => doc.extractionStatus === "ready");

  // --- RENDERING: MAIN APP ---
  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col md:flex-row h-screen overflow-hidden">
      
      {/* MOBILE HEADER */}
      <header className="flex md:hidden items-center justify-between bg-surface-white px-5 py-4 border-b border-cream-border z-50">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Logo" className="h-8 w-8 rounded-lg border border-cream-border" />
          <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Smartnotes</p>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-ink-muted hover:text-ink transition"
          aria-label="Menü öffnen"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* MOBILE MENU OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-cream/95 z-40 md:hidden animate-in fade-in slide-in-from-top duration-300">
          <div className="flex flex-col h-full pt-20 px-6 pb-10">
            <nav className="space-y-4 mb-8">
              <StageBadge label="1. Upload" active={stage === "upload"} done={stage !== "upload"} />
              <StageBadge label="2. Training" active={stage === "quiz"} done={stage === "analysis"} />
              <StageBadge label="3. Analyse" active={stage === "analysis"} done={false} />
            </nav>
            
            <div className="mt-auto space-y-3">
              <button
                onClick={() => void handleStartFreshSession()}
                disabled={isCreatingSession}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cream-border bg-surface-white px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink transition disabled:opacity-60"
              >
                {isCreatingSession ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                Neue Sitzung
              </button>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cream-border bg-surface-white px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted transition disabled:opacity-60"
              >
                {isSigningOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR (DESKTOP) */}
      <aside className="hidden md:flex flex-col w-[300px] border-r border-cream-border bg-surface-white p-6 flex-shrink-0">
        <div className="mb-8 flex items-center gap-3">
          <img src={logoImage} alt="Smartnotes" className="h-10 w-10 rounded-xl border border-cream-border" />
          <p className="text-base font-black uppercase tracking-[0.16em] text-accent">Smartnotes</p>
        </div>

        <nav className="space-y-3">
          <StageBadge label="1. Upload" active={stage === "upload"} done={stage !== "upload"} />
          <StageBadge label="2. Training" active={stage === "quiz"} done={stage === "analysis"} />
          <StageBadge label="3. Analyse Ergebnisse" active={stage === "analysis"} done={false} />
        </nav>

        <div className="mt-8 rounded-2xl border border-cream-border bg-cream-light p-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-accent">Aktuelle Sitzung</p>
          <p className="text-sm font-semibold text-ink truncate">{session.title}</p>
          <p className="mt-2 text-[10px] text-ink-muted uppercase font-bold tracking-wider">Runde {session.round}</p>
        </div>

        <div className="mt-auto pt-6 space-y-2">
          <button
            onClick={() => void handleStartFreshSession()}
            disabled={isCreatingSession}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cream-border bg-surface-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink transition hover:bg-cream-light disabled:opacity-60"
          >
            {isCreatingSession ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Neue Sitzung
          </button>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cream-border bg-surface-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted transition hover:text-ink disabled:opacity-60"
          >
            {isSigningOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Abmelden
          </button>
        </div>
      </aside>

      {/* CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-cream p-5 md:p-8 lg:p-12">
        <div className="mx-auto max-w-5xl h-full">
          
          {/* STEP 1: UPLOAD */}
          {stage === "upload" && (
            <section className="flex h-full flex-col items-center justify-center text-center">
              <label className="mb-6 flex w-full max-w-3xl cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-cream-border bg-cream-light px-6 py-12 md:py-24 text-center transition hover:border-accent/40">
                {isUploading ? <Loader2 size={48} className="animate-spin text-accent" /> : <Upload size={40} className="text-accent" />}
                <div>
                  <p className="text-xl md:text-2xl font-bold">{isUploading ? "Inhalte werden verarbeitet..." : "Dateien zum Hochladen auswählen"}</p>
                  <p className="text-base text-ink-muted">PDF, PPT/PPTX, DOC/DOCX, TXT, MD, CSV, JSON, JPG/JPEG, PNG, WEBP</p>
                </div>
                <input type="file" multiple accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={onFileInputChange} disabled={isUploading} />
              </label>

              {uploadError && (
                <p className="mb-4 max-w-3xl whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
                  {uploadError}
                </p>
              )}

              <div className="mb-8 w-full max-w-3xl space-y-2">
                {documents.length === 0 ? (
                  <p className="rounded-2xl border border-cream-border bg-cream-light px-6 py-4 text-sm text-ink-muted italic">
                    Noch keine Dateien hochgeladen.
                  </p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc._id} className="flex items-center justify-between rounded-xl border border-cream-border bg-surface-white p-4 text-left shadow-sm">
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-sm font-semibold text-ink">{doc.fileName}</p>
                        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-ink-muted">
                          {(doc.extractionStatus === "pending" || doc.extractionStatus === "processing") && <Loader2 size={10} className="animate-spin text-accent" />}
                          {renderExtractionStatus(doc.extractionStatus)}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!grantToken || !sessionId) return;
                          setIsRemovingDocument(doc._id);
                          try { await removeDocument({ grantToken, sessionId, documentId: doc._id }); } 
                          finally { setIsRemovingDocument(null); }
                        }}
                        disabled={isRemovingDocument === doc._id}
                        className="p-2 text-ink-muted hover:text-red-500 transition disabled:opacity-60"
                      >
                        {isRemovingDocument === doc._id ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {readyDocuments.length > 0 && (
                <button
                  onClick={() => void handleGenerateQuiz()}
                  disabled={isUploading || isGeneratingQuiz}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-bold text-cream transition hover:scale-105 active:scale-95 disabled:opacity-60 shadow-lg shadow-accent/20"
                >
                  {isUploading || isGeneratingQuiz ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                  {isGeneratingQuiz ? "KI erstellt Fragen..." : "Quizfragen generieren"}
                </button>
              )}
            </section>
          )}

          {/* STEP 2: QUIZ */}
          {stage === "quiz" && (
            <section className="flex h-full flex-col items-center justify-center">
              <div className="w-full max-w-3xl text-center">
                {!currentQuestion && stats.totalQuestions > 0 && !feedback ? (
                  <div className="rounded-[2.5rem] border border-cream-border bg-cream-light p-8 md:p-16 text-center animate-in zoom-in-95 duration-500">
                    <h2 className="mb-4 text-3xl md:text-5xl font-black tracking-tighter">Starke Leistung!</h2>
                    <p className="mb-10 text-lg md:text-xl text-ink-secondary">
                      Bereit für die Analyse? Wir nutzen deine Antworten, um deinen Lernstand zu schätzen.
                    </p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => void handleAnalyzeSession()}
                        disabled={isAnalyzing}
                        className="inline-flex items-center justify-center gap-3 rounded-full bg-accent px-10 py-5 text-lg font-bold text-cream transition hover:scale-105 active:scale-95 disabled:opacity-60"
                      >
                        {isAnalyzing ? <Loader2 size={24} className="animate-spin" /> : <Brain size={24} />}
                        {isAnalyzing ? "Analysiere..." : "Lernanalyse starten"}
                      </button>
                      <button
                        onClick={() => void handleGenerateQuiz()}
                        disabled={isGeneratingQuiz}
                        className="inline-flex items-center justify-center gap-3 rounded-full border-2 border-cream-border bg-surface-white px-10 py-5 text-lg font-bold text-ink-secondary transition hover:bg-cream-light disabled:opacity-60"
                      >
                        {isGeneratingQuiz ? <Loader2 size={24} className="animate-spin" /> : <RefreshCcw size={24} />}
                        Mehr Fragen (+30)
                      </button>
                    </div>
                  </div>
                ) : feedback ? (
                  <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 w-full">
                    <div className="mb-8 md:mb-12 flex flex-col items-center gap-4">
                      <div className={`flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full shadow-lg ${
                        feedback.isCorrect ? "bg-emerald-100 text-emerald-600" : feedback.score > 0 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
                      }`}>
                        {feedback.isCorrect ? <CheckCircle2 size={28} className="md:w-8 md:h-8" /> : feedback.score > 0 ? <Lightbulb size={28} className="md:w-8 md:h-8" /> : <XCircle size={28} className="md:w-8 md:h-8" />}
                      </div>
                      <p className={`text-[10px] md:text-sm font-black uppercase tracking-[0.3em] ${
                        feedback.isCorrect ? "text-emerald-600" : feedback.score > 0 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {feedback.isCorrect ? "Richtig" : feedback.score > 0 ? "Teilweise" : "Falsch"}
                      </p>
                    </div>
                    <div className="space-y-4 md:space-y-6">
                      <div className="rounded-[1.5rem] md:rounded-[2rem] border border-cream-border bg-surface-white p-5 md:p-10 shadow-sm text-left">
                        <p className="mb-3 md:mb-4 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-accent">Erklärung</p>
                        <p className="text-base md:text-xl leading-relaxed text-ink-secondary">{feedback.explanation}</p>
                      </div>
                      <div className="rounded-[1.5rem] md:rounded-[2rem] border border-cream-border bg-cream-light/50 p-5 md:p-10 text-left">
                        <p className="mb-3 md:mb-4 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-accent">Ideale Antwort</p>
                        <p className="text-base md:text-xl font-medium leading-relaxed text-ink">{feedback.idealAnswer}</p>
                      </div>
                      <div className="pt-6 md:pt-8 flex justify-center">
                        <button
                          onClick={() => { setFeedback(null); setAnswerInput(""); }}
                          className="inline-flex items-center gap-2 md:gap-3 rounded-full bg-accent px-8 py-4 md:px-12 md:py-5 text-base md:text-lg font-bold text-cream transition hover:scale-105 active:scale-95 shadow-xl shadow-accent/30"
                        >
                          Nächste Frage
                          <ArrowRight size={20} className="md:w-[22px] md:h-[22px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : currentQuestion ? (
                  <div className="animate-in fade-in duration-700 w-full">
                    <div className="mb-10 md:mb-24">
                      <h2 className="text-2xl md:text-5xl font-black leading-tight tracking-tighter text-ink text-center md:text-left">
                        {currentQuestion.prompt}
                      </h2>
                    </div>
                    <div className="mx-auto max-w-2xl w-full">
                      <textarea
                        value={answerInput}
                        onChange={(e) => {
                          setAnswerInput(e.target.value);
                          // Simple auto-resize logic
                          e.target.style.height = "auto";
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void handleSubmitAnswer())}
                        rows={1}
                        disabled={isSubmittingAnswer}
                        placeholder="Deine Antwort hier tippen..."
                        className="w-full border-b-2 border-cream-border bg-transparent pb-4 text-center text-xl md:text-3xl font-medium outline-none transition focus:border-accent placeholder:text-ink-muted/20 disabled:opacity-50 overflow-hidden"
                        style={{ resize: "none" }}
                      />
                      <div className="mt-8 md:mt-12 flex flex-col items-center gap-4 md:gap-6">
                        <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted/50">
                          {isSubmittingAnswer ? "KI bewertet..." : "Enter zum Bestätigen"}
                        </p>
                        <button
                          onClick={() => void handleSubmitAnswer(true)}
                          disabled={isSubmittingAnswer}
                          className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 md:px-8 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-[0.12em] text-cream transition hover:scale-[1.02] active:scale-95 disabled:opacity-60 shadow-lg shadow-accent/25"
                        >
                          {isSubmittingAnswer && <Loader2 size={14} className="animate-spin" />}
                          Ich weiß es gerade nicht
                        </button>

                        <button
                          onClick={() => void handleAnalyzeSession()}
                          disabled={isAnalyzing}
                          className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full border-2 border-red-100 bg-red-50 px-6 py-3.5 md:px-8 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-[0.12em] text-red-600 transition hover:bg-red-500 hover:text-cream hover:border-red-500 shadow-lg shadow-red-500/10 disabled:opacity-60"
                        >
                          {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                          {isAnalyzing ? "Analysiere..." : "Session beenden"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="animate-spin text-accent" />
                    <p className="text-sm font-bold uppercase tracking-widest text-ink-muted">Vorbereitung...</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* STEP 3: ANALYSIS */}
          {stage === "analysis" && (
            <section className="pb-10">
              <header className="mb-8 md:mb-12">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Abschluss</p>
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter">Lernanalyse</h1>
                <p className="mt-3 text-sm md:text-lg text-ink-secondary">
                  Hier sind deine Erkenntnisse. Vertiefe Lücken oder starte neu.
                </p>
              </header>

              {analysisError && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{analysisError}</p>}

              {!session.analysis ? (
                <div className="flex flex-col items-center py-12">
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={64} className="animate-spin text-accent" />
                      <p className="mt-6 text-xl font-bold text-ink-secondary">KI wertet Ergebnisse aus...</p>
                    </>
                  ) : (
                    <button
                      onClick={() => void handleAnalyzeSession()}
                      className="inline-flex items-center gap-3 rounded-full bg-accent px-10 py-5 text-lg font-bold text-cream transition hover:scale-105"
                    >
                      <Brain size={20} />
                      Analyse erstellen
                    </button>
                  )}
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-10 duration-700">
                  <div className="mb-8 grid gap-4 md:grid-cols-3">
                    <KpiCard label="Lernstand" value={`${session.analysis.overallReadiness}%`} />
                    <KpiCard label="Stärken" value={session.analysis.strongestTopics.join(", ") || "Noch offen"} />
                    <KpiCard label="Lücken" value={session.analysis.weakestTopics.join(", ") || "Keine"} />
                  </div>

                  <div className="mb-8 md:mb-10 rounded-[1.5rem] md:rounded-[2rem] border-2 border-accent/10 bg-surface-white p-5 md:p-10 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={60} className="md:w-20 md:h-20" /></div>
                    <p className="mb-3 md:mb-4 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Empfehlung</p>
                    <p className="text-base md:text-xl font-medium leading-relaxed text-ink-secondary">{session.analysis.recommendedNextStep}</p>
                  </div>

                  <div className="space-y-4">
                    {session.analysis.topics.map((topic) => (
                      <div key={topic.topic} className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-[1.5rem] md:rounded-[2rem] border border-cream-border bg-surface-white p-5 md:p-8 transition hover:border-accent/30 shadow-sm">
                        <div className="flex-1">
                          <h3 className="text-lg md:text-xl font-bold mb-1">{topic.topic}</h3>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="h-1.5 w-24 md:w-32 bg-cream-light rounded-full overflow-hidden">
                              <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${topic.comfortScore}%` }} />
                            </div>
                            <span className="text-[9px] md:text-[10px] font-black text-accent">{topic.comfortScore}% Comfort</span>
                          </div>
                          <p className="text-xs md:text-base text-ink-secondary leading-relaxed mb-4">{topic.rationale}</p>
                          <div className="inline-block rounded-lg bg-cream-light px-2.5 py-1 text-[9px] md:text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                            Tipp: {topic.recommendation}
                          </div>
                        </div>

                        <button
                          onClick={() => void handleDeepDive(topic.topic)}
                          disabled={topicLoading === topic.topic}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 md:px-6 md:py-3 text-[10px] md:text-xs font-bold uppercase tracking-[0.1em] text-cream transition hover:scale-105 active:scale-95 disabled:opacity-60 shadow-lg shadow-accent/20"
                        >
                          {topicLoading === topic.topic ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          {topicLoading === topic.topic ? "KI vertieft..." : "Vertiefung"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

/** Progress badge used in sidebars and menus */
function StageBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 ${
      active ? "bg-accent text-cream shadow-lg shadow-accent/30 translate-x-1" : 
      done ? "bg-emerald-50 text-emerald-700 opacity-60" : "bg-cream-light text-ink-muted"
    }`}>
      {done ? <CheckCircle2 size={16} /> : <CircleDashed size={16} className={active ? "animate-spin-slow" : ""} />}
      {label}
    </div>
  );
}

/** Simple KPI card for analysis overview */
function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] md:rounded-[2rem] border border-cream-border bg-surface-white p-5 md:p-8 shadow-sm transition hover:scale-[1.02] duration-300">
      <p className="mb-2 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{label}</p>
      <p className="text-lg md:text-2xl font-black tracking-tight text-ink">{value}</p>
    </div>
  );
}

/** Translation for extraction status codes */
function renderExtractionStatus(status: "pending" | "processing" | "ready" | "failed") {
  switch (status) {
    case "pending": return "Wartet...";
    case "processing": return "Wird analysiert...";
    case "ready": return "Bereit";
    case "failed": return "Fehler";
    default: return status;
  }
}

export default App;
