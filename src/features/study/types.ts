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

export type SummaryDefinition = {
  term: string;
  definition: string;
};

export type SummaryExample = {
  title: string;
  details: string;
};

export type SummaryTimelineEvent = {
  label: string;
  period: string;
  description: string;
};

export type SummaryComparisonTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

export type SummarySubtopic = {
  title: string;
  description: string;
  keyPoints: string[];
  examples: SummaryExample[];
};

export type SummarySection = {
  title: string;
  content?: string;
  summary?: string;
  definitions?: SummaryDefinition[];
  subtopics?: SummarySubtopic[];
  comparisonTables?: SummaryComparisonTable[];
  keyPoints?: string[];
  table?: SummaryComparisonTable;
  imageQuery?: string;
};

export type StudySummary = {
  title: string;
  overview: string;
  sections: SummarySection[];
};

export type StudyPdfSummary = {
  title: string;
  overview?: string;
  themeOverview?: string[];
  timeline?: SummaryTimelineEvent[];
  keyTakeaways?: string[];
  sections: SummarySection[];
};

export type StudySession = {
  title: string;
  stage: StudyStage;
  round: number; // Aktiver Quiz-Batch innerhalb derselben Lernsitzung.
  currentFocusTopic?: string;
  sourceSummary?: string;
  quizQuestions: QuizQuestion[];
  analysis?: SessionAnalysis;
  summary?: StudySummary;
  pdfSummary?: StudyPdfSummary;
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
