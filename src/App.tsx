import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Routes, Route } from "react-router-dom";
import logoImage from "./assets/images/logo.png";
import {
  AnalysisStage,
  AuthScreen,
  LoadingScreen,
  NavigationShell,
  PrivacyScreen,
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
import Page from "./admin/page.tsx";
import { topicsMatchForFocusMode } from "../shared/topicMatching";

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

  useEffect(() => {
    if (snapshot === null && sessionId) {
      localStorage.removeItem("smartnotes.sessionId");
      window.location.reload();
    }
  }, [snapshot, sessionId]);

  const responseByQuestionId = useMemo(() => {
    return new Map(
      (responses ?? []).map((response) => [response.questionId, response]),
    );
  }, [responses]);

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
    if (!session || !responses) {
      return 0;
    }

    const focusTopics = session.focusTopics ?? [];
    return session.quizQuestions.filter((question) => {
      if (!responseByQuestionId.has(question.id)) {
        return false;
      }

      if (focusTopics.length === 0 || focusTopics.includes("all")) {
        return true;
      }

      return focusTopics.some((topic) =>
        topicsMatchForFocusMode(question.topic, topic),
      );
    }).length;
  }, [responseByQuestionId, responses, session]);

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
          !responseByQuestionId.has(q.id),
      );

      if (hasUnanswered) {
        return topic;
      }
    }

    // If all topics are complete, there's no active topic
    return null;
  }, [session, responseByQuestionId]);

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
        if (responseByQuestionId.has(question.id)) {
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
    answeredQuestionsInFocus,
    minQuestionsRequired,
    responseByQuestionId,
    session,
  ]);

  const uploadFlow = useUploadFlow({ grantToken, sessionId, documents });
  const analysisFlow = useAnalysisFlow({
    grantToken,
    sessionId,
    documents,
    quizQuestions: session?.quizQuestions ?? [],
    currentFocusTopic: activeTopic,
    hasExistingAnalysis: Boolean(session?.analysis),
  });
  const [sessionActionError, setSessionActionError] = useState<string | null>(
    null,
  );
  const shouldContinueToAnalysis =
    session?.stage === "quiz" &&
    answeredQuestionsInFocus >= minQuestionsRequired &&
    !session?.analysis;
  const shouldReturnToExistingAnalysis =
    session?.stage === "quiz" &&
    answeredQuestionsInFocus >= minQuestionsRequired &&
    Boolean(session?.analysis);
  const displayStage = shouldReturnToExistingAnalysis
    ? "analysis"
    : session?.stage ?? "upload";
  const quizFlow = useQuizFlow({
    grantToken,
    sessionId,
    currentQuestion,
    isQuizActive: displayStage === "quiz",
  });

  const handleStartFreshSession = async () => {
    setSessionActionError(null);
    analysisFlow.setAnalysisError(null);
    uploadFlow.setUploadError(null);
    const startError = await startFreshSession();
    if (startError) {
      setSessionActionError(startError);
    }
  };

  const handleSetFocusTopics = async (topics: string[]) => {
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

  if (snapshot === null && sessionId) {
    return <LoadingScreen />;
  }

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

  return (
    <NavigationShell
      logoImage={logoImage}
      stage={displayStage}
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

      {displayStage === "quiz" && (
        <QuizStage
          currentQuestion={quizFlow.displayQuestion}
          feedback={quizFlow.feedback}
          answerInput={quizFlow.answerInput}
          onAnswerInputChange={quizFlow.setAnswerInput}
          onSubmitAnswer={quizFlow.submitAnswer}
          isSubmittingAnswer={quizFlow.isSubmittingAnswer}
          quizError={quizFlow.quizError || analysisFlow.analysisError}
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

function App() {
  return (
    <Routes>
      <Route path="/admin" element={<Page />} />
      <Route path="*" element={<StudyApp />} />
    </Routes>
  );
}

export default App;
