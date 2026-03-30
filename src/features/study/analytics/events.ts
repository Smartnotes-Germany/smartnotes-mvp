import { isPostHogEnabled, posthogClient } from "./posthogClient";

type AnalyticsValue = string | number | boolean;
type AnalyticsProperties = Record<string, AnalyticsValue | undefined>;
export type AuthSource = "manual_code" | "magic_link";

export type AnalyticsStage =
  | "auth"
  | "loading"
  | "upload"
  | "mode_selection"
  | "quiz"
  | "analysis"
  | "ux";

export const ANALYTICS_FEATURE_FLAGS = {
  analysisCtaVariant: "analysis_cta_variant",
} as const;

const captureStudyEvent = (
  eventName: string,
  properties: AnalyticsProperties,
) => {
  if (!isPostHogEnabled()) {
    return;
  }

  const normalizedProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );

  posthogClient.capture(eventName, normalizedProperties);
};

const toDurationBucketMs = (durationMs: number) => {
  if (durationMs < 1_000) {
    return "lt_1s";
  }
  if (durationMs < 3_000) {
    return "1s_to_3s";
  }
  if (durationMs < 10_000) {
    return "3s_to_10s";
  }
  if (durationMs < 30_000) {
    return "10s_to_30s";
  }
  if (durationMs < 60_000) {
    return "30s_to_60s";
  }
  return "gte_60s";
};

const toDurationBucketSeconds = (durationSeconds: number) => {
  if (durationSeconds <= 5) {
    return "0s_to_5s";
  }
  if (durationSeconds <= 15) {
    return "6s_to_15s";
  }
  if (durationSeconds <= 30) {
    return "16s_to_30s";
  }
  if (durationSeconds <= 60) {
    return "31s_to_60s";
  }
  if (durationSeconds <= 120) {
    return "61s_to_120s";
  }
  return "gt_120s";
};

const toScoreBucket = (score: number) => {
  if (score < 25) {
    return "0_to_24";
  }
  if (score < 50) {
    return "25_to_49";
  }
  if (score < 75) {
    return "50_to_74";
  }
  if (score < 90) {
    return "75_to_89";
  }
  return "90_to_100";
};

type ProgressProperties = {
  answeredQuestions?: number;
  totalQuestions?: number;
};

type DocumentProperties = {
  documents?: number;
  readyDocuments?: number;
};

type TopicSelectionProperties = DocumentProperties & {
  selectionMode?: "all" | "focused";
  selectedTopicCount?: number;
  selectedTopics?: string;
  questionsPerTopic?: number;
  outputQuestionCount?: number;
};

export const trackAuthCodeRedeemStarted = (
  source: AuthSource = "manual_code",
) => {
  captureStudyEvent("auth_code_redeem_started", {
    stage: "auth",
    status: "started",
    source,
  });
};

export const trackAuthCodeRedeemSucceeded = (
  source: AuthSource = "manual_code",
) => {
  captureStudyEvent("auth_code_redeem_succeeded", {
    stage: "auth",
    status: "succeeded",
    source,
  });
};

export const trackAuthCodeRedeemFailed = (
  source: AuthSource = "manual_code",
) => {
  captureStudyEvent("auth_code_redeem_failed", {
    stage: "auth",
    status: "failed",
    source,
  });
};

export const trackSessionStarted = (source: "auth_code" | "auto" | "fresh") => {
  captureStudyEvent("session_started", {
    stage: "auth",
    status: "started",
    source,
  });
};

export const trackSessionResumed = () => {
  captureStudyEvent("session_resumed", {
    stage: "auth",
    status: "resumed",
  });
};

export const trackSessionSignout = () => {
  captureStudyEvent("session_signout", {
    stage: "auth",
    status: "succeeded",
  });
};

export const trackDocumentUploadStarted = (documents: number) => {
  captureStudyEvent("document_upload_started", {
    stage: "upload",
    status: "started",
    documents,
  });
};

export const trackDocumentUploadSucceeded = () => {
  captureStudyEvent("document_upload_succeeded", {
    stage: "upload",
    status: "succeeded",
    documents: 1,
  });
};

export const trackDocumentUploadFailed = (documents = 1) => {
  captureStudyEvent("document_upload_failed", {
    stage: "upload",
    status: "failed",
    documents,
  });
};

export const trackDocumentRemoved = (status: "succeeded" | "failed") => {
  captureStudyEvent("document_removed", {
    stage: "upload",
    status,
  });
};

export const trackDocumentExtractionFailed = () => {
  captureStudyEvent("document_extraction_failed", {
    stage: "upload",
    status: "failed",
  });
};

export const trackTopicSelectionPreparationRequested = (
  properties: DocumentProperties,
) => {
  captureStudyEvent("topic_selection_preparation_requested", {
    stage: "upload",
    status: "requested",
    documents: properties.documents,
    readyDocuments: properties.readyDocuments,
  });
};

export const trackTopicSelectionPreparationSucceeded = (
  durationMs: number,
  properties: DocumentProperties,
) => {
  captureStudyEvent("topic_selection_preparation_succeeded", {
    stage: "upload",
    status: "succeeded",
    documents: properties.documents,
    readyDocuments: properties.readyDocuments,
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
  });
};

export const trackTopicSelectionPreparationFailed = (
  durationMs: number,
  properties: DocumentProperties,
) => {
  captureStudyEvent("topic_selection_preparation_failed", {
    stage: "upload",
    status: "failed",
    documents: properties.documents,
    readyDocuments: properties.readyDocuments,
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
  });
};

export const trackFocusedQuizGenerationRequested = (
  properties: TopicSelectionProperties,
) => {
  captureStudyEvent("focused_quiz_generation_requested", {
    stage: "mode_selection",
    status: "requested",
    documents: properties.documents,
    readyDocuments: properties.readyDocuments,
    selectionMode: properties.selectionMode,
    selectedTopicCount: properties.selectedTopicCount,
    selectedTopics: properties.selectedTopics,
    questionsPerTopic: properties.questionsPerTopic,
  });
};

export const trackFocusedQuizGenerationSucceeded = (
  durationMs: number,
  properties: TopicSelectionProperties,
) => {
  captureStudyEvent("focused_quiz_generation_succeeded", {
    stage: "mode_selection",
    status: "succeeded",
    documents: properties.documents,
    readyDocuments: properties.readyDocuments,
    selectionMode: properties.selectionMode,
    selectedTopicCount: properties.selectedTopicCount,
    selectedTopics: properties.selectedTopics,
    questionsPerTopic: properties.questionsPerTopic,
    outputQuestionCount: properties.outputQuestionCount,
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
  });
};

export const trackFocusedQuizGenerationFailed = (
  durationMs: number,
  properties: TopicSelectionProperties,
) => {
  captureStudyEvent("focused_quiz_generation_failed", {
    stage: "mode_selection",
    status: "failed",
    documents: properties.documents,
    readyDocuments: properties.readyDocuments,
    selectionMode: properties.selectionMode,
    selectedTopicCount: properties.selectedTopicCount,
    selectedTopics: properties.selectedTopics,
    questionsPerTopic: properties.questionsPerTopic,
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
  });
};

export const trackQuizQuestionViewed = (properties: ProgressProperties) => {
  captureStudyEvent("quiz_question_viewed", {
    stage: "quiz",
    status: "viewed",
    answeredQuestions: properties.answeredQuestions,
    totalQuestions: properties.totalQuestions,
  });
};

export const trackQuizAnswerSubmitted = (
  durationSeconds: number,
  dontKnowSubmission: boolean,
  properties: ProgressProperties,
) => {
  captureStudyEvent("quiz_answer_submitted", {
    stage: "quiz",
    status: "submitted",
    answeredQuestions: properties.answeredQuestions,
    totalQuestions: properties.totalQuestions,
    durationSeconds,
    durationBucket: toDurationBucketSeconds(durationSeconds),
    dontKnowSubmission,
  });
};

export const trackQuizAnswerEvaluated = (
  score: number,
  durationMs: number,
  isCorrect: boolean,
  dontKnowSubmission: boolean,
  properties: ProgressProperties,
) => {
  captureStudyEvent("quiz_answer_evaluated", {
    stage: "quiz",
    status: "succeeded",
    answeredQuestions: properties.answeredQuestions,
    totalQuestions: properties.totalQuestions,
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
    scoreBucket: toScoreBucket(score),
    isCorrect,
    dontKnowSubmission,
  });
};

export const trackQuizAnswerEvaluationFailed = (
  durationMs: number,
  dontKnowSubmission: boolean,
  properties: ProgressProperties,
) => {
  captureStudyEvent("quiz_answer_evaluation_failed", {
    stage: "quiz",
    status: "failed",
    answeredQuestions: properties.answeredQuestions,
    totalQuestions: properties.totalQuestions,
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
    dontKnowSubmission,
  });
};

export const trackAnalysisRequested = (properties: ProgressProperties) => {
  captureStudyEvent("analysis_requested", {
    stage: "analysis",
    status: "requested",
    answeredQuestions: properties.answeredQuestions,
    totalQuestions: properties.totalQuestions,
  });
};

export const trackAnalysisSucceeded = (
  durationMs: number,
  properties: ProgressProperties,
) => {
  captureStudyEvent("analysis_succeeded", {
    stage: "analysis",
    status: "succeeded",
    answeredQuestions: properties.answeredQuestions,
    totalQuestions: properties.totalQuestions,
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
  });
};

export const trackAnalysisFailed = (
  durationMs: number,
  properties: ProgressProperties,
) => {
  captureStudyEvent("analysis_failed", {
    stage: "analysis",
    status: "failed",
    answeredQuestions: properties.answeredQuestions,
    totalQuestions: properties.totalQuestions,
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
  });
};

export const trackDeepDiveRequested = (topicLength: number) => {
  captureStudyEvent("deep_dive_requested", {
    stage: "analysis",
    status: "requested",
    topicLength,
  });
};

export const trackDeepDiveSucceeded = (
  durationMs: number,
  outputQuestionCount?: number,
) => {
  captureStudyEvent("deep_dive_succeeded", {
    stage: "analysis",
    status: "succeeded",
    outputQuestionCount,
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
  });
};

export const trackDeepDiveFailed = (durationMs: number) => {
  captureStudyEvent("deep_dive_failed", {
    stage: "analysis",
    status: "failed",
    durationMs,
    durationBucket: toDurationBucketMs(durationMs),
  });
};

export const trackStudyStageViewed = (
  stage: AnalyticsStage,
  properties: ProgressProperties & DocumentProperties,
) => {
  captureStudyEvent("study_stage_viewed", {
    stage,
    status: "viewed",
    documents: properties.documents,
    readyDocuments: properties.readyDocuments,
    answeredQuestions: properties.answeredQuestions,
    totalQuestions: properties.totalQuestions,
  });
};

export const trackThemeChanged = (
  previousTheme: "light" | "dark" | "system",
  nextTheme: "light" | "dark" | "system",
) => {
  captureStudyEvent("theme_changed", {
    stage: "ux",
    status: "updated",
    previousTheme,
    nextTheme,
  });
};

export const trackConsentUpdated = (consentState: string) => {
  captureStudyEvent("consent_updated", {
    stage: "ux",
    status: "updated",
    consentState,
  });
};
