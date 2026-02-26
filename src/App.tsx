import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Routes, Route } from "react-router-dom";
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
import AdminDashboard from "./admin/AdminDashboard";

function StudyApp() {
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
  const documents = snapshot?.documents ?? [];
  const responses = snapshot?.responses;
  const stats = snapshot?.stats ?? null;

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

  const uploadFlow = useUploadFlow({ grantToken, sessionId, documents });
  const analysisFlow = useAnalysisFlow({ grantToken, sessionId, documents });
  const quizFlow = useQuizFlow({ grantToken, sessionId, currentQuestion });
  const [sessionActionError, setSessionActionError] = useState<string | null>(
    null,
  );

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
        setPreference={setThemePreference}
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
      setPreference={setThemePreference}
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

function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<StudyApp />} />
    </Routes>
  );
}

export default App;
