import { api } from "../../../convex/_generated/api";

export const redeemAccessCodeRef = api.accessActions.redeemAccessCode;

export const consumeMagicLinkRef = api.accessActions.consumeMagicLink;

export const startSessionRef = api.study.startSession;

export const generateUploadUrlRef = api.study.generateUploadUrl;

export const registerUploadedDocumentRef = api.study.registerUploadedDocument;

export const removeDocumentRef = api.study.removeDocument;

export const validateGrantRef = api.access.validateGrant;

export const latestSessionIdRef = api.study.getLatestSessionId;

export const sessionSnapshotRef = api.study.getSessionSnapshot;

export const extractDocumentContentRef = api.ai.extractDocumentContent;

export const generateQuizRef = api.ai.generateQuiz;
export const generateFocusedQuizRef = api.ai.generateFocusedQuiz;

export const evaluateAnswerRef = api.ai.evaluateAnswer;

export const analyzePerformanceRef = api.ai.analyzePerformance;

export const generateTopicDeepDiveRef = api.ai.generateTopicDeepDive;
