import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  ArrowRight,
  BadgeHelp,
  Brain,
  CheckCircle2,
  CircleDashed,
  Lightbulb,
  Loader2,
  LogOut,
  RefreshCcw,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";
import logoImage from "./assets/images/logo.png";

const redeemAccessCodeRef = makeFunctionReference<"mutation", { code: string }, { grantToken: string }>(
  "access:redeemAccessCode",
);
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

const STORAGE_KEYS = {
  grantToken: "smartnotes.grant-token",
  sessionId: "smartnotes.session-id",
} as const;

const ACCEPTED_FILE_TYPES = ".pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.markdown,.csv,.json";

type FeedbackState = {
  isCorrect: boolean;
  score: number;
  explanation: string;
  idealAnswer: string;
};

const formatError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
};

const uploadFileToConvexStorage = (uploadUrl: string, file: File): Promise<{ storageId: string }> => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", uploadUrl, true);
    request.timeout = 130000;

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Hochladen fehlgeschlagen (${request.status}).`));
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

        reject(new Error("Upload-Antwort konnte nicht gelesen werden. Bitte versuche es erneut."));
      }
    };

    request.onerror = () => {
      reject(new Error("Netzwerkfehler beim Hochladen. Bitte prüfe Internetverbindung, VPN/Ad-Blocker und versuche es erneut."));
    };

    request.ontimeout = () => {
      reject(new Error("Zeitüberschreitung beim Hochladen. Bitte versuche eine kleinere Datei oder erneut."));
    };

    request.onabort = () => {
      reject(new Error("Der Upload wurde abgebrochen."));
    };

    request.send(file);
  });
};

function App() {
  const [grantToken, setGrantToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.grantToken));
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.sessionId);
    return saved;
  });

  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const [answerInput, setAnswerInput] = useState("");
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [topicLoading, setTopicLoading] = useState<string | null>(null);

  const redeemAccessCode = useMutation(redeemAccessCodeRef);
  const startSession = useMutation(startSessionRef);
  const generateUploadUrl = useMutation(generateUploadUrlRef);
  const registerUploadedDocument = useMutation(registerUploadedDocumentRef);
  const removeDocument = useMutation(removeDocumentRef);

  const extractDocumentContent = useAction(extractDocumentContentRef);
  const generateQuiz = useAction(generateQuizRef);
  const evaluateAnswer = useAction(evaluateAnswerRef);
  const analyzePerformance = useAction(analyzePerformanceRef);
  const generateTopicDeepDive = useAction(generateTopicDeepDiveRef);

  const grantStatus = useQuery(validateGrantRef, grantToken ? { grantToken } : "skip");
  const latestSessionId = useQuery(latestSessionIdRef, grantToken && grantStatus?.valid ? { grantToken } : "skip");
  const snapshot = useQuery(
    sessionSnapshotRef,
    grantToken && grantStatus?.valid && sessionId && latestSessionId !== undefined && latestSessionId === sessionId
      ? { grantToken, sessionId }
      : "skip",
  );

  useEffect(() => {
    if (!grantToken || !grantStatus || grantStatus.valid) {
      return;
    }

    setGrantToken(null);
    setSessionId(null);
    localStorage.removeItem(STORAGE_KEYS.grantToken);
    localStorage.removeItem(STORAGE_KEYS.sessionId);
  }, [grantStatus, grantToken]);

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
      .catch((error: unknown) => {
        setAuthError(formatError(error));
      })
      .finally(() => {
        setIsCreatingSession(false);
      });
  }, [grantToken, grantStatus, isCreatingSession, latestSessionId, sessionId, startSession]);

  useEffect(() => {
    if (!grantToken || !grantStatus?.valid || latestSessionId === undefined) {
      return;
    }

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
    if (!session) {
      return null;
    }
    return session.quizQuestions.find((question) => !responseByQuestionId.has(question.id)) ?? null;
  }, [responseByQuestionId, session]);

  useEffect(() => {
    setAnswerInput("");
    setFeedback(null);
    setQuizError(null);
    setQuestionStartedAt(Date.now());
  }, [currentQuestion?.id]);

  const handleSignOut = () => {
    setGrantToken(null);
    setSessionId(null);
    setAuthError(null);
    localStorage.removeItem(STORAGE_KEYS.grantToken);
    localStorage.removeItem(STORAGE_KEYS.sessionId);
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
    if (!grantToken) {
      return;
    }

    setIsCreatingSession(true);
    setAnalysisError(null);
    setQuizError(null);
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

  // Upload flow:
  // 1) Ask Convex for a short-lived upload URL.
  // 2) Upload raw bytes directly from browser.
  // 3) Register metadata and trigger extraction action.
  const handleFileUpload = async (files: File[]) => {
    if (!grantToken || !sessionId || files.length === 0) {
      return;
    }

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

        await extractDocumentContent({
          grantToken,
          sessionId,
          documentId,
        });
      } catch (error: unknown) {
        errors.push(`${file.name}: ${formatError(error)}`);
      }
    }

    if (errors.length > 0) {
      setUploadError(errors.join("\n"));
    }

    setIsUploading(false);
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) {
      return;
    }

    void handleFileUpload(Array.from(fileList));
    event.target.value = "";
  };

  const handleGenerateQuiz = async () => {
    if (!grantToken || !sessionId) {
      return;
    }

    setIsGeneratingQuiz(true);
    setUploadError(null);

    try {
      await generateQuiz({
        grantToken,
        sessionId,
        questionCount: 6,
      });
    } catch (error: unknown) {
      setUploadError(formatError(error));
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!grantToken || !sessionId || !currentQuestion) {
      return;
    }
    if (!answerInput.trim()) {
      setQuizError("Bitte schreibe eine Antwort, bevor du sie abschickst.");
      return;
    }

    setIsSubmittingAnswer(true);
    setQuizError(null);

    try {
      const timeSpentSeconds = Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000));

      const result = await evaluateAnswer({
        grantToken,
        sessionId,
        questionId: currentQuestion.id,
        userAnswer: answerInput,
        timeSpentSeconds,
      });

      setFeedback(result);
    } catch (error: unknown) {
      setQuizError(formatError(error));
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleAnalyzeSession = async () => {
    if (!grantToken || !sessionId) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      await analyzePerformance({
        grantToken,
        sessionId,
      });
    } catch (error: unknown) {
      setAnalysisError(formatError(error));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeepDive = async (topic: string) => {
    if (!grantToken || !sessionId) {
      return;
    }

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

  if (!grantToken) {
    return (
      <div className="min-h-screen bg-cream px-6 py-10 text-ink md:px-10">
        <div className="mx-auto max-w-xl">
          <div className="mb-10 flex items-center justify-center gap-3">
            <img src={logoImage} alt="Smartnotes" className="h-10 w-10 rounded-xl border border-cream-border" />
            <p className="text-lg font-black uppercase tracking-[0.16em] text-accent">Smartnotes</p>
          </div>

          <div className="rounded-[2rem] border border-cream-border bg-surface-white p-8 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Anonymer Zugang</p>
            <h1 className="mb-3 text-3xl font-bold tracking-tight">Einmal-Zugangscode eingeben</h1>
            <p className="mb-6 text-sm text-ink-secondary">
              Es werden keine Konten benötigt. Ein Einmal-Code gibt dir temporären, anonymen Zugang.
            </p>

            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Zugangscode</label>
            <input
              value={accessCodeInput}
              onChange={(event) => setAccessCodeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleRedeemCode();
                }
              }}
              placeholder="SMARTNOTES-DEMO-2026"
              className="mb-5 w-full rounded-2xl border border-cream-border bg-cream-light px-4 py-3 text-sm font-medium outline-none transition focus:border-accent"
            />

            {authError && (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{authError}</p>
            )}

            <button
              type="button"
              onClick={() => {
                void handleRedeemCode();
              }}
              disabled={isRedeemingCode}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-cream transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isRedeemingCode ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              Weiter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!grantStatus || !grantStatus.valid || !sessionId || !session || !stats) {
    return (
      <div className="min-h-screen bg-cream px-6 py-10 text-ink">
        <div className="mx-auto flex max-w-xl items-center justify-center gap-3 rounded-2xl border border-cream-border bg-surface-white p-5">
          <Loader2 size={20} className="animate-spin text-accent" />
          <p className="text-sm font-medium text-ink-secondary">Arbeitsbereich wird vorbereitet...</p>
        </div>
      </div>
    );
  }

  const stage = session.stage;
  const readyDocuments = documents.filter((document) => document.extractionStatus === "ready");

  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:grid-cols-[260px_1fr] md:px-8">
        <aside className="rounded-4xl border border-cream-border bg-surface-white p-5 shadow-sm md:h-[calc(100vh-3rem)] md:sticky md:top-6">
          <div className="mb-8 flex items-center gap-3">
            <img src={logoImage} alt="Smartnotes" className="h-10 w-10 rounded-xl border border-cream-border" />
            <div>
              <p className="text-base font-black uppercase tracking-[0.16em] text-accent">Smartnotes</p>
              <p className="text-xs font-medium text-ink-muted">Anonymer Lernmodus</p>
            </div>
          </div>

          <nav className="space-y-3">
            <StageBadge label="1. Materialien hochladen" active={stage === "upload"} done={stage !== "upload"} />
            <StageBadge label="2. Testsimulation" active={stage === "quiz"} done={stage === "analysis"} />
            <StageBadge label="3. Lernstands-Analyse" active={stage === "analysis"} done={false} />
          </nav>

          <div className="mt-8 rounded-2xl border border-cream-border bg-cream-light p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-accent">Aktuelle Sitzung</p>
            <p className="text-sm font-semibold text-ink">{session.title}</p>
            <p className="mt-2 text-xs text-ink-muted">Runde {session.round}</p>
          </div>

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => {
                void handleStartFreshSession();
              }}
              disabled={isCreatingSession}
              className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-cream-border bg-surface-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink transition hover:bg-cream-light disabled:opacity-60"
            >
              {isCreatingSession ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Neue Sitzung
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cream-border bg-surface-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted transition hover:text-ink"
            >
              <LogOut size={14} />
              Abmelden
            </button>
          </div>
        </aside>

        <main className="min-h-[70vh] rounded-4xl border border-cream-border bg-surface-white p-6 shadow-sm md:p-8">
          {stage === "upload" && (
            <section>
              <header className="mb-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Schritt 1</p>
                <h1 className="text-3xl font-bold tracking-tight">Lernmaterial hochladen</h1>
                <p className="mt-2 max-w-3xl text-sm text-ink-secondary">
                  Lade PDFs, Vorlesungsfolien und digitale Notizen hoch. Der Inhalt wird im Backend extrahiert, damit die KI
                  daraus passende Prüfungsfragen erstellt.
                </p>
              </header>

              <label className="mb-5 flex cursor-pointer items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-cream-border bg-cream-light px-6 py-10 text-center transition hover:border-accent/40">
                <Upload size={22} className="text-accent" />
                <div>
                  <p className="text-sm font-bold">Dateien zum Hochladen auswählen</p>
                  <p className="text-xs text-ink-muted">PDF, PPT/PPTX, DOC/DOCX, TXT, MD, CSV, JSON</p>
                </div>
                <input type="file" multiple accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={onFileInputChange} />
              </label>

              {uploadError && (
                <p className="mb-4 whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {uploadError}
                </p>
              )}

              <div className="mb-6 space-y-3">
                {documents.length === 0 ? (
                  <p className="rounded-2xl border border-cream-border bg-cream-light px-4 py-3 text-sm text-ink-muted">
                    Noch keine Dateien hochgeladen.
                  </p>
                ) : (
                  documents.map((document) => (
                    <div
                      key={document._id}
                      className="flex items-center justify-between rounded-2xl border border-cream-border bg-surface-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{document.fileName}</p>
                        <p className="text-xs text-ink-muted">{renderExtractionStatus(document.extractionStatus)}</p>
                        {document.extractionError && <p className="text-xs text-red-600">{document.extractionError}</p>}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!grantToken || !sessionId) {
                            return;
                          }
                          void removeDocument({ grantToken, sessionId, documentId: document._id });
                        }}
                        className="ml-4 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-light hover:text-ink"
                        aria-label={`Datei ${document.fileName} entfernen`}
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleGenerateQuiz();
                }}
                disabled={isUploading || isGeneratingQuiz || readyDocuments.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-cream transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {isUploading || isGeneratingQuiz ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Prüfungsfragen generieren
              </button>
            </section>
          )}

          {stage === "quiz" && (
            <section>
              <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Schritt 2</p>
                  <h1 className="text-3xl font-bold tracking-tight">Testsimulation</h1>
                  <p className="mt-2 text-sm text-ink-secondary">
                    Beantworte wahrscheinliche Prüfungsfragen. Wenn du etwas nicht weißt, bekommst du sofort eine Erklärung und eine Musterantwort.
                  </p>
                </div>

                <div className="rounded-2xl border border-cream-border bg-cream-light px-4 py-3 text-right">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Fortschritt</p>
                  <p className="text-lg font-bold text-ink">
                    {stats.answeredQuestions} / {stats.totalQuestions}
                  </p>
                </div>
              </header>

              {quizError && (
                <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{quizError}</p>
              )}

              {!currentQuestion && stats.totalQuestions > 0 ? (
                <div className="rounded-3xl border border-cream-border bg-cream-light p-6">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">Quiz abgeschlossen</p>
                  <h2 className="mb-2 text-2xl font-bold">Stark gemacht. Bereit für die Analyse?</h2>
                  <p className="mb-5 text-sm text-ink-secondary">
                    Wir nutzen deine Antworten, um deinen Lernstand pro Thema zu schätzen, Lücken zu erkennen und eine gezielte Vertiefung vorzuschlagen.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      void handleAnalyzeSession();
                    }}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-cream transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                    Lernstands-Analyse starten
                  </button>
                </div>
              ) : currentQuestion ? (
                <>
                  <div className="mb-5 rounded-3xl border border-cream-border bg-cream-light p-6">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">{currentQuestion.topic}</p>
                    <h2 className="text-2xl font-bold leading-tight">{currentQuestion.prompt}</h2>
                  </div>

                  <textarea
                    value={answerInput}
                    onChange={(event) => setAnswerInput(event.target.value)}
                    rows={6}
                    placeholder="Schreibe hier deine Antwort..."
                    className="mb-4 w-full rounded-3xl border border-cream-border bg-surface-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      void handleSubmitAnswer();
                    }}
                    disabled={isSubmittingAnswer}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-cream transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {isSubmittingAnswer ? <Loader2 size={16} className="animate-spin" /> : <BadgeHelp size={16} />}
                    Antwort abgeben
                  </button>

                  {feedback && (
                    <div className="mt-6 rounded-3xl border border-cream-border bg-surface-white p-6">
                      <div className="mb-4 flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${
                            feedback.isCorrect
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {feedback.isCorrect ? <CheckCircle2 size={14} /> : <Lightbulb size={14} />}
                          {feedback.isCorrect ? "Richtig" : "Nicht ganz"}
                        </span>

                        <span className="rounded-full bg-cream-light px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-secondary">
                          Punkte {feedback.score}
                        </span>
                      </div>

                      <p className="mb-3 text-sm leading-relaxed text-ink-secondary">{feedback.explanation}</p>
                      <p className="rounded-2xl border border-cream-border bg-cream-light px-4 py-3 text-sm text-ink">
                        <span className="font-bold">Musterantwort:</span> {feedback.idealAnswer}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-2xl border border-cream-border bg-cream-light px-4 py-3 text-sm text-ink-muted">
                  Quiz wird vorbereitet...
                </p>
              )}
            </section>
          )}

          {stage === "analysis" && (
            <section>
              <header className="mb-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Schritt 3</p>
                <h1 className="text-3xl font-bold tracking-tight">Lernstands-Analyse</h1>
                <p className="mt-2 text-sm text-ink-secondary">
                  Wähle ein Thema mit Lernlücken für eine gezielte Vertiefung oder starte eine neue Sitzung.
                </p>
              </header>

              {analysisError && (
                <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{analysisError}</p>
              )}

              {!session.analysis ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleAnalyzeSession();
                  }}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-cream transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                  Analyse erstellen
                </button>
              ) : (
                <>
                  <div className="mb-5 grid gap-4 md:grid-cols-3">
                    <KpiCard label="Gesamter Lernstand" value={`${session.analysis.overallReadiness}%`} />
                    <KpiCard label="Stärkste Themen" value={session.analysis.strongestTopics.join(", ") || "-"} />
                    <KpiCard label="Schwächste Themen" value={session.analysis.weakestTopics.join(", ") || "-"} />
                  </div>

                  <div className="mb-5 rounded-3xl border border-cream-border bg-cream-light p-6">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">Empfehlung</p>
                    <p className="text-sm text-ink-secondary">{session.analysis.recommendedNextStep}</p>
                  </div>

                  <div className="space-y-3">
                    {session.analysis.topics.map((topic) => (
                      <div
                        key={topic.topic}
                        className="flex flex-col gap-3 rounded-3xl border border-cream-border bg-surface-white p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="text-base font-bold text-ink">{topic.topic}</p>
                          <p className="text-xs text-ink-muted">Komfort-Score: {topic.comfortScore}%</p>
                          <p className="mt-2 text-sm text-ink-secondary">{topic.rationale}</p>
                          <p className="mt-1 text-xs text-ink-muted">{topic.recommendation}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            void handleDeepDive(topic.topic);
                          }}
                          disabled={topicLoading === topic.topic}
                          className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.11em] text-cream transition hover:-translate-y-0.5 disabled:opacity-60"
                        >
                          {topicLoading === topic.topic ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                          Vertiefung
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function StageBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
        active
          ? "bg-accent text-cream"
          : done
            ? "bg-emerald-50 text-emerald-700"
            : "bg-cream-light text-ink-secondary"
      }`}
    >
      {done ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}
      {label}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-cream-border bg-surface-white p-4">
      <p className="mb-1 text-xs font-bold uppercase tracking-[0.13em] text-accent">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function renderExtractionStatus(status: "pending" | "processing" | "ready" | "failed") {
  switch (status) {
    case "pending":
      return "Wartet auf Extraktion";
    case "processing":
      return "Inhalt wird extrahiert";
    case "ready":
      return "Bereit für Quiz-Generierung";
    case "failed":
      return "Extraktion fehlgeschlagen";
    default:
      return status;
  }
}

export default App;
