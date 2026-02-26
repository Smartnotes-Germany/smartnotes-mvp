import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import logoImage from "./assets/images/logo.png";
import {
  AnalysisStage,
  AuthScreen,
  LoadingScreen,
  NavigationShell,
  QuizStage,
  UploadStage,
} from "./features/study/components";
import { sessionSnapshotRef } from "./features/study/convexRefs";
import { useTheme } from "./features/study/useTheme";
import {
  useAnalysisFlow,
  useAuthSession,
  useQuizFlow,
  useUploadFlow,
} from "./features/study/hooks";
import {
  trackConsentUpdated,
  trackStudyStageViewed,
  trackThemeChanged,
  type AnalyticsStage,
} from "./features/study/analytics";
import type { ThemePreference } from "./features/study/types";

function App() {
  const { preference: themePreference, setPreference: setThemePreference } =
    useTheme();
  const {
    grantToken,
    sessionId,
    grantStatus,
    latestSessionId,
    accessCodeInput,
    authError,
    isRedeemingCode,
    isCreatingSession,
    isSigningOut,
    isConsumingMagicLink,
    setAccessCodeInput,
    redeemCode,
    startFreshSession,
    signOut,
  } = useAuthSession();

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

  const session = snapshot?.session ?? null;
  const documents = useMemo(
    () => snapshot?.documents ?? [],
    [snapshot?.documents],
  );
  const responses = snapshot?.responses;
  const stats = snapshot?.stats ?? null;
  const readyDocumentCount = useMemo(
    () =>
      documents.filter((document) => document.extractionStatus === "ready")
        .length,
    [documents],
  );

  const responseByQuestionId = useMemo(() => {
    return new Map(
      (responses ?? []).map((response) => [response.questionId, response]),
    );
  }, [responses]);

  const currentQuestion = useMemo(() => {
    if (!session) {
      return null;
    }
    return (
      session.quizQuestions.find(
        (question) => !responseByQuestionId.has(question.id),
      ) ?? null
    );
  }, [responseByQuestionId, session]);

  const uploadFlow = useUploadFlow({
    grantToken,
    sessionId,
    documents,
    documentCount: documents.length,
    readyDocumentCount,
  });
  const analysisFlow = useAnalysisFlow({
    grantToken,
    sessionId,
    documents,
    answeredQuestions: stats?.answeredQuestions,
    totalQuestions: stats?.totalQuestions,
  });
  const quizFlow = useQuizFlow({
    grantToken,
    sessionId,
    currentQuestion,
    answeredQuestions: stats?.answeredQuestions,
    totalQuestions: stats?.totalQuestions,
  });
  const [sessionActionError, setSessionActionError] = useState<string | null>(
    null,
  );
  const lastTrackedStageRef = useRef<AnalyticsStage | null>(null);

  const currentStage = useMemo<AnalyticsStage>(() => {
    if (!grantToken) {
      return "auth";
    }

    if (
      !grantStatus ||
      !grantStatus.valid ||
      !sessionId ||
      !session ||
      !stats
    ) {
      return "loading";
    }

    return session.stage;
  }, [grantStatus, grantToken, session, sessionId, stats]);

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

  const handleStartFreshSession = async () => {
    setSessionActionError(null);
    analysisFlow.setAnalysisError(null);
    uploadFlow.setUploadError(null);
    const startError = await startFreshSession();
    if (startError) {
      setSessionActionError(startError);
    }
  };

  if (!grantToken) {
    return (
      <AuthScreen
        logoImage={logoImage}
        preference={themePreference}
        setPreference={handleThemePreferenceChange}
        isConsumingMagicLink={isConsumingMagicLink}
        accessCodeInput={accessCodeInput}
        onAccessCodeChange={setAccessCodeInput}
        onRedeemCode={redeemCode}
        isRedeemingCode={isRedeemingCode}
        authError={authError}
      />
    );
  }

  if (!grantStatus || !grantStatus.valid || !sessionId || !session || !stats) {
    return <LoadingScreen />;
  }

  return (
    <NavigationShell
      logoImage={logoImage}
      stage={session.stage}
      preference={themePreference}
      setPreference={handleThemePreferenceChange}
      onStartFreshSession={handleStartFreshSession}
      isCreatingSession={isCreatingSession}
      onSignOut={signOut}
      isSigningOut={isSigningOut}
    >
      {sessionActionError && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {sessionActionError}
        </p>
      )}

      {session.stage === "upload" && (
        <UploadStage
          documents={documents}
          isUploading={uploadFlow.isUploading}
          uploadError={uploadFlow.uploadError}
          isGeneratingQuiz={uploadFlow.isGeneratingQuiz}
          isRemovingDocument={uploadFlow.isRemovingDocument}
          onFileInputChange={uploadFlow.onFileInputChange}
          onGenerateQuiz={uploadFlow.generateQuizQuestions}
          onRemoveDocument={uploadFlow.removeDocumentById}
        />
      )}

      {session.stage === "quiz" && (
        <QuizStage
          currentQuestion={currentQuestion}
          stats={stats}
          feedback={quizFlow.feedback}
          answerInput={quizFlow.answerInput}
          onAnswerInputChange={quizFlow.setAnswerInput}
          onSubmitAnswer={quizFlow.submitAnswer}
          isSubmittingAnswer={quizFlow.isSubmittingAnswer}
          quizError={quizFlow.quizError}
          onAnalyzeSession={analysisFlow.analyzeSession}
          isAnalyzing={analysisFlow.isAnalyzing}
          onGenerateQuiz={uploadFlow.generateQuizQuestions}
          isGeneratingQuiz={uploadFlow.isGeneratingQuiz}
          onContinueAfterFeedback={quizFlow.continueAfterFeedback}
        />
      )}

      {session.stage === "analysis" && (
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

export default App;
