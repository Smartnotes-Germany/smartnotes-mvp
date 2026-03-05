import { makeFunctionReference } from "convex/server";
import type { FeedbackState, GrantStatus, SessionSnapshot } from "./types";

export const redeemAccessCodeRef = makeFunctionReference<
  "mutation",
  { code: string },
  { grantToken: string }
>("access:redeemAccessCode");

export const consumeMagicLinkRef = makeFunctionReference<
  "mutation",
  { code: string },
  { grantToken: string; obfuscatedCodes: string[] }
>("access:consumeMagicLink");

export const startSessionRef = makeFunctionReference<
  "mutation",
  { grantToken: string; title?: string },
  string
>("study:startSession");

export const startQuizRef = makeFunctionReference<
  "mutation",
  { grantToken: string; sessionId: string },
  void
>("study:startQuiz");

export const generateUploadUrlRef = makeFunctionReference<
  "mutation",
  { grantToken: string; sessionId: string },
  {
    uploadUrl: string;
    uploadToken: string;
    storageId: string | null;
    storageProvider: "convex" | "r2";
    uploadTokenExpiresAt: number;
  }
>("study:generateUploadUrl");

export const registerUploadedDocumentRef = makeFunctionReference<
  "mutation",
  {
    grantToken: string;
    sessionId: string;
    uploadToken: string;
    storageId: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
  },
  string
>("study:registerUploadedDocument");

export const removeDocumentRef = makeFunctionReference<
  "mutation",
  { grantToken: string; sessionId: string; documentId: string },
  void
>("study:removeDocument");

export const validateGrantRef = makeFunctionReference<
  "query",
  { grantToken: string },
  GrantStatus
>("access:validateGrant");

export const latestSessionIdRef = makeFunctionReference<
  "query",
  { grantToken: string },
  string | null
>("study:getLatestSessionId");

export const sessionSnapshotRef = makeFunctionReference<
  "query",
  { grantToken: string; sessionId: string },
  SessionSnapshot
>("study:getSessionSnapshot");

export const extractDocumentContentRef = makeFunctionReference<
  "action",
  {
    grantToken: string;
    sessionId: string;
    documentId: string;
    clientRequestId?: string;
  },
  unknown
>("ai:extractDocumentContent");

export const generateQuizRef = makeFunctionReference<
  "action",
  {
    grantToken: string;
    sessionId: string;
    questionCount?: number;
    clientRequestId?: string;
  },
  unknown
>("ai:generateQuiz");

export const generatePdfSummaryRef = makeFunctionReference<
  "action",
  {
    grantToken: string;
    sessionId: string;
    clientRequestId?: string;
  },
  unknown
>("ai:generatePdfSummary");

export const evaluateAnswerRef = makeFunctionReference<
  "action",
  {
    grantToken: string;
    sessionId: string;
    questionId: string;
    userAnswer: string;
    timeSpentSeconds: number;
    clientRequestId?: string;
  },
  FeedbackState
>("ai:evaluateAnswer");

export const analyzePerformanceRef = makeFunctionReference<
  "action",
  {
    grantToken: string;
    sessionId: string;
    mode?: "full" | "focus";
    focusTopic?: string;
    clientRequestId?: string;
  },
  unknown
>("ai:analyzePerformance");

export const generateTopicDeepDiveRef = makeFunctionReference<
  "action",
  {
    grantToken: string;
    sessionId: string;
    topic: string;
    clientRequestId?: string;
  },
  unknown
>("ai:generateTopicDeepDive");
