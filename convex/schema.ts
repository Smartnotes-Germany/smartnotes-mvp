/**
 * @file schema.ts
 * @description Definiert das Datenbank-Schema für Convex.
 * Enthält Tabellen für Zugangskontrolle, Lern-Sitzungen, Dokumente und KI-Analysen.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  apprenticeCountValidator,
  professionValidator,
} from "./leadValidators";
import { topicSummaryValidator } from "./topicSummaryValidators";

/** Validator für eine einzelne Quizfrage, die von der KI generiert wurde. */
const quizQuestionValidator = v.object({
  id: v.string(),
  topic: v.string(),
  prompt: v.string(),
  idealAnswer: v.string(),
  explanationHint: v.string(),
  // Fachbegriffe im Fragetext mit kurzer Erklärung (Tooltip im Quiz)
  glossary: v.optional(
    v.array(v.object({ term: v.string(), explanation: v.string() })),
  ),
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
    consumedByGrantId: v.optional(v.id("accessGrants")), // Legacy: Einlösung vor Clerk.
    consumedByUserId: v.optional(v.id("users")),
    identityLabel: v.optional(v.string()),
    identityEmail: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index("by_normalizedCode", ["normalizedCode"])
    .index("by_consumedByGrantId", ["consumedByGrantId"]),

  /** Clerk-Konten. Ein Konto wird einmalig mit einem Zugangscode freigeschaltet. */
  users: defineTable({
    tokenIdentifier: v.string(), // Stabile Kennung aus ctx.auth.getUserIdentity()
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    accessCodeId: v.optional(v.id("accessCodes")),
    activatedAt: v.optional(v.number()),
    companyName: v.optional(v.string()), // Unternehmen bzw. Ausbildungsbetrieb
    schoolChallenge: v.optional(v.string()), // Wo es in der Schule hakt, freiwillig
    onboardingCompletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  /** Legacy: Browser-Tokens aus der Zeit vor Clerk, nur noch für Admin-Werkzeuge */
  accessGrants: defineTable({
    token: v.string(),
    createdAt: v.number(),
    identityLabel: v.optional(v.string()),
    identityEmail: v.optional(v.string()),
    note: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_createdAt", ["createdAt"]),

  /** Eine Lern-Sitzung, die mehrere Dokumente und mehrere Quiz-Batches umfasst. */
  studySessions: defineTable({
    userId: v.optional(v.id("users")),
    grantId: v.optional(v.id("accessGrants")), // Legacy: Sitzungen vor Clerk.
    title: v.string(),
    examDate: v.optional(v.string()), // Prüfungstermin als JJJJ-MM-TT, freiwillig
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
    topicSummary: v.optional(topicSummaryValidator), // Zusammenfassung vor dem Quiz
    importedFromShareId: v.optional(v.id("examShares")), // Kopie aus einem geteilten Link
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_importedFromShareId", ["userId", "importedFromShareId"])
    .index("by_grantId", ["grantId"]),

  /**
   * Link, mit dem eine Prüfung geteilt wird. Wer ihn öffnet, bekommt eine
   * eigene Kopie mit Unterlagen, Themen und Fragen, aber ohne Fortschritt.
   */
  examShares: defineTable({
    sessionId: v.id("studySessions"),
    token: v.string(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_sessionId", ["sessionId"]),

  /** Dokumente, die einer Sitzung hinzugefügt wurden (PDFs, Texte, etc.) */
  sessionDocuments: defineTable({
    sessionId: v.id("studySessions"),
    storageId: v.string(),
    storageProvider: v.union(v.literal("convex"), v.literal("r2")),
    storageState: v.optional(v.literal("orphaned")),
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
    .index("by_storageProvider_createdAt", ["storageProvider", "createdAt"])
    .index("by_storageId", ["storageId"]) // Geteilte Prüfungen nutzen dieselbe Datei
    .index("by_storageState_updatedAt", ["storageState", "updatedAt"]),

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
    misunderstanding: v.optional(v.string()),
    recheckQuestionId: v.optional(v.string()),
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

  /** Persistente Outbox für Backend-PostHog-Events mit Retry-Status */
  posthogEventOutbox: defineTable({
    scope: v.string(),
    event: v.string(),
    distinctId: v.string(),
    propertiesJson: v.string(),
    personPropertiesJson: v.optional(v.string()),
    insertId: v.string(),
    deliveryStatus: v.union(
      v.literal("pending"),
      v.literal("retry"),
      v.literal("delivered"),
      v.literal("dead_letter"),
    ),
    attemptCount: v.number(),
    lastErrorMessage: v.optional(v.string()),
    nextRetryAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_deliveryStatus_nextRetryAt", ["deliveryStatus", "nextRetryAt"])
    .index("by_deliveryStatus_createdAt", ["deliveryStatus", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_scope_createdAt", ["scope", "createdAt"])
    .index("by_insertId", ["insertId"]),

  /** Anmeldungen zur Warteliste von stackprep.de (Double-Opt-in). */
  waitlistEntries: defineTable({
    email: v.string(), // Normalisiert: getrimmt und kleingeschrieben.
    status: v.union(v.literal("pending"), v.literal("confirmed")),
    consentTextVersion: v.string(), // Version des Einwilligungstexts im Formular.
    consentGivenAt: v.number(),
    confirmationTokenHash: v.optional(v.string()), // SHA-256, nie der Token selbst.
    confirmationTokenExpiresAt: v.optional(v.number()),
    confirmationIssuedAt: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    profession: v.optional(professionValidator), // Freiwillige Angabe im Formular.
    source: v.optional(v.string()), // utm_source oder Referrer beim ersten Eintrag; fehlt bei direkten Besuchen.
    campaign: v.optional(v.string()), // utm_campaign beim ersten Eintrag.
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_confirmationTokenHash", ["confirmationTokenHash"]),

  /** Anfragen von Ausbildungsbetrieben über stackprep.de. */
  companyInquiries: defineTable({
    companyName: v.string(),
    email: v.string(), // Normalisiert: getrimmt und kleingeschrieben.
    apprenticeCount: apprenticeCountValidator,
    professions: v.optional(v.string()), // Freitext aus dem Formular, zum Beispiel "FI AE, ITSE".
    consentTextVersion: v.string(), // Version des Einwilligungstexts im Formular.
    consentGivenAt: v.number(),
    source: v.string(), // utm_source oder Referrer, sonst "direkt".
    campaign: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  /** Tageszähler pro Quelle und Kampagne: Besuche, Anmeldungen, Bestätigungen und Betriebsanfragen. */
  campaignDailyStats: defineTable({
    day: v.string(), // YYYY-MM-DD in UTC.
    source: v.string(),
    campaign: v.string(), // Leer, wenn der Link keine Kampagne hatte.
    visits: v.number(),
    signups: v.number(),
    confirmations: v.number(),
    companyInquiries: v.number(),
  }).index("by_day_source_campaign", ["day", "source", "campaign"]),

  /** Rate-Limit der Formulare auf stackprep.de, ein Zähler pro gehashter IP und Zweck. */
  waitlistRateLimits: defineTable({
    key: v.string(),
    windowStartedAt: v.number(),
    count: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_windowStartedAt", ["windowStartedAt"]),
});
