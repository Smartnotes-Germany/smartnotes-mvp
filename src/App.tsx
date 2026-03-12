import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Routes, Route } from "react-router-dom";
import logoImage from "./assets/images/logo.png";
import {
  AnalysisStage,
  AuthScreen,
  GenerationDecisionStage,
  LoadingScreen,
  NavigationShell,
  PdfSummaryStage,
  PrivacyScreen,
  QuizStage,
  SummaryStage,
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
import Page from "./admin/page.tsx";

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
    hasAcceptedPrivacy,
    isAcceptingPrivacy,
    setAccessCodeInput,
    redeemCode,
    startFreshSession,
    acceptPrivacy,
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

  const uploadFlow = useUploadFlow({
    grantToken,
    sessionId,
    documents,
    quizQuestionsCount: session?.quizQuestions.length ?? 0,
  });

  const analysisFlow = useAnalysisFlow({
    grantToken,
    sessionId,
    documents,
    quizQuestions: session?.quizQuestions ?? [],
    currentFocusTopic: session?.currentFocusTopic ?? null,
    hasExistingAnalysis: Boolean(session?.analysis),
  });
  const quizFlow = useQuizFlow({ grantToken, sessionId, currentQuestion });
  const [showGenerationDecision, setShowGenerationDecision] = useState(false);
  const [sessionActionError, setSessionActionError] = useState<string | null>(
    null,
  );

  const handleStartFreshSession = async () => {
    setSessionActionError(null);
    analysisFlow.setAnalysisError(null);
    uploadFlow.setUploadError(null);
    setShowGenerationDecision(false);
    const startError = await startFreshSession();
    if (startError) {
      setSessionActionError(startError);
    }
  };

  const handleStartDirectQuiz = async () => {
    // This will generate the quiz and summary, but we'll go straight to the quiz stage
    // The backend logic needs to support this, or we set a flag.
    // For now, we'll just generate and let the normal flow to summary happen.
    // A future improvement could be to skip summary.
    await uploadFlow.generateQuizQuestions();
  };

  const handleStartLearnFirst = async () => {
    await uploadFlow.generatePdfSummaryQuestions();
  };

  const handleReturnToGenerationDecision = async () => {
    await uploadFlow.reopenUploadSelection();
    setShowGenerationDecision(true);
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

  if (!hasAcceptedPrivacy) {
    return (
      <PrivacyScreen
        onAcceptPrivacy={acceptPrivacy}
        isAcceptingPrivacy={isAcceptingPrivacy}
        logoImage={logoImage}
        preference={themePreference}
        setPreference={setThemePreference}
      />
    );
  }

  if (!grantStatus || !grantStatus.valid || !sessionId || !session || !stats) {
    return <LoadingScreen />;
  }

  const shouldShowGenerationDecision =
    showGenerationDecision &&
    session.stage === "upload" &&
    stats.readyDocuments > 0;

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
        <>
          {shouldShowGenerationDecision ? (
            <GenerationDecisionStage
              isGeneratingQuiz={uploadFlow.isGeneratingQuiz}
              uploadError={uploadFlow.uploadError}
              onBackToUpload={() => setShowGenerationDecision(false)}
              onStartDirectQuiz={handleStartDirectQuiz}
              onStartLearnFirst={handleStartLearnFirst}
            />
          ) : (
            <UploadStage
              documents={documents}
              isUploading={uploadFlow.isUploading}
              isGeneratingQuiz={uploadFlow.isGeneratingQuiz}
              uploadError={uploadFlow.uploadError}
              isRemovingDocument={uploadFlow.isRemovingDocument}
              onFileInputChange={uploadFlow.onFileInputChange}
              onGenerateQuiz={() => setShowGenerationDecision(true)}
              onRemoveDocument={uploadFlow.removeDocumentById}
            />
          )}
        </>
      )}

      {session.stage === "summary" && (
        <SummaryStage
          summary={session.sourceSummary ?? "Keine Zusammenfassung verfügbar."}
          onStartQuiz={uploadFlow.startQuizStudySession}
          isLoading={uploadFlow.isGeneratingQuiz}
          quizError={uploadFlow.uploadError}
        />
      )}

      {session.stage === "pdf_summary" && (
        <PdfSummaryStage
          data={session.pdfSummary}
          onBack={handleReturnToGenerationDecision}
          onContinueToQuiz={uploadFlow.startQuizStudySession}
          isStartingQuiz={uploadFlow.isGeneratingQuiz}
          quizError={uploadFlow.uploadError}
        />
      )}

      {session.stage === "quiz" && (
        <QuizStage
          currentQuestion={quizFlow.displayQuestion}
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
      <Route path="/admin" element={<Page />} />
      <Route path="*" element={<StudyApp />} />
    </Routes>
  );
}

export default App;
