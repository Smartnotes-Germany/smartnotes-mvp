/**
 * @file schema.ts
 * @description Definiert das Datenbank-Schema für Convex.
 * Enthält Tabellen für Zugangskontrolle, Lern-Sitzungen, Dokumente und KI-Analysen.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** Validator für eine einzelne Quizfrage, die von der KI generiert wurde. */
const quizQuestionValidator = v.object({
  id: v.string(),
  topic: v.string(),
  prompt: v.string(),
  idealAnswer: v.string(),
  explanationHint: v.string(),
});

/** Validator für detaillierte Insights zu einem spezifischen Thema. */
const topicInsightValidator = v.object({
  topic: v.string(),
  comfortScore: v.number(), // Wert von 0-100
  rationale: v.string(), // Begründung des Scores
  recommendation: v.string(), // Handlungsempfehlung
});

const aiErrorCategoryValidator = v.union(
  v.literal("file_too_large"),
  v.literal("storage_fetch_failed"),
  v.literal("model_no_output"),
  v.literal("vertex_request_failed"),
  v.literal("unknown"),
);

/** Validator für das Gesamtergebnis einer Lernstandsanalyse. */
const analysisValidator = v.object({
  overallReadiness: v.number(),
  strongestTopics: v.array(v.string()),
  weakestTopics: v.array(v.string()),
  topics: v.array(topicInsightValidator),
  recommendedNextStep: v.string(),
});

export default defineSchema({
  /** Einmal-Zugangscodes (z.B. für Demos oder zeitlich begrenzten Zugriff) */
  accessCodes: defineTable({
    code: v.string(),
    normalizedCode: v.string(), // Code in Großbuchstaben zur einfachen Suche
    createdAt: v.number(),
    consumedAt: v.optional(v.number()),
    consumedByGrantId: v.optional(v.id("accessGrants")),
    note: v.optional(v.string()),
  }).index("by_normalizedCode", ["normalizedCode"]),

  /** Aktive Zugriffsberechtigungen (Tokens), die einem Browser zugeordnet sind */
  accessGrants: defineTable({
    token: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  }).index("by_token", ["token"]),

  /** Eine Lern-Sitzung, die mehrere Dokumente und mehrere Quiz-Batches umfasst. */
  studySessions: defineTable({
    grantId: v.id("accessGrants"),
    title: v.string(),
    stage: v.union(
      v.literal("upload"),
      v.literal("quiz"),
      v.literal("analysis"),
    ),
    round: v.number(), // Aktiver Quiz-Batch der Sitzung; Deep Dives erhöhen diesen Wert.
    currentFocusTopic: v.optional(v.string()), // Legacy-Feld für bestehende Sitzungen; neue Logik nutzt focusTopics.
    focusTopics: v.optional(v.array(v.string())),
    sourceSummary: v.optional(v.string()), // KI-Zusammenfassung aller Quellen
    sourceTopics: v.array(v.string()), // Alle in den Quellen erkannten Themen
    quizQuestions: v.array(quizQuestionValidator),
    analysis: v.optional(analysisValidator), // KI-Analyse des Lernfortschritts
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_grantId", ["grantId"]),

  /** Dokumente, die einer Sitzung hinzugefügt wurden (PDFs, Texte, etc.) */
  sessionDocuments: defineTable({
    sessionId: v.id("studySessions"),
    storageId: v.union(v.id("_storage"), v.string()),
    storageProvider: v.optional(v.union(v.literal("convex"), v.literal("r2"))),
    fileName: v.string(),
    fileType: v.string(),
    fileSizeBytes: v.number(),
    extractionStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    extractedText: v.optional(v.string()), // Der von der KI extrahierte Textinhalt
    extractionError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_storageProvider_createdAt", ["storageProvider", "createdAt"]),

  /** Antworten des Benutzers auf generierte Quizfragen */
  quizResponses: defineTable({
    sessionId: v.id("studySessions"),
    round: v.number(), // Quiz-Batch, zu dem diese Antwort gehört.
    questionId: v.string(),
    topic: v.string(),
    prompt: v.string(),
    userAnswer: v.string(),
    isCorrect: v.boolean(),
    score: v.number(), // Feinere Bewertung (0 bis 100)
    explanation: v.string(),
    idealAnswer: v.string(),
    timeSpentSeconds: v.number(), // Benötigte Zeit für die Beantwortung
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session_round", ["sessionId", "round"]) // Aktive Antworten eines Quiz-Batches.
    .index("by_session_round_question", ["sessionId", "round", "questionId"]) // Idempotente Bewertung pro Batch + Frage.
    .index("by_createdAt", ["createdAt"]),

  /** Observability-Daten für KI-Operationen (Tracing, Token-Usage, Latenz) */
  aiAnalyticsEvents: defineTable({
    traceId: v.string(),
    sessionId: v.id("studySessions"),
    scope: v.string(), // z.B. "quiz_generation", "answer_evaluation"
    status: v.union(v.literal("success"), v.literal("error")),
    privacyMode: v.union(
      v.literal("balanced"),
      v.literal("full"),
      v.literal("off"),
    ),
    contentCaptured: v.boolean(),
    telemetryProvider: v.union(v.literal("langfuse"), v.literal("none")),
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
    errorCategory: v.optional(aiErrorCategoryValidator),
    errorName: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorStackPreview: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_session_createdAt", ["sessionId", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_traceId", ["traceId"])
    .index("by_scope_createdAt", ["scope", "createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),
});
