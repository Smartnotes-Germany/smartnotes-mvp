export type ThemePreference = "light" | "dark" | "system";

export type StudyStage = "upload" | "quiz" | "analysis";

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

export type StudySession = {
  title: string;
  stage: StudyStage;
  round: number;
  quizQuestions: QuizQuestion[];
  analysis?: SessionAnalysis;
};

export type StudyDocument = {
  _id: string;
  fileName: string;
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
