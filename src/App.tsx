/**
 * @file App.tsx
 * @description Main component of the Smartnotes application.
 * Manages the entire user flow: authentication via access code,
 * document upload, AI-powered quiz generation, and learning progress analysis.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Monitor,
  Moon,
  RefreshCcw,
  Sparkles,
  Sun,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import logoImage from "./assets/images/logo.png";

/**
 * Convex function references (Mutations, Queries, Actions).
 * These are required for type-safe calls to the backend.
 */
const redeemAccessCodeRef = makeFunctionReference<
  "mutation",
  { code: string },
  { grantToken: string }
>("access:redeemAccessCode");
const consumeMagicLinkRef = makeFunctionReference<
  "mutation",
  { magicToken: string },
  { grantToken: string; obfuscatedCodes: string[] }
>("access:consumeMagicLink");
const startSessionRef = makeFunctionReference<
  "mutation",
  { grantToken: string; title?: string },
  string
>("study:startSession");
const generateUploadUrlRef = makeFunctionReference<
  "mutation",
  { grantToken: string; sessionId: string },
  string
>("study:generateUploadUrl");
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
const latestSessionIdRef = makeFunctionReference<
  "query",
  { grantToken: string },
  string | null
>("study:getLatestSessionId");
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
  {
    grantToken: string;
    sessionId: string;
    documentId: string;
    clientRequestId?: string;
  },
  unknown
>("ai:extractDocumentContent");
const generateQuizRef = makeFunctionReference<
  "action",
  {
    grantToken: string;
    sessionId: string;
    questionCount?: number;
    clientRequestId?: string;
  },
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
    clientRequestId?: string;
  },
  FeedbackState
>("ai:evaluateAnswer");
const analyzePerformanceRef = makeFunctionReference<
  "action",
  { grantToken: string; sessionId: string; clientRequestId?: string },
  unknown
>("ai:analyzePerformance");
const generateTopicDeepDiveRef = makeFunctionReference<
  "action",
  {
    grantToken: string;
    sessionId: string;
    topic: string;
    clientRequestId?: string;
  },
  unknown
>("ai:generateTopicDeepDive");

/** Keys for local storage of session data */
const STORAGE_KEYS = {
  grantToken: "smartnotes.grant-token",
  sessionId: "smartnotes.session-id",
  theme: "smartnotes.theme",
} as const;

/** Theme preference options */
type ThemePreference = "light" | "dark" | "system";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "system", label: "System" },
  { value: "dark", label: "Dunkel" },
];

/** Allowed file types for upload */
const ACCEPTED_FILE_TYPES =
  ".pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.markdown,.csv,.json,.jpg,.jpeg,.png,.webp";

/**
 * Custom hook to manage theme preference (light / dark / system).
 * Applies the `.dark` class on `<html>` and persists the choice in localStorage.
 */
function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === "light" || stored === "dark" || stored === "system")
      return stored;
    return "system";
  });

  const applyTheme = useCallback((pref: ThemePreference) => {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldBeDark = pref === "dark" || (pref === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  useEffect(() => {
    applyTheme(preference);
    localStorage.setItem(STORAGE_KEYS.theme, preference);
  }, [preference, applyTheme]);

  // Listen for OS-level theme changes when "system" is selected
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference, applyTheme]);

  return { preference, setPreference } as const;
}

/** Compact segmented theme toggle: Hell | System | Dunkel */
function ThemeToggle({
  preference,
  setPreference,
}: {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}) {
  const icons: Record<ThemePreference, typeof Sun> = {
    light: Sun,
    system: Monitor,
    dark: Moon,
  };

  return (
    <div className="border-cream-border bg-cream-light inline-flex items-center gap-0.5 rounded-full border p-1">
      {THEME_OPTIONS.map((opt) => {
        const Icon = icons[opt.value];
        const isActive = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPreference(opt.value)}
            title={opt.label}
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

type FormatErrorOptions = {
  fallback?: string;
  clientRequestId?: string;
};

const ERROR_ID_PATTERN = /\[Fehler-ID:\s*([A-Z0-9-]+)\]/i;
const REQUEST_ID_PATTERN = /\[Request ID:\s*([^\]]+)\]/i;
const CLIENT_ERROR_ID_PREFIX = "SNCLIENT";
const CLIENT_REQUEST_ID_PREFIX = "SNREQ";

type ErrorReferences = {
  errorId: string | null;
  requestId: string | null;
  clientRequestId: string | null;
  clientErrorId: string | null;
};

const extractErrorId = (message: string) => {
  const match = message.match(ERROR_ID_PATTERN);
  return match?.[1] ?? null;
};

const extractRequestId = (message: string) => {
  const match = message.match(REQUEST_ID_PATTERN);
  return match?.[1]?.trim() ?? null;
};

const stripTrackingMetadata = (message: string) =>
  message.replace(ERROR_ID_PATTERN, "").replace(REQUEST_ID_PATTERN, "").trim();

const createClientErrorId = () => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${CLIENT_ERROR_ID_PREFIX}-${timestampPart}-${randomPart}`;
};

const createClientRequestId = (scope: string) => {
  const scopeToken = scope
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${CLIENT_REQUEST_ID_PREFIX}-${scopeToken || "REQ"}-${timestampPart}-${randomPart}`;
};

const isTransportError = (normalizedMessage: string) => {
  return (
    normalizedMessage.includes("connection lost while action was in flight") ||
    normalizedMessage.includes("network error") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("netzwerkfehler")
  );
};

const withErrorReferences = (message: string, references: ErrorReferences) => {
  const suffixParts: string[] = [];
  if (references.errorId) {
    suffixParts.push(`Fehler-ID: ${references.errorId}`);
  }
  if (references.requestId) {
    suffixParts.push(`Anfrage-ID: ${references.requestId}`);
  }
  if (references.clientRequestId) {
    suffixParts.push(`Vorgangs-ID: ${references.clientRequestId}`);
  }
  if (references.clientErrorId) {
    suffixParts.push(`Client-Fehler-ID: ${references.clientErrorId}`);
  }

  if (suffixParts.length === 0) {
    return message;
  }

  return `${message} (${suffixParts.join(", ")})`;
};

const extractReadableErrorMessage = (error: unknown) => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error ?? "");

  if (!rawMessage.trim()) {
    return "";
  }

  const uncaughtMatch = rawMessage.match(/Uncaught Error:\s*([\s\S]+)/i);
  let cleanedMessage = uncaughtMatch?.[1]?.trim() ?? rawMessage.trim();

  cleanedMessage = cleanedMessage
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/^Server Error\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();

  if (cleanedMessage.includes("\n")) {
    cleanedMessage =
      cleanedMessage
        .split("\n")
        .find((line) => line.trim().length > 0)
        ?.trim() ?? cleanedMessage;
  }

  return cleanedMessage;
};

/**
 * Helper function for consistent, user-friendly error messaging.
 * @param error - The encountered error.
 * @param options - Optional fallback message if no specific mapping applies.
 * @returns A human-readable error string in German.
 */
const formatError = (error: unknown, options?: FormatErrorOptions) => {
  const message = extractReadableErrorMessage(error);
  const errorId = extractErrorId(message);
  const requestId = extractRequestId(message);
  const clientRequestId = options?.clientRequestId ?? null;
  const cleanMessage = stripTrackingMetadata(message);
  const normalizedMessage = cleanMessage.toLowerCase();
  const clientErrorId =
    !errorId &&
    !requestId &&
    !clientRequestId &&
    isTransportError(normalizedMessage)
      ? createClientErrorId()
      : null;
  const references: ErrorReferences = {
    errorId,
    requestId,
    clientRequestId,
    clientErrorId,
  };

  if (clientErrorId) {
    console.error("[Client-Fehler-Tracking]", {
      clientErrorId,
      message: cleanMessage,
      rawError: error,
    });
  }

  if (
    !cleanMessage ||
    normalizedMessage === "undefined" ||
    normalizedMessage === "null"
  ) {
    return withErrorReferences(
      options?.fallback ??
        "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.",
      references,
    );
  }

  if (isTransportError(normalizedMessage)) {
    return withErrorReferences(
      "Netzwerkfehler. Bitte prüfe deine Internetverbindung und versuche es erneut.",
      references,
    );
  }

  if (
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("zeitüberschreitung")
  ) {
    return withErrorReferences(
      "Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.",
      references,
    );
  }

  if (
    normalizedMessage.includes("aborted") ||
    normalizedMessage.includes("abgebrochen")
  ) {
    return withErrorReferences(
      "Die Anfrage wurde abgebrochen. Bitte starte den Vorgang erneut.",
      references,
    );
  }

  if (
    normalizedMessage.includes("not recognized") ||
    normalizedMessage.includes("nicht erkannt")
  ) {
    return withErrorReferences(
      "Dieser Zugangscode ist ungültig. Bitte prüfe die Eingabe.",
      references,
    );
  }
  if (
    normalizedMessage.includes("already consumed") ||
    normalizedMessage.includes("bereits verwendet")
  ) {
    return withErrorReferences(
      "Dieser Code wurde bereits benutzt.",
      references,
    );
  }
  if (
    normalizedMessage.includes("invalid or expired") ||
    normalizedMessage.includes("ungültig oder abgelaufen")
  ) {
    return withErrorReferences(
      "Dein Link ist leider nicht mehr gültig.",
      references,
    );
  }
  if (
    normalizedMessage.includes("no unused access codes") ||
    normalizedMessage.includes("keine freien zugangscodes")
  ) {
    return withErrorReferences(
      "Aktuell sind keine freien Zugänge verfügbar.",
      references,
    );
  }

  const technicalErrorPattern =
    /\b(TypeError|ReferenceError|SyntaxError|RangeError|stack|cannot read)\b/i;
  if (!technicalErrorPattern.test(cleanMessage)) {
    return withErrorReferences(cleanMessage, references);
  }

  return withErrorReferences(
    options?.fallback ??
      "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.",
    references,
  );
};

/**
 * Uploads a file directly to Convex storage.
 * @param uploadUrl - The upload URL generated by Convex.
 * @param file - The file to upload.
 * @returns A promise returning the storageId.
 */
const uploadFileToConvexStorage = (
  uploadUrl: string,
  file: File,
): Promise<{ storageId: string }> => {
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
    request.ontimeout = () =>
      reject(new Error("Zeitüberschreitung beim Hochladen."));
    request.onabort = () => reject(new Error("Upload abgebrochen."));
    request.send(file);
  });
};

/**
 * The main application component.
 */
function App() {
  // --- Theme ---
  const { preference: themePreference, setPreference: setThemePreference } =
    useTheme();

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
  const [grantToken, setGrantToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.grantToken),
  );
  const [sessionId, setSessionId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.sessionId),
  );

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
  const [isRemovingDocument, setIsRemovingDocument] = useState<string | null>(
    null,
  );

  // --- Quiz State ---
  const [answerInput, setAnswerInput] = useState("");
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
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
  const grantStatus = useQuery(
    validateGrantRef,
    grantToken ? { grantToken } : "skip",
  );
  const latestSessionId = useQuery(
    latestSessionIdRef,
    grantToken && grantStatus?.valid ? { grantToken } : "skip",
  );
  const snapshot = useQuery(
    sessionSnapshotRef,
    grantToken &&
      grantStatus?.valid &&
      sessionId &&
      latestSessionId !== undefined &&
      latestSessionId === sessionId
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
          setAuthError(
            formatError(error, {
              fallback:
                "Die Anmeldung über den Link ist fehlgeschlagen. Bitte fordere einen neuen Link an.",
            }),
          );
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
    if (
      !grantToken ||
      !grantStatus?.valid ||
      sessionId ||
      latestSessionId === undefined ||
      isCreatingSession
    ) {
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
      .catch((error: unknown) =>
        setAuthError(
          formatError(error, {
            fallback:
              "Deine Sitzung konnte nicht gestartet werden. Bitte versuche es erneut.",
          }),
        ),
      )
      .finally(() => setIsCreatingSession(false));
  }, [
    grantToken,
    grantStatus,
    isCreatingSession,
    latestSessionId,
    sessionId,
    startSession,
  ]);

  /** Syncs local sessionId with the latest one from the backend */
  useEffect(() => {
    if (!grantToken || !grantStatus?.valid || latestSessionId === undefined)
      return;
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
    return new Map(
      (responses ?? []).map((response) => [response.questionId, response]),
    );
  }, [responses]);

  const currentQuestion = useMemo(() => {
    if (!session) return null;
    return (
      session.quizQuestions.find(
        (question) => !responseByQuestionId.has(question.id),
      ) ?? null
    );
  }, [responseByQuestionId, session]);

  useEffect(() => {
    setAnswerInput("");
    setFeedback(null);
    setQuizError(null);
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
      setAuthError(
        formatError(error, {
          fallback:
            "Die Anmeldung ist fehlgeschlagen. Bitte prüfe den Zugangscode und versuche es erneut.",
        }),
      );
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
      setAnalysisError(
        formatError(error, {
          fallback:
            "Die neue Sitzung konnte nicht gestartet werden. Bitte versuche es erneut.",
        }),
      );
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
      const clientRequestId = createClientRequestId("extractDocument");
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
        await extractDocumentContent({
          grantToken,
          sessionId,
          documentId,
          clientRequestId,
        });
      } catch (error: unknown) {
        errors.push(
          `${file.name}: ${formatError(error, {
            fallback: "Datei konnte nicht hochgeladen oder verarbeitet werden.",
            clientRequestId,
          })}`,
        );
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
    const clientRequestId = createClientRequestId("generateQuiz");
    setIsGeneratingQuiz(true);
    setUploadError(null);
    try {
      await generateQuiz({
        grantToken,
        sessionId,
        questionCount: 30,
        clientRequestId,
      });
    } catch (error: unknown) {
      setUploadError(
        formatError(error, {
          fallback: "Quizfragen konnten nicht erstellt werden.",
          clientRequestId,
        }),
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSubmitAnswer = async (dontKnowSubmission: boolean = false) => {
    if (!grantToken || !sessionId || !currentQuestion) return;
    if (!answerInput.trim() && !dontKnowSubmission) return;
    const clientRequestId = createClientRequestId("evaluateAnswer");
    setIsSubmittingAnswer(true);
    setQuizError(null);
    try {
      const timeSpentSeconds = Math.max(
        1,
        Math.round((Date.now() - questionStartedAt) / 1000),
      );
      const result = await evaluateAnswer({
        grantToken,
        sessionId,
        questionId: currentQuestion.id,
        userAnswer: dontKnowSubmission ? "" : answerInput,
        timeSpentSeconds,
        clientRequestId,
      });
      setFeedback(result);
    } catch (error: unknown) {
      setQuizError(
        formatError(error, {
          fallback:
            "Deine Antwort konnte nicht bewertet werden. Bitte versuche es erneut.",
          clientRequestId,
        }),
      );
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleAnalyzeSession = async () => {
    if (!grantToken || !sessionId) return;
    const clientRequestId = createClientRequestId("analyzePerformance");
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      await analyzePerformance({ grantToken, sessionId, clientRequestId });
    } catch (error: unknown) {
      setAnalysisError(
        formatError(error, {
          fallback:
            "Die Lernanalyse konnte nicht erstellt werden. Bitte versuche es erneut.",
          clientRequestId,
        }),
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeepDive = async (topic: string) => {
    if (!grantToken || !sessionId) return;
    const clientRequestId = createClientRequestId("generateDeepDive");
    setTopicLoading(topic);
    setAnalysisError(null);
    try {
      await generateTopicDeepDive({
        grantToken,
        sessionId,
        topic,
        clientRequestId,
      });
    } catch (error: unknown) {
      setAnalysisError(
        formatError(error, {
          fallback: "Die Vertiefung konnte nicht geladen werden.",
          clientRequestId,
        }),
      );
    } finally {
      setTopicLoading(null);
    }
  };

  // --- RENDERING: AUTH SCREEN ---
  if (!grantToken) {
    return (
      <div className="bg-cream text-ink flex min-h-screen flex-col items-center justify-center px-6 py-10 md:px-10">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle
            preference={themePreference}
            setPreference={setThemePreference}
          />
        </div>
        <div className="w-full max-w-xl">
          <div className="mb-10 flex items-center justify-center gap-3">
            <img
              src={logoImage}
              alt="Smartnotes"
              className="border-cream-border h-10 w-10 rounded-xl border"
            />
            <p className="text-accent text-lg font-black tracking-[0.16em] uppercase">
              Smartnotes
            </p>
          </div>

          <div className="border-cream-border bg-surface-white rounded-[2rem] border p-6 shadow-sm md:p-10">
            <p className="text-accent mb-2 text-xs font-bold tracking-[0.18em] uppercase">
              Zugang
            </p>
            <h1 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">
              {isConsumingMagicLink
                ? "Link wird verifiziert..."
                : "Zugangscode eingeben"}
            </h1>
            <p className="text-ink-secondary mb-6 text-sm">
              Kein Konto erforderlich. Ein Einmal-Code gibt dir temporären
              Zugang.
            </p>

            {isConsumingMagicLink ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Loader2 size={48} className="text-accent animate-spin" />
                <p className="text-ink-muted mt-4 text-sm font-medium">
                  Deine Anmeldung wird sicher vorbereitet...
                </p>
              </div>
            ) : (
              <>
                <label className="text-ink-muted mb-2 block text-xs font-bold tracking-[0.14em] uppercase">
                  Zugangscode
                </label>
                <input
                  value={accessCodeInput}
                  onChange={(event) => setAccessCodeInput(event.target.value)}
                  onKeyDown={(event) =>
                    event.key === "Enter" && void handleRedeemCode()
                  }
                  placeholder="SMARTNOTES-DEMO-2026"
                  className="border-cream-border bg-cream-light focus:border-accent mb-5 w-full rounded-2xl border px-4 py-3 text-sm font-medium transition outline-none"
                />

                {authError && (
                  <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                    {authError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleRedeemCode()}
                  disabled={isRedeemingCode}
                  className="bg-accent inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {isRedeemingCode ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowRight size={18} />
                  )}
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

  const stage = session.stage;
  const readyDocuments = documents.filter(
    (doc) => doc.extractionStatus === "ready",
  );

  // --- RENDERING: MAIN APP ---
  return (
    <div className="bg-cream text-ink flex h-screen min-h-screen flex-col overflow-hidden md:flex-row">
      {/* MOBILE HEADER */}
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
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-ink-muted hover:text-ink p-2 transition"
          aria-label="Menü öffnen"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* MOBILE MENU OVERLAY */}
      {isMobileMenuOpen && (
        <div className="bg-cream/95 animate-in fade-in slide-in-from-top fixed inset-0 z-40 duration-300 md:hidden">
          <div className="flex h-full flex-col px-6 pt-20 pb-10">
            <nav className="mb-8 space-y-4">
              <StageBadge
                label="1. Upload"
                active={stage === "upload"}
                done={stage !== "upload"}
              />
              <StageBadge
                label="2. Training"
                active={stage === "quiz"}
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
                  preference={themePreference}
                  setPreference={setThemePreference}
                />
              </div>
              <button
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

      {/* SIDEBAR (DESKTOP) */}
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
            label="1. Upload"
            active={stage === "upload"}
            done={stage !== "upload"}
          />
          <StageBadge
            label="2. Training"
            active={stage === "quiz"}
            done={stage === "analysis"}
          />
          <StageBadge
            label="3. Analyse Ergebnisse"
            active={stage === "analysis"}
            done={false}
          />
        </nav>

        <div className="mt-auto space-y-2 pt-6">
          <div className="flex justify-center pb-2">
            <ThemeToggle
              preference={themePreference}
              setPreference={setThemePreference}
            />
          </div>
          <button
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

      {/* CONTENT AREA */}
      <main className="bg-cream flex-1 overflow-y-auto p-5 md:p-8 lg:p-12">
        <div className="mx-auto h-full max-w-5xl">
          {/* STEP 1: UPLOAD */}
          {stage === "upload" && (
            <section className="flex h-full flex-col items-center justify-center text-center">
              <label className="border-cream-border bg-cream-light hover:border-accent/40 mb-6 flex w-full max-w-3xl cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition md:py-24">
                {isUploading ? (
                  <Loader2 size={48} className="text-accent animate-spin" />
                ) : (
                  <Upload size={40} className="text-accent" />
                )}
                <div>
                  <p className="text-xl font-bold md:text-2xl">
                    {isUploading
                      ? "Inhalte werden verarbeitet..."
                      : "Dateien zum Hochladen auswählen"}
                  </p>
                  <p className="text-ink-muted text-base">
                    PDF, PPT/PPTX, DOC/DOCX, TXT, MD, CSV, JSON, JPG/JPEG, PNG,
                    WEBP
                  </p>
                </div>
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_TYPES}
                  className="hidden"
                  onChange={onFileInputChange}
                  disabled={isUploading}
                />
              </label>

              {uploadError && (
                <p className="mb-4 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm whitespace-pre-line text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {uploadError}
                </p>
              )}

              <div className="mb-8 w-full max-w-3xl space-y-2">
                {documents.length === 0 ? (
                  <p className="border-cream-border bg-cream-light text-ink-muted rounded-2xl border px-6 py-4 text-sm italic">
                    Noch keine Dateien hochgeladen.
                  </p>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc._id}
                      className="border-cream-border bg-surface-white flex items-center justify-between rounded-xl border p-4 text-left shadow-sm"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-ink truncate text-sm font-semibold">
                          {doc.fileName}
                        </p>
                        <p className="text-ink-muted flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
                          {(doc.extractionStatus === "pending" ||
                            doc.extractionStatus === "processing") && (
                            <Loader2
                              size={10}
                              className="text-accent animate-spin"
                            />
                          )}
                          {renderExtractionStatus(doc.extractionStatus)}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!grantToken || !sessionId) return;
                          setIsRemovingDocument(doc._id);
                          try {
                            await removeDocument({
                              grantToken,
                              sessionId,
                              documentId: doc._id,
                            });
                          } catch (error: unknown) {
                            setUploadError(
                              formatError(error, {
                                fallback:
                                  "Die Datei konnte nicht entfernt werden.",
                              }),
                            );
                          } finally {
                            setIsRemovingDocument(null);
                          }
                        }}
                        disabled={isRemovingDocument === doc._id}
                        className="text-ink-muted p-2 transition hover:text-red-500 disabled:opacity-60"
                      >
                        {isRemovingDocument === doc._id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <XCircle size={18} />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {readyDocuments.length > 0 && (
                <button
                  onClick={() => void handleGenerateQuiz()}
                  disabled={isUploading || isGeneratingQuiz}
                  className="bg-accent shadow-accent/20 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  {isUploading || isGeneratingQuiz ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Sparkles size={20} />
                  )}
                  {isGeneratingQuiz
                    ? "KI erstellt Fragen..."
                    : "Quizfragen generieren"}
                </button>
              )}
            </section>
          )}

          {/* STEP 2: QUIZ */}
          {stage === "quiz" && (
            <section className="flex h-full flex-col items-center justify-center">
              <div className="w-full max-w-3xl text-center">
                {!currentQuestion && stats.totalQuestions > 0 && !feedback ? (
                  <div className="border-cream-border bg-cream-light animate-in zoom-in-95 rounded-[2.5rem] border p-8 text-center duration-500 md:p-16">
                    <h2 className="mb-4 text-3xl font-black tracking-tighter md:text-5xl">
                      Starke Leistung!
                    </h2>
                    <p className="text-ink-secondary mb-10 text-lg md:text-xl">
                      Bereit für die Analyse? Wir nutzen deine Antworten, um
                      deinen Lernstand zu schätzen.
                    </p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => void handleAnalyzeSession()}
                        disabled={isAnalyzing}
                        className="bg-accent inline-flex items-center justify-center gap-3 rounded-full px-10 py-5 text-lg font-bold text-white transition hover:scale-105 active:scale-95 disabled:opacity-60"
                      >
                        {isAnalyzing ? (
                          <Loader2 size={24} className="animate-spin" />
                        ) : (
                          <Brain size={24} />
                        )}
                        {isAnalyzing ? "Analysiere..." : "Lernanalyse starten"}
                      </button>
                      <button
                        onClick={() => void handleGenerateQuiz()}
                        disabled={isGeneratingQuiz}
                        className="border-cream-border bg-surface-white text-ink-secondary hover:bg-cream-light inline-flex items-center justify-center gap-3 rounded-full border-2 px-10 py-5 text-lg font-bold transition disabled:opacity-60"
                      >
                        {isGeneratingQuiz ? (
                          <Loader2 size={24} className="animate-spin" />
                        ) : (
                          <RefreshCcw size={24} />
                        )}
                        Mehr Fragen (+30)
                      </button>
                    </div>
                  </div>
                ) : feedback ? (
                  <div className="animate-in fade-in slide-in-from-bottom-8 w-full duration-500">
                    <div className="mb-8 flex flex-col items-center gap-4 md:mb-12">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg md:h-16 md:w-16 ${
                          feedback.isCorrect
                            ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400"
                            : feedback.score > 0
                              ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                              : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                        }`}
                      >
                        {feedback.isCorrect ? (
                          <CheckCircle2 size={28} className="md:h-8 md:w-8" />
                        ) : feedback.score > 0 ? (
                          <Lightbulb size={28} className="md:h-8 md:w-8" />
                        ) : (
                          <XCircle size={28} className="md:h-8 md:w-8" />
                        )}
                      </div>
                      <p
                        className={`text-[10px] font-black tracking-[0.3em] uppercase md:text-sm ${
                          feedback.isCorrect
                            ? "text-emerald-600 dark:text-emerald-400"
                            : feedback.score > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {feedback.isCorrect
                          ? "Richtig"
                          : feedback.score > 0
                            ? "Teilweise"
                            : "Falsch"}
                      </p>
                    </div>
                    <div className="space-y-4 md:space-y-6">
                      <div className="border-cream-border bg-surface-white rounded-[1.5rem] border p-5 text-left shadow-sm md:rounded-[2rem] md:p-10">
                        <p className="text-accent mb-3 text-[9px] font-bold tracking-[0.3em] uppercase md:mb-4 md:text-[10px]">
                          Erklärung
                        </p>
                        <p className="text-ink-secondary text-base leading-relaxed md:text-xl">
                          {feedback.explanation}
                        </p>
                      </div>
                      <div className="border-cream-border bg-cream-light/50 rounded-[1.5rem] border p-5 text-left md:rounded-[2rem] md:p-10">
                        <p className="text-accent mb-3 text-[9px] font-bold tracking-[0.3em] uppercase md:mb-4 md:text-[10px]">
                          Ideale Antwort
                        </p>
                        <p className="text-ink text-base leading-relaxed font-medium md:text-xl">
                          {feedback.idealAnswer}
                        </p>
                      </div>
                      <div className="flex justify-center pt-6 md:pt-8">
                        <button
                          onClick={() => {
                            setFeedback(null);
                            setAnswerInput("");
                          }}
                          className="bg-accent shadow-accent/30 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-xl transition hover:scale-105 active:scale-95 md:gap-3 md:px-12 md:py-5 md:text-lg"
                        >
                          Nächste Frage
                          <ArrowRight
                            size={20}
                            className="md:h-[22px] md:w-[22px]"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : currentQuestion ? (
                  <div className="animate-in fade-in w-full duration-700">
                    <div className="mb-10 md:mb-24">
                      <h2 className="text-ink text-center text-2xl leading-tight font-black tracking-tighter md:text-left md:text-5xl">
                        {currentQuestion.prompt}
                      </h2>
                    </div>
                    <div className="mx-auto w-full max-w-2xl">
                      <textarea
                        value={answerInput}
                        onChange={(e) => {
                          setAnswerInput(e.target.value);
                          // Simple auto-resize logic
                          e.target.style.height = "auto";
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          (e.preventDefault(), void handleSubmitAnswer())
                        }
                        rows={1}
                        disabled={isSubmittingAnswer}
                        placeholder="Deine Antwort hier tippen..."
                        className="border-cream-border focus:border-accent placeholder:text-ink-muted/20 w-full overflow-hidden border-b-2 bg-transparent pb-4 text-center text-xl font-medium transition outline-none disabled:opacity-50 md:text-3xl"
                        style={{ resize: "none" }}
                      />

                      {quizError && (
                        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                          {quizError}
                        </p>
                      )}

                      <div className="mt-8 flex flex-col items-center gap-4 md:mt-12 md:gap-6">
                        <p className="text-ink-muted/50 text-[9px] font-bold tracking-[0.2em] uppercase md:text-[10px]">
                          {isSubmittingAnswer
                            ? "KI bewertet..."
                            : "Enter zum Bestätigen"}
                        </p>
                        <button
                          onClick={() => void handleSubmitAnswer(true)}
                          disabled={isSubmittingAnswer}
                          className="bg-accent shadow-accent/25 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[10px] font-bold tracking-[0.12em] text-white uppercase shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-60 md:px-8 md:py-4 md:text-xs"
                        >
                          {isSubmittingAnswer && (
                            <Loader2 size={14} className="animate-spin" />
                          )}
                          Ich weiß es gerade nicht
                        </button>

                        <button
                          onClick={() => void handleAnalyzeSession()}
                          disabled={isAnalyzing}
                          className="hover:text-cream inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-red-50 px-6 py-3.5 text-[10px] font-bold tracking-[0.12em] text-red-600 uppercase shadow-lg shadow-red-500/10 transition hover:bg-red-500 disabled:opacity-60 md:px-8 md:py-4 md:text-xs  dark:bg-red-800/30 dark:text-red-300 dark:hover:bg-red-500"
                        >
                          {isAnalyzing ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <LogOut size={14} />
                          )}
                          {isAnalyzing ? "Analysiere..." : "Session beenden"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="text-accent animate-spin" />
                    <p className="text-ink-muted text-sm font-bold tracking-widest uppercase">
                      Vorbereitung...
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* STEP 3: ANALYSIS */}
          {stage === "analysis" && (
            <section className="pb-10">
              <header className="mb-8 md:mb-12">
                <p className="text-accent mb-2 text-[10px] font-bold tracking-[0.2em] uppercase">
                  Abschluss
                </p>
                <h1 className="text-3xl font-black tracking-tighter md:text-5xl">
                  Lernanalyse
                </h1>
                <p className="text-ink-secondary mt-3 text-sm md:text-lg">
                  Hier sind deine Erkenntnisse. Vertiefe Lücken oder starte neu.
                </p>
              </header>

              {analysisError && (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {analysisError}
                </p>
              )}

              {!session.analysis ? (
                <div className="flex flex-col items-center py-12">
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={64} className="text-accent animate-spin" />
                      <p className="text-ink-secondary mt-6 text-xl font-bold">
                        KI wertet Ergebnisse aus...
                      </p>
                    </>
                  ) : (
                    <button
                      onClick={() => void handleAnalyzeSession()}
                      className="bg-accent inline-flex items-center gap-3 rounded-full px-10 py-5 text-lg font-bold text-white transition hover:scale-105"
                    >
                      <Brain size={20} />
                      Analyse erstellen
                    </button>
                  )}
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-10 duration-700">
                  <div className="mb-8 grid gap-4 md:grid-cols-3">
                    <KpiCard
                      label="Lernstand"
                      value={`${session.analysis.overallReadiness}%`}
                    />
                    <KpiCard
                      label="Stärken"
                      value={
                        session.analysis.strongestTopics.join(", ") ||
                        "Noch offen"
                      }
                    />
                    <KpiCard
                      label="Lücken"
                      value={
                        session.analysis.weakestTopics.join(", ") || "Keine"
                      }
                    />
                  </div>

                  <div className="border-accent/10 bg-surface-white relative mb-8 overflow-hidden rounded-[1.5rem] border-2 p-5 shadow-sm md:mb-10 md:rounded-[2rem] md:p-10">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Sparkles size={60} className="md:h-20 md:w-20" />
                    </div>
                    <p className="text-accent mb-3 text-[9px] font-bold tracking-[0.2em] uppercase md:mb-4 md:text-[10px]">
                      Empfehlung
                    </p>
                    <p className="text-ink-secondary text-base leading-relaxed font-medium md:text-xl">
                      {session.analysis.recommendedNextStep}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {session.analysis.topics.map((topic) => (
                      <div
                        key={topic.topic}
                        className="border-cream-border bg-surface-white hover:border-accent/30 flex flex-col justify-between gap-6 rounded-[1.5rem] border p-5 shadow-sm transition md:flex-row md:items-center md:rounded-[2rem] md:p-8"
                      >
                        <div className="flex-1">
                          <h3 className="mb-1 text-lg font-bold md:text-xl">
                            {topic.topic}
                          </h3>
                          <div className="mb-4 flex items-center gap-2">
                            <div className="bg-cream-light h-1.5 w-24 overflow-hidden rounded-full md:w-32">
                              <div
                                className="bg-accent h-full transition-all duration-1000"
                                style={{ width: `${topic.comfortScore}%` }}
                              />
                            </div>
                            <span className="text-accent text-[9px] font-black md:text-[10px]">
                              {topic.comfortScore}% Comfort
                            </span>
                          </div>
                          <p className="text-ink-secondary mb-4 text-xs leading-relaxed md:text-base">
                            {topic.rationale}
                          </p>
                          <div className="bg-cream-light text-ink-muted inline-block rounded-lg px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase md:text-[10px]">
                            Tipp: {topic.recommendation}
                          </div>
                        </div>

                        <button
                          onClick={() => void handleDeepDive(topic.topic)}
                          disabled={topicLoading === topic.topic}
                          className="bg-accent shadow-accent/20 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] font-bold tracking-[0.1em] text-white uppercase shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-60 md:px-6 md:py-3 md:text-xs"
                        >
                          {topicLoading === topic.topic ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                          {topicLoading === topic.topic
                            ? "KI vertieft..."
                            : "Vertiefung"}
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
function StageBadge({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
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

/** Simple KPI card for analysis overview */
function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-cream-border bg-surface-white rounded-[1.5rem] border p-5 shadow-sm transition duration-300 hover:scale-[1.02] md:rounded-[2rem] md:p-8">
      <p className="text-accent mb-2 text-[9px] font-bold tracking-[0.2em] uppercase md:text-[10px]">
        {label}
      </p>
      <p className="text-ink text-lg font-black tracking-tight md:text-2xl">
        {value}
      </p>
    </div>
  );
}

/** Translation for extraction status codes */
function renderExtractionStatus(
  status: "pending" | "processing" | "ready" | "failed",
) {
  switch (status) {
    case "pending":
      return "Wartet...";
    case "processing":
      return "Wird analysiert...";
    case "ready":
      return "Bereit";
    case "failed":
      return "Fehler";
    default:
      return status;
  }
}

export default App;
