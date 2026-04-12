import type { Id } from "../../../convex/_generated/dataModel";

export type ThemePreference = "light" | "dark" | "system";
export type StudySessionId = Id<"studySessions">;
export type StudyDocumentId = Id<"sessionDocuments">;

export type StudyStage =
  | "upload"
  | "mode_selection"
  | "quiz"
  | "analysis"
  | "summary";

export type ExtractionStatus = "pending" | "processing" | "ready" | "failed";
export type ExtractionQuality = "good" | "partial" | "empty" | "failed";
export type ExtractionStrategy =
  | "plain_text"
  | "pdfjs"
  | "officeparser"
  | "native_file";

export type FeedbackState = {
  isCorrect: boolean;
  score: number;
  explanation: string;
  idealAnswer: string;
  answeredWithDontKnow?: boolean;
};

export type QuizQuestion = {
  id: string;
  topic: string;
  prompt: string;
};

export type SessionAnalysisTopic = {
  topic: string;
  comfortScore: number;
  rationale: string;
  recommendation: string;
};

export type SessionAnalysis = {
  overallReadiness: number;
  strongestTopics: string[];
  weakestTopics: string[];
  recommendedNextStep: string;
  topics: SessionAnalysisTopic[];
};

export type StudyDocument = {
  _id: StudyDocumentId;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  extractionStatus: ExtractionStatus;
  extractionError?: string;
  extractionQuality?: ExtractionQuality;
  extractionStrategy?: ExtractionStrategy;
};

export type GrantStatus = {
  valid: boolean;
  reason?: string;
  expiresAt?: number;
  analyticsDistinctId?: string;
  analyticsGrantId?: string;
  identityLabel?: string;
  identityQuality?: "email" | "app_only";
  identityEmail?: string;
  note?: string;
};

export type FormatErrorOptions = {
  fallback?: string;
  clientRequestId?: string;
};
