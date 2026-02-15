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
});
