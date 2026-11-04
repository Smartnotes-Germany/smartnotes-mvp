import type { Id } from "../../../convex/_generated/dataModel";
import type { GlossaryTerm } from "../../../shared/questionGlossary";

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
  glossary?: GlossaryTerm[];
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

export type TopicSummaryFigure = {
  kind: "upload";
  documentId: StudyDocumentId;
  caption: string;
};

export type TopicSummaryVisual =
  | { kind: "steps"; title: string; steps: string[] }
  | {
      kind: "comparison";
      title: string;
      columns: string[];
      rows: { label: string; values: string[] }[];
    }
  | {
      kind: "parts";
      title: string;
      parts: { label: string; detail: string }[];
    };

export type TopicSummarySection = {
  topic: string;
  blocks: { heading: string; text: string }[];
  visual?: TopicSummaryVisual;
  figure?: TopicSummaryFigure;
  example: { title: string; text: string };
};

export type TopicSummary = {
  status: "generating" | "ready" | "failed";
  focusTopics: string[];
  dismissed: boolean;
  sections: TopicSummarySection[];
  error?: string;
};

/** Eine Prüfung in der Liste auf der Startseite. */
export type ExamSummary = {
  _id: StudySessionId;
  title: string;
  stage: "upload" | "quiz" | "analysis";
  examDate?: string; // JJJJ-MM-TT
  topicCount: number;
  hasAnalysis: boolean;
  createdAt: number;
  updatedAt: number;
};

export type StudyDocument = {
  _id: StudyDocumentId;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  extractionStatus: ExtractionStatus;
  extractionError?: string;
};

export type Viewer = {
  activated: boolean;
  onboarded: boolean;
  analyticsDistinctId: string;
  analyticsUserId: string;
  identityLabel: string;
  identityQuality: "email" | "app_only";
  identityEmail?: string;
};

export type FormatErrorOptions = {
  fallback?: string;
  clientRequestId?: string;
};
