import { api } from "../../../convex/_generated/api";

export const redeemAccessCodeRef = api.accessActions.redeemAccessCode;

export const checkAccessCodeRef = api.access.checkAccessCode;

export const storeUserRef = api.users.store;

export const viewerRef = api.users.viewer;

export const completeOnboardingRef = api.users.completeOnboarding;

export const startSessionRef = api.study.startSession;

export const generateUploadUrlRef = api.study.generateUploadUrl;

export const registerUploadedDocumentRef = api.study.registerUploadedDocument;

export const fetchLinkContentRef = api.study.fetchLinkContent;

export const removeDocumentRef = api.study.removeDocument;

export const listSessionsRef = api.study.listSessions;

export const createShareLinkRef = api.study.createShareLink;

export const sharedExamRef = api.study.getSharedExam;

export const importSharedExamRef = api.study.importSharedExam;

export const deleteSessionRef = api.study.deleteSession;

export const sessionSnapshotRef = api.study.getSessionSnapshot;

export const extractDocumentContentRef = api.ai.extractDocumentContent;

export const generateQuizRef = api.ai.generateQuiz;
export const generateFocusedQuizRef = api.ai.generateFocusedQuiz;

export const generateTopicSummaryRef = api.ai.generateTopicSummary;

export const dismissTopicSummaryRef = api.study.dismissTopicSummary;

export const createDocumentDownloadUrlRef = api.study.createDocumentDownloadUrl;

export const evaluateAnswerRef = api.ai.evaluateAnswer;

export const analyzePerformanceRef = api.ai.analyzePerformance;
