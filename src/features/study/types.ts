export type ThemePreference = "light" | "dark" | "system";

export type StudyStage =
  | "upload"
  | "mode_selection"
  | "quiz"
  | "analysis"
  | "summary"
  | "pdf_summary";

export type ExtractionStatus = "pending" | "processing" | "ready" | "failed";

export type FeedbackState = {
  isCorrect: boolean;
  score: number;
  explanation: string;
  idealAnswer: string;
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

export type SummarySection = {
  title: string;
  content: string;
  keyPoints: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  chart?: {
    type: "bar" | "percentage";
    data: { label: string; value: number }[];
  };
  imageQuery?: string;
};

export type StudySummary = {
  title: string;
  overview: string;
  sections: SummarySection[];
};

export type StudySession = {
  title: string;
  stage: StudyStage;
  round: number;
  currentFocusTopic?: string;
  sourceSummary?: string;
  quizQuestions: QuizQuestion[];
  analysis?: SessionAnalysis;
  summary?: StudySummary;
  pdfSummary?: {
    title: string;
    sections: Array<{
      title: string;
      content: string;
      imageUrl?: string;
    }>;
  };
};

export type StudyDocument = {
  _id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  extractionStatus: ExtractionStatus;
  extractionError?: string;
};

export type StudyResponse = {
  questionId: string;
  score: number;
};

export type StudyStats = {
  totalQuestions: number;
  answeredQuestions: number;
  readyDocuments: number;
};

export type SessionSnapshot = {
  session: StudySession;
  documents: StudyDocument[];
  responses: StudyResponse[];
  stats: StudyStats;
};

export type GrantStatus = {
  valid: boolean;
  reason?: string;
  expiresAt?: number;
};

export type FormatErrorOptions = {
  fallback?: string;
  clientRequestId?: string;
};
