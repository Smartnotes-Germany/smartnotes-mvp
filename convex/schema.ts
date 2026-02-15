import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const quizQuestionValidator = v.object({
  id: v.string(),
  topic: v.string(),
  prompt: v.string(),
  idealAnswer: v.string(),
  explanationHint: v.string(),
});

const topicInsightValidator = v.object({
  topic: v.string(),
  comfortScore: v.number(),
  rationale: v.string(),
  recommendation: v.string(),
});

const analysisValidator = v.object({
  overallReadiness: v.number(),
  strongestTopics: v.array(v.string()),
  weakestTopics: v.array(v.string()),
  topics: v.array(topicInsightValidator),
  recommendedNextStep: v.string(),
});

export default defineSchema({
  accessCodes: defineTable({
    code: v.string(),
    normalizedCode: v.string(),
    createdAt: v.number(),
    consumedAt: v.optional(v.number()),
    consumedByGrantId: v.optional(v.id("accessGrants")),
    note: v.optional(v.string()),
  }).index("by_normalizedCode", ["normalizedCode"]),

  accessGrants: defineTable({
    token: v.string(),
    accessCodeId: v.id("accessCodes"),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  }).index("by_token", ["token"]),

  studySessions: defineTable({
    grantId: v.id("accessGrants"),
    title: v.string(),
    stage: v.union(v.literal("upload"), v.literal("quiz"), v.literal("analysis")),
    round: v.number(),
    currentFocusTopic: v.optional(v.string()),
    sourceSummary: v.optional(v.string()),
    sourceTopics: v.array(v.string()),
    quizQuestions: v.array(quizQuestionValidator),
    analysis: v.optional(analysisValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_grantId", ["grantId"]),

  sessionDocuments: defineTable({
    sessionId: v.id("studySessions"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSizeBytes: v.number(),
    extractionStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    extractedText: v.optional(v.string()),
    extractionError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  quizResponses: defineTable({
    sessionId: v.id("studySessions"),
    round: v.number(),
    questionId: v.string(),
    topic: v.string(),
    prompt: v.string(),
    userAnswer: v.string(),
    isCorrect: v.boolean(),
    score: v.number(),
    explanation: v.string(),
    idealAnswer: v.string(),
    timeSpentSeconds: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session_round", ["sessionId", "round"])
    .index("by_session_round_question", ["sessionId", "round", "questionId"]),

  aiAnalyticsEvents: defineTable({
    traceId: v.string(),
    sessionId: v.id("studySessions"),
    scope: v.string(),
    status: v.union(v.literal("success"), v.literal("error")),
    modelId: v.optional(v.string()),
    fallbackUsed: v.optional(v.boolean()),
    llmAttempts: v.optional(v.number()),
    latencyMs: v.number(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    promptTokenCount: v.optional(v.number()),
    candidatesTokenCount: v.optional(v.number()),
    thoughtsTokenCount: v.optional(v.number()),
    documentPromptTokens: v.optional(v.number()),
    textPromptTokens: v.optional(v.number()),
    finishReason: v.optional(v.string()),
    totalDocuments: v.optional(v.number()),
    readyDocuments: v.optional(v.number()),
    filePartCount: v.optional(v.number()),
    sourceContextLength: v.optional(v.number()),
    outputQuestionCount: v.optional(v.number()),
    errorName: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorStackPreview: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_session_createdAt", ["sessionId", "createdAt"])
    .index("by_traceId", ["traceId"])
    .index("by_scope_createdAt", ["scope", "createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),
});
