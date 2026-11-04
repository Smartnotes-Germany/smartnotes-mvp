import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "convex/react";
import {
  Link,
  Navigate,
  Routes,
  Route,
  useLocation,
  useMatch,
  useParams,
} from "react-router-dom";
import logoImage from "./assets/images/stackprep-mark.svg";
import {
  AccountLockedScreen,
  AnalysisStage,
  AuthScreen,
  ExamsPage,
  LoadingScreen,
  NavigationShell,
  OnboardingScreen,
  PrivacyScreen,
  QuizStage,
  SharedExamPage,
  TopicSummaryStage,
  UploadStage,
} from "./features/study/components";
import { sessionSnapshotRef } from "./features/study/convexRefs";
import { useTheme } from "./features/study/useTheme";
import {
  readPendingShareToken,
  storePendingShareToken,
} from "./features/study/pendingShareLink";
import {
  useAnalysisFlow,
  useAuthSession,
  useQuizFlow,
  useTopicSummaryFlow,
  useUploadFlow,
} from "./features/study/hooks";
import Page from "./admin/page.tsx";
import { topicsMatchForFocusMode } from "../shared/topicMatching";
import {
  registerBaseContext,
  registerPostHogContext,
  trackConsentUpdated,
  trackStudyStageViewed,
  trackThemeChanged,
  type AnalyticsStage,
} from "./features/study/analytics";
import type {
  StudySessionId,
  StudyStage,
  ThemePreference,
  Viewer,
} from "./features/study/types";

const analyticsStageByStudyStage: Record<StudyStage, AnalyticsStage> = {
  upload: "upload",
  mode_selection: "mode_selection",
  quiz: "quiz",
  analysis: "analysis",
  summary: "analysis",
};

type ExamFlowProps = {
  viewer: Viewer;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
};

/** Eine Prüfung im Ablauf Hochladen → Quiz → Analyse, geöffnet über ihre Adresse. */
function ExamFlow({
  viewer,
  themePreference,
  onThemePreferenceChange,
  onSignOut,
  isSigningOut,
}: ExamFlowProps) {
  // Die ID kommt aus der Adresse. Convex prüft sie und liefert für fremde
  // oder unbekannte Prüfungen null.
  const sessionId = (useParams().sessionId ?? null) as StudySessionId | null;

  const snapshot = useQuery(
    sessionSnapshotRef,
    sessionId ? { sessionId } : "skip",
  );

  const session = snapshot?.session ?? null;
  const documents = useMemo(
    () => snapshot?.documents ?? [],
    [snapshot?.documents],
  );
  const answeredQuestionIds = snapshot?.answeredQuestionIds;
  const stats = snapshot?.stats ?? null;
  const readyDocumentCount = useMemo(
    () =>
      documents.filter((document) => document.extractionStatus === "ready")
        .length,
    [documents],
  );

  const answeredQuestionIdSet = useMemo(
    () => new Set(answeredQuestionIds ?? []),
    [answeredQuestionIds],
  );

  const minQuestionsRequired = useMemo(() => {
    if (!session || !session.focusTopics || session.focusTopics.length === 0) {
      return 5;
    }

    // Determine the base goal (minimum required questions)
    // 10 for "all", or 5 per specific topic.
    const baseGoal = session.focusTopics.includes("all")
      ? 10
      : session.focusTopics.length * 5;

    // Determine the total available matching questions in the pool.
    // If we have generated more questions (e.g. via Deep Dive), we want to include them in the goal.
    const matchingQuestionsCount = session.quizQuestions.filter((q) => {
      if (session.focusTopics?.includes("all")) return true;
      return session.focusTopics?.some((ft) =>
        topicsMatchForFocusMode(q.topic, ft),
      );
    }).length;

    // The goal is the maximum of the base requirement and the actual available questions.
    // This ensures that after a deep dive (adding 10 questions), the progress bar extends.
    return Math.max(baseGoal, matchingQuestionsCount);
  }, [session]);

  const answeredQuestionsInFocus = useMemo(() => {
    if (!session) {
      return 0;
    }

    const focusTopics = session.focusTopics ?? [];
    return session.quizQuestions.filter((question) => {
      if (!answeredQuestionIdSet.has(question.id)) {
        return false;
      }

      if (focusTopics.length === 0 || focusTopics.includes("all")) {
        return true;
      }

      return focusTopics.some((topic) =>
        topicsMatchForFocusMode(question.topic, topic),
      );
    }).length;
  }, [answeredQuestionIdSet, session]);

  const activeTopic = useMemo(() => {
    if (!session || !session.focusTopics || session.focusTopics.length === 0) {
      return null;
    }
    if (session.focusTopics.includes("all")) {
      return "all";
    }

    // Find the first topic in the list that has ANY unanswered questions
    // This allows continuing after a Deep Dive even if > 5 questions were answered before.
    for (const topic of session.focusTopics) {
      const hasUnanswered = session.quizQuestions.some(
        (q) =>
          topicsMatchForFocusMode(q.topic, topic) &&
          !answeredQuestionIdSet.has(q.id),
      );

      if (hasUnanswered) {
        return topic;
      }
    }

    // If all topics are complete, there's no active topic
    return null;
  }, [answeredQuestionIdSet, session]);

  const currentQuestion = useMemo(() => {
    if (!session || !activeTopic) {
      return null;
    }

    // Stop after reaching the required question count to trigger automatic analysis
    if (answeredQuestionsInFocus >= minQuestionsRequired) {
      return null;
    }

    return (
      session.quizQuestions.find((question) => {
        if (answeredQuestionIdSet.has(question.id)) {
          return false;
        }

        if (activeTopic === "all") {
          return true;
        }

        return topicsMatchForFocusMode(question.topic, activeTopic);
      }) ?? null
    );
  }, [
    activeTopic,
    answeredQuestionIdSet,
    answeredQuestionsInFocus,
    minQuestionsRequired,
    session,
  ]);

  const uploadFlow = useUploadFlow({
    sessionId,
    documents,
    documentCount: documents.length,
    readyDocumentCount,
  });
  const analysisFlow = useAnalysisFlow({
    sessionId,
    documents,
    answeredQuestions: stats?.answeredQuestions,
    totalQuestions: stats?.totalQuestions,
    quizQuestions: session?.quizQuestions ?? [],
    currentFocusTopic: activeTopic,
    hasExistingAnalysis: Boolean(session?.analysis),
  });
  const shouldContinueToAnalysis =
    session?.stage === "quiz" &&
    answeredQuestionsInFocus >= minQuestionsRequired &&
    !session?.analysis;
  const shouldReturnToExistingAnalysis =
    session?.stage === "quiz" &&
    answeredQuestionsInFocus >= minQuestionsRequired &&
    Boolean(session?.analysis);
  const displayStage: StudyStage = shouldReturnToExistingAnalysis
    ? "analysis"
    : (session?.stage ?? "upload");
  const topicSummaryFlow = useTopicSummaryFlow({ sessionId });
  const topicSummary = session?.topicSummary;
  const showTopicSummary =
    displayStage === "quiz" && Boolean(topicSummary && !topicSummary.dismissed);
  const quizFlow = useQuizFlow({
    sessionId,
    currentQuestion,
    isQuizActive: displayStage === "quiz" && !showTopicSummary,
    answeredQuestions: stats?.answeredQuestions,
    totalQuestions: stats?.totalQuestions,
  });
  const lastTrackedStageRef = useRef<AnalyticsStage | null>(null);

  const currentStage = useMemo<AnalyticsStage>(() => {
    if (!sessionId || !session || !stats) {
      return "loading";
    }

    return analyticsStageByStudyStage[displayStage];
  }, [displayStage, session, sessionId, stats]);

  useEffect(() => {
    registerPostHogContext({
      analyticsUserId: viewer.analyticsUserId,
      sessionId,
    });
  }, [sessionId, viewer.analyticsUserId]);

  useEffect(() => {
    if (lastTrackedStageRef.current === currentStage) {
      return;
    }

    lastTrackedStageRef.current = currentStage;
    trackStudyStageViewed(currentStage, {
      documents: documents.length,
      readyDocuments: readyDocumentCount,
      answeredQuestions: stats?.answeredQuestions,
      totalQuestions: stats?.totalQuestions,
    });
  }, [currentStage, documents.length, readyDocumentCount, stats]);

  const handleSetFocusTopics = async (topics: string[]) => {
    // Läuft parallel zu den Fragen und wird vor dem Quiz angezeigt.
    void topicSummaryFlow.startTopicSummary(topics);
    try {
      await uploadFlow.generateFocusedQuizQuestions(topics);
    } catch (error) {
      console.error("Themenwahl fehlgeschlagen:", error);
    }
  };

  const handleContinueAfterFeedback = async () => {
    if (shouldContinueToAnalysis) {
      await analysisFlow.analyzeSession();
      return;
    }

    quizFlow.continueAfterFeedback();
  };

  if (snapshot === null) {
    return (
      <div className="app-glow text-ink flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-3 text-2xl font-medium tracking-[-0.04em] md:text-4xl">
          Prüfung nicht gefunden
        </h1>
        <p className="text-ink-secondary mb-8 max-w-md">
          Diese Prüfung gibt es nicht oder sie gehört zu einem anderen Konto.
        </p>
        <Link to="/" className="pill-button">
          Zu deinen Prüfungen
        </Link>
      </div>
    );
  }

  if (!sessionId || !session || !stats) {
    return <LoadingScreen onSignOut={onSignOut} />;
  }

  return (
    <NavigationShell
      logoImage={logoImage}
      stage={displayStage}
      examTitle={session.title}
      preference={themePreference}
      setPreference={onThemePreferenceChange}
      onSignOut={onSignOut}
      isSigningOut={isSigningOut}
    >
      {displayStage === "upload" && (
        <UploadStage
          documents={documents}
          isUploading={uploadFlow.isUploading}
          uploadError={uploadFlow.uploadError}
          isGeneratingQuiz={uploadFlow.isGeneratingQuiz}
          isRemovingDocument={uploadFlow.isRemovingDocument}
          onFileInputChange={uploadFlow.onFileInputChange}
          onImportLink={uploadFlow.importLink}
          onGenerateQuiz={uploadFlow.generateQuizQuestions}
          onRemoveDocument={uploadFlow.removeDocumentById}
        />
      )}

      {showTopicSummary && topicSummary && (
        <TopicSummaryStage
          sessionId={session._id}
          summary={topicSummary}
          isGeneratingQuiz={uploadFlow.isGeneratingQuiz}
          isDismissing={topicSummaryFlow.isDismissing}
          onStartQuiz={topicSummaryFlow.dismissTopicSummary}
        />
      )}

      {(analyticsStageByStudyStage[session.stage] === "mode_selection" ||
        displayStage === "quiz") && (
        // Bleibt während der Zusammenfassung montiert, damit die Themenauswahl erhalten bleibt.
        <div className={showTopicSummary ? "hidden" : "contents"}>
          <QuizStage
            currentQuestion={quizFlow.displayQuestion}
            feedback={quizFlow.feedback}
            answerInput={quizFlow.answerInput}
            onAnswerInputChange={quizFlow.setAnswerInput}
            onSubmitAnswer={quizFlow.submitAnswer}
            isSubmittingAnswer={quizFlow.isSubmittingAnswer}
            // Scheitert die Fragengenerierung nach der Themenwahl, landet der
            // Fehler im Upload-Flow und muss hier bei der Themenauswahl stehen.
            quizError={
              quizFlow.quizError ||
              analysisFlow.analysisError ||
              uploadFlow.uploadError
            }
            isGeneratingQuiz={uploadFlow.isGeneratingQuiz}
            onContinueAfterFeedback={handleContinueAfterFeedback}
            sourceTopics={session.sourceTopics}
            focusTopics={session.focusTopics ?? []}
            activeTopic={activeTopic}
            onSetFocusTopics={handleSetFocusTopics}
            answeredQuestionsInFocus={answeredQuestionsInFocus}
            minQuestionsRequired={minQuestionsRequired}
            topicLoading={analysisFlow.topicLoading}
            isAnalyzing={analysisFlow.isAnalyzing}
            shouldContinueToAnalysis={
              shouldContinueToAnalysis || shouldReturnToExistingAnalysis
            }
          />
        </div>
      )}

      {displayStage === "analysis" && (
        <AnalysisStage
          analysis={session.analysis}
          isAnalyzing={analysisFlow.isAnalyzing}
          analysisError={analysisFlow.analysisError}
          topicLoading={analysisFlow.topicLoading}
          onAnalyzeSession={analysisFlow.analyzeSession}
          onDeepDive={analysisFlow.deepDiveTopic}
        />
      )}
    </NavigationShell>
  );
}

/**
 * Prüft Anmeldung, Freischaltung, Onboarding und Datenschutz und zeigt dann
 * die Startseite mit allen Prüfungen oder eine einzelne Prüfung.
 */
function StudyApp() {
  const { preference: themePreference, setPreference: setThemePreference } =
    useTheme();
  const { isSignedIn: isClerkSignedIn } = useAuth();
  const {
    isAuthLoading,
    isAuthenticated,
    viewer,
    authError,
    isActivating,
    isSigningOut,
    hasAcceptedPrivacy,
    isAcceptingPrivacy,
    acceptPrivacy,
    signOut,
  } = useAuthSession();
  const shareToken = useMatch("/teilen/:token")?.params.token;

  // Ein geteilter Link überlebt so die Anmeldung bei Clerk.
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated && shareToken) {
      storePendingShareToken(shareToken);
    }
  }, [isAuthLoading, isAuthenticated, shareToken]);

  const handleThemePreferenceChange = useCallback(
    (nextPreference: ThemePreference) => {
      if (nextPreference === themePreference) {
        return;
      }

      trackThemeChanged(themePreference, nextPreference);
      setThemePreference(nextPreference);
    },
    [setThemePreference, themePreference],
  );

  useEffect(() => {
    if (!isAuthenticated || viewer?.activated === false) {
      trackStudyStageViewed("auth", {});
    }
  }, [isAuthenticated, viewer?.activated]);

  useEffect(() => {
    const handleConsentUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ consentState?: unknown }>;
      const rawConsentState =
        typeof customEvent.detail?.consentState === "string"
          ? customEvent.detail.consentState
          : "aktualisiert";
      const consentState =
        rawConsentState === "akzeptiert" ||
        rawConsentState === "abgelehnt" ||
        rawConsentState === "aktualisiert"
          ? rawConsentState
          : "aktualisiert";

      trackConsentUpdated(consentState);
    };

    window.addEventListener(
      "smartnotes:consent-updated",
      handleConsentUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        "smartnotes:consent-updated",
        handleConsentUpdated as EventListener,
      );
    };
  }, []);

  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    if (isClerkSignedIn) {
      // Clerk ist angemeldet, aber Convex akzeptiert das Token nicht.
      return (
        <LoadingScreen
          error="Deine Anmeldung konnte nicht bestätigt werden. Bitte melde dich erneut an."
          onSignOut={signOut}
        />
      );
    }

    return <Navigate to="/anmelden" replace />;
  }

  if (!viewer) {
    return <LoadingScreen error={authError} onSignOut={signOut} />;
  }

  if (!viewer.activated) {
    if (isActivating) {
      return <LoadingScreen />;
    }

    return (
      <AccountLockedScreen
        logoImage={logoImage}
        preference={themePreference}
        setPreference={handleThemePreferenceChange}
        accountEmail={viewer.identityEmail}
        authError={authError}
        onSignOut={signOut}
        isSigningOut={isSigningOut}
      />
    );
  }

  if (!viewer.onboarded) {
    return (
      <OnboardingScreen
        logoImage={logoImage}
        preference={themePreference}
        setPreference={handleThemePreferenceChange}
      />
    );
  }

  if (!hasAcceptedPrivacy) {
    return (
      <PrivacyScreen
        onAcceptPrivacy={acceptPrivacy}
        isAcceptingPrivacy={isAcceptingPrivacy}
        logoImage={logoImage}
        preference={themePreference}
        setPreference={handleThemePreferenceChange}
      />
    );
  }

  const pendingShareToken = readPendingShareToken();
  if (pendingShareToken && !shareToken) {
    return <Navigate to={`/teilen/${pendingShareToken}`} replace />;
  }

  return (
    <Routes>
      <Route
        path="teilen/:token"
        element={
          <SharedExamPage
            logoImage={logoImage}
            preference={themePreference}
            setPreference={handleThemePreferenceChange}
          />
        }
      />
      <Route
        index
        element={
          <ExamsPage
            logoImage={logoImage}
            preference={themePreference}
            setPreference={handleThemePreferenceChange}
            onSignOut={signOut}
            isSigningOut={isSigningOut}
          />
        }
      />
      <Route
        path="pruefung/:sessionId"
        element={
          <ExamFlow
            viewer={viewer}
            themePreference={themePreference}
            onThemePreferenceChange={handleThemePreferenceChange}
            onSignOut={signOut}
            isSigningOut={isSigningOut}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AnalyticsContextSync() {
  const location = useLocation();

  useEffect(() => {
    registerBaseContext();
  }, [location.hash, location.pathname, location.search]);

  return null;
}

function AuthRoute({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { isSignedIn } = useAuth();
  const { preference, setPreference } = useTheme();

  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthScreen
      mode={mode}
      logoImage={logoImage}
      preference={preference}
      setPreference={setPreference}
    />
  );
}

function App() {
  return (
    <>
      <AnalyticsContextSync />
      <Routes>
        <Route path="/admin" element={<Page />} />
        <Route path="/anmelden/*" element={<AuthRoute mode="sign-in" />} />
        <Route path="/registrieren/*" element={<AuthRoute mode="sign-up" />} />
        <Route path="*" element={<StudyApp />} />
      </Routes>
    </>
  );
}

export default App;
