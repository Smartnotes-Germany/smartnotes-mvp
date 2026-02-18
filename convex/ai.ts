"use node";

import { generateText, NoOutputGeneratedError, Output } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { parseOffice } from "officeparser";
import { z } from "zod";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  buildTelemetryConfig,
  flushTelemetry,
  getObservabilityMode,
  getTelemetryProvider,
  hashIdentifier,
  isSensitiveCaptureEnabled,
  redactTextForLog,
} from "./observability";

const MAX_EXTRACTED_TEXT_CHARS = 120_000;
const MAX_PROMPT_CONTEXT_CHARS = 90_000;

const vertexProviderOptions = {
  google: {
    thinkingConfig: {
      thinkingBudget: 0,
    },
  },
} as const;

const plainTextExtensions = new Set(["txt", "md", "markdown", "csv", "json", "yaml", "yml"]);
const vertexNativeFileExtensions = new Set(["pdf", "ppt", "pptx", "doc", "docx"]);
const vertexNativeMediaTypes = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const extensionToMediaType: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const quizGenerationSchema = z.object({
  sourceSummary: z.string(),
  topics: z.array(z.string()).min(1).max(12),
  questions: z.array(
    z.object({
      topic: z.string(),
      prompt: z.string(),
      idealAnswer: z.string(),
      explanationHint: z.string(),
    }),
  ),
});

const answerEvaluationSchema = z.object({
  isCorrect: z.boolean(),
  score: z.number().min(0).max(100),
  explanation: z.string(),
  idealAnswer: z.string(),
});

const analysisSchema = z.object({
  overallReadiness: z.number().min(0).max(100),
  strongestTopics: z.array(z.string()).min(1).max(3),
  weakestTopics: z.array(z.string()).min(1).max(3),
  topics: z.array(
    z.object({
      topic: z.string(),
      comfortScore: z.number().min(0).max(100),
      rationale: z.string(),
      recommendation: z.string(),
    }),
  ),
  recommendedNextStep: z.string(),
});

const deepDiveSchema = z.object({
  sourceSummary: z.string(),
  topics: z.array(z.string()).min(1).max(10),
  questions: z.array(
    z.object({
      topic: z.string(),
      prompt: z.string(),
      idealAnswer: z.string(),
      explanationHint: z.string(),
    }),
  ),
});

type SessionDocumentInput = {
  storageId: string;
  fileName: string;
  fileType: string;
  extractedText?: string;
  extractionStatus: "pending" | "processing" | "ready" | "failed";
};

type QuestionForEvaluation = {
  id: string;
  topic: string;
  prompt: string;
  idealAnswer: string;
  explanationHint: string;
};

type QuizGenerationResult = z.infer<typeof quizGenerationSchema>;
type AnswerEvaluationResult = z.infer<typeof answerEvaluationSchema>;
type AnalysisResult = z.infer<typeof analysisSchema>;
type DeepDiveGenerationResult = z.infer<typeof deepDiveSchema>;

const compactText = (value: string, maxChars: number) => {
  const normalized = value.replace(/\r/g, "").replace(/\t/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}\n\n[Inhalt wurde fuer die Verarbeitung gekuerzt.]`;
};

const filenameExtension = (name: string) => {
  const parts = name.toLowerCase().split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1] ?? "";
};

const decodeUtf8 = (buffer: Buffer) => new TextDecoder("utf-8").decode(buffer);

const isVertexNativeCandidate = (fileType: string, fileName: string) => {
  const extension = filenameExtension(fileName);
  return vertexNativeMediaTypes.has(fileType) || vertexNativeFileExtensions.has(extension);
};

const resolveMediaType = (fileType: string, fileName: string) => {
  if (fileType && fileType !== "application/octet-stream") {
    return fileType;
  }
  const extension = filenameExtension(fileName);
  return extensionToMediaType[extension] ?? "application/octet-stream";
};

const createVertexModel = () => {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  if (apiKey) {
    return createVertex({ apiKey });
  }

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  if (!project) {
    throw new Error(
      "Konfiguriere GOOGLE_VERTEX_API_KEY (Express Mode) oder GOOGLE_VERTEX_PROJECT + GOOGLE_VERTEX_LOCATION.",
    );
  }

  return createVertex({
    project,
    location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1",
  });
};

const extractTextFromBytes = async (fileName: string, fileType: string, fileBuffer: Buffer) => {
  const extension = filenameExtension(fileName);

  if (fileType.startsWith("text/") || plainTextExtensions.has(extension)) {
    return compactText(decodeUtf8(fileBuffer), MAX_EXTRACTED_TEXT_CHARS);
  }

  const parsedAst = await parseOffice(fileBuffer, {
    newlineDelimiter: "\n",
    ignoreNotes: false,
  });
  return compactText(parsedAst.toText(), MAX_EXTRACTED_TEXT_CHARS);
};

const buildSourceContext = (documents: Array<{ fileName: string; extractedText?: string }>) => {
  const sections: string[] = [];
  for (const [index, document] of documents.entries()) {
    if (!document.extractedText) {
      continue;
    }
    sections.push(`Dokument ${index + 1}: ${document.fileName}\n${document.extractedText}`);
  }

  return compactText(sections.join("\n\n---\n\n"), MAX_PROMPT_CONTEXT_CHARS);
};

const buildModelInputFromDocuments = async <TStorageId>(
  ctx: { storage: { getUrl: (storageId: TStorageId) => Promise<string | null> } },
  documents: Array<{
    storageId: TStorageId;
    fileName: string;
    fileType: string;
    extractedText?: string;
  }>,
) => {
  const fileParts: Array<{
    type: "file";
    data: Buffer;
    mediaType: string;
    filename: string;
  }> = [];
  const textOnlyDocuments: Array<{ fileName: string; extractedText?: string }> = [];

  for (const document of documents) {
    if (isVertexNativeCandidate(document.fileType, document.fileName)) {
      const fileUrl = await ctx.storage.getUrl(document.storageId);
      if (!fileUrl) {
        if (document.extractedText) {
          textOnlyDocuments.push({ fileName: document.fileName, extractedText: document.extractedText });
          continue;
        }
        throw new Error(`Datei konnte nicht gelesen werden: ${document.fileName}`);
      }

      const response = await fetch(fileUrl);
      if (!response.ok) {
        if (document.extractedText) {
          textOnlyDocuments.push({ fileName: document.fileName, extractedText: document.extractedText });
          continue;
        }
        throw new Error(`Datei-Download fehlgeschlagen (${response.status}) fuer ${document.fileName}`);
      }

      fileParts.push({
        type: "file",
        data: Buffer.from(await response.arrayBuffer()),
        mediaType: resolveMediaType(document.fileType, document.fileName),
        filename: document.fileName,
      });
      continue;
    }

    if (document.extractedText) {
      textOnlyDocuments.push({ fileName: document.fileName, extractedText: document.extractedText });
    }
  }

  return {
    fileParts,
    sourceContext: buildSourceContext(textOnlyDocuments),
  };
};

const buildFallbackAnalysis = (
  responses: Array<{ topic: string; score: number }>,
  focusTopic?: string,
) => {
  const grouped = new Map<string, number[]>();
  for (const response of responses) {
    const current = grouped.get(response.topic) ?? [];
    current.push(response.score);
    grouped.set(response.topic, current);
  }

  const topics = [...grouped.entries()].map(([topic, scores]) => {
    const average = scores.reduce((total, value) => total + value, 0) / Math.max(scores.length, 1);
    const comfortScore = Math.round(Math.max(0, Math.min(100, average)));
    const rationale =
      comfortScore >= 75
        ? "Sehr sichere Wissensabfrage mit praezisen Antworten."
        : comfortScore >= 50
          ? "Gemischte Leistung. Teile des Themas sitzen, aber es braucht mehr Wiederholung."
          : "Hier besteht deutlicher Lernbedarf. Konzentriere dich auf Grundkonzepte und kurze Active-Recall-Runden.";

    return {
      topic,
      comfortScore,
      rationale,
      recommendation:
        comfortScore >= 75
          ? "Mit kurzer Spaced Repetition stabil halten."
          : comfortScore >= 50
            ? "Mache eine gezielte Vertiefung mit 5-10 Abruffragen."
            : "Starte eine gefuehrte Vertiefung und wiederhole zuerst die Grundlagen.",
    };
  });

  topics.sort((a, b) => a.comfortScore - b.comfortScore);

  const overallReadiness = topics.length
    ? Math.round(topics.reduce((total, topic) => total + topic.comfortScore, 0) / topics.length)
    : 0;

  return {
    overallReadiness,
    strongestTopics: topics.slice(-3).reverse().map((topic) => topic.topic),
    weakestTopics: topics.slice(0, 3).map((topic) => topic.topic),
    topics,
    recommendedNextStep: focusTopic
      ? `Starte eine Vertiefung zu ${focusTopic} mit gezielten Uebungsfragen.`
      : "Wähle dein schwächstes Thema und beginne eine fokussierte Vertiefung.",
  };
};

const toTrimmedString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const MAX_LOG_PREVIEW_CHARS = 12_000;
const MAX_LOG_STACK_LINES = 8;
const IMPORTANT_RESPONSE_HEADER_KEYS = new Set([
  "content-type",
  "x-request-id",
  "x-goog-request-id",
  "x-goog-trace-id",
  "x-cloud-trace-context",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
]);

type UsageSnapshot = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

type VertexUsageSnapshot = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
  documentPromptTokens?: number;
  textPromptTokens?: number;
};

type PersistedAiAnalyticsStatus = "success" | "error";
type PersistedPrivacyMode = "balanced" | "full" | "off";
type PersistedTelemetryProvider = "langfuse" | "none";

type PersistedAiAnalyticsPayload = {
  traceId: string;
  sessionId: Id<"studySessions">;
  scope: string;
  status: PersistedAiAnalyticsStatus;
  privacyMode?: PersistedPrivacyMode;
  contentCaptured?: boolean;
  telemetryProvider?: PersistedTelemetryProvider;
  modelId?: string;
  fallbackUsed?: boolean;
  llmAttempts?: number;
  latencyMs: number;
  usage?: UsageSnapshot;
  vertexUsage?: VertexUsageSnapshot;
  finishReason?: string;
  totalDocuments?: number;
  readyDocuments?: number;
  filePartCount?: number;
  sourceContextLength?: number;
  outputQuestionCount?: number;
  error?: ReturnType<typeof extractErrorForLog>;
  metadata?: Record<string, unknown>;
};

const analyticsMetadataAllowlist = new Set([
  "responseCount",
  "usedFallback",
  "topic",
  "questionId",
  "round",
  "questionTopic",
  "questionScore",
  "answerLength",
  "timeSpentSeconds",
  "documentsWithoutText",
  "readyDocuments",
  "totalDocuments",
  "filePartCount",
  "sourceContextLength",
  "outputQuestionCount",
  "fallbackStrategy",
  "finishReason",
  "currentFocusTopic",
]);

const truncateForLog = (value: string, maxChars = MAX_LOG_PREVIEW_CHARS) => {
  if (value.length <= maxChars) {
    return value;
  }

  const omitted = value.length - maxChars;
  return `${value.slice(0, maxChars)}\n...[gekürzt: ${omitted} Zeichen]`;
};

const toSafeAnalyticsMetadataValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value.length > 400 ? `${value.slice(0, 400)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (typeof entry === "number" || typeof entry === "boolean") {
          return String(entry);
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry))
      .slice(0, 20)
      .join(",");
  }

  return "[object]";
};

const sanitizeAnalyticsMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(metadata)
    .filter(([key]) => analyticsMetadataAllowlist.has(key))
    .slice(0, 20)
    .map(([key, value]) => [key, toSafeAnalyticsMetadataValue(value)] as const);

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return JSON.stringify(Object.fromEntries(sanitizedEntries));
};

const buildAiSdkTelemetry = (
  functionId: string,
  sessionId: Id<"studySessions">,
  traceId: string,
  metadata?: Record<string, unknown>,
) => {
  const normalizedMetadata: Record<string, unknown> = {
    ...(metadata ?? {}),
  };

  if (normalizedMetadata.scope !== undefined && normalizedMetadata.appScope === undefined) {
    normalizedMetadata.appScope = normalizedMetadata.scope;
  }
  delete normalizedMetadata.scope;

  return buildTelemetryConfig({
    functionId,
    metadata: {
      traceId,
      sessionHash: hashIdentifier(sessionId),
      ...normalizedMetadata,
    },
  });
};

const toFiniteNumber = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
};

const extractUsage = (usage: unknown): UsageSnapshot | undefined => {
  if (typeof usage !== "object" || usage === null) {
    return undefined;
  }

  const record = usage as Record<string, unknown>;
  const normalized: UsageSnapshot = {
    inputTokens: toFiniteNumber(record.inputTokens),
    outputTokens: toFiniteNumber(record.outputTokens),
    totalTokens: toFiniteNumber(record.totalTokens),
  };

  if (
    normalized.inputTokens === undefined &&
    normalized.outputTokens === undefined &&
    normalized.totalTokens === undefined
  ) {
    return undefined;
  }

  return normalized;
};

const mergeUsage = (target: UsageSnapshot, incoming?: UsageSnapshot) => {
  if (!incoming) {
    return;
  }

  if (incoming.inputTokens !== undefined) {
    target.inputTokens = (target.inputTokens ?? 0) + incoming.inputTokens;
  }
  if (incoming.outputTokens !== undefined) {
    target.outputTokens = (target.outputTokens ?? 0) + incoming.outputTokens;
  }
  if (incoming.totalTokens !== undefined) {
    target.totalTokens = (target.totalTokens ?? 0) + incoming.totalTokens;
  }
};

const mergeVertexUsage = (target: VertexUsageSnapshot, incoming?: VertexUsageSnapshot) => {
  if (!incoming) {
    return;
  }

  if (incoming.promptTokenCount !== undefined) {
    target.promptTokenCount = (target.promptTokenCount ?? 0) + incoming.promptTokenCount;
  }
  if (incoming.candidatesTokenCount !== undefined) {
    target.candidatesTokenCount = (target.candidatesTokenCount ?? 0) + incoming.candidatesTokenCount;
  }
  if (incoming.thoughtsTokenCount !== undefined) {
    target.thoughtsTokenCount = (target.thoughtsTokenCount ?? 0) + incoming.thoughtsTokenCount;
  }
  if (incoming.totalTokenCount !== undefined) {
    target.totalTokenCount = (target.totalTokenCount ?? 0) + incoming.totalTokenCount;
  }
  if (incoming.documentPromptTokens !== undefined) {
    target.documentPromptTokens = (target.documentPromptTokens ?? 0) + incoming.documentPromptTokens;
  }
  if (incoming.textPromptTokens !== undefined) {
    target.textPromptTokens = (target.textPromptTokens ?? 0) + incoming.textPromptTokens;
  }
};

const extractResponseHeaders = (headers: unknown) => {
  if (!headers) {
    return undefined;
  }

  const extracted: Record<string, string> = {};

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (IMPORTANT_RESPONSE_HEADER_KEYS.has(lower) || lower.includes("request") || lower.includes("trace")) {
        extracted[key] = value;
      }
    });
  } else if (typeof headers === "object") {
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        IMPORTANT_RESPONSE_HEADER_KEYS.has(lower) ||
        lower.includes("request") ||
        lower.includes("trace")
      ) {
        extracted[key] = String(value);
      }
    }
  }

  if (Object.keys(extracted).length === 0) {
    return undefined;
  }

  return extracted;
};

const extractResponseForLog = (response: unknown) => {
  if (typeof response !== "object" || response === null) {
    return undefined;
  }

  const record = response as Record<string, unknown>;
  const id = toTrimmedString(record.id);

  return {
    id: id || undefined,
    modelId: toTrimmedString(record.modelId) || undefined,
    timestamp: toTrimmedString(record.timestamp) || undefined,
    headers: extractResponseHeaders(record.headers),
    hasBody: record.body !== undefined,
    hasMessages: record.messages !== undefined,
  };
};

const extractErrorForLog = (error: unknown) => {
  if (!(error instanceof Error)) {
    return {
      type: typeof error,
      valueType: Object.prototype.toString.call(error),
    };
  }

  const withUnknownFields = error as Error & Record<string, unknown>;

  return {
    name: error.name,
    message: error.message,
    stack: truncateForLog(error.stack?.split("\n").slice(0, MAX_LOG_STACK_LINES).join("\n") ?? ""),
    causeType:
      withUnknownFields.cause === undefined || withUnknownFields.cause === null
        ? undefined
        : Object.prototype.toString.call(withUnknownFields.cause),
    finishReason: toTrimmedString(withUnknownFields.finishReason) || undefined,
    usage: extractUsage(withUnknownFields.totalUsage ?? withUnknownFields.usage),
    response: extractResponseForLog(withUnknownFields.response),
  };
};

const extractUsageFromError = (error: unknown) => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  return extractUsage(record.totalUsage ?? record.usage);
};

const extractVertexUsage = (providerMetadata: unknown): VertexUsageSnapshot | undefined => {
  if (typeof providerMetadata !== "object" || providerMetadata === null) {
    return undefined;
  }

  const providerRecord = providerMetadata as Record<string, unknown>;
  const vertexRecord =
    typeof providerRecord.vertex === "object" && providerRecord.vertex !== null
      ? (providerRecord.vertex as Record<string, unknown>)
      : null;
  if (!vertexRecord) {
    return undefined;
  }

  const usageMetadata =
    typeof vertexRecord.usageMetadata === "object" && vertexRecord.usageMetadata !== null
      ? (vertexRecord.usageMetadata as Record<string, unknown>)
      : null;
  if (!usageMetadata) {
    return undefined;
  }

  const promptTokensDetails = Array.isArray(usageMetadata.promptTokensDetails)
    ? usageMetadata.promptTokensDetails
    : [];

  let documentPromptTokens = 0;
  let textPromptTokens = 0;

  for (const entry of promptTokensDetails) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const detail = entry as Record<string, unknown>;
    const modality = toTrimmedString(detail.modality).toUpperCase();
    const tokenCount = toFiniteNumber(detail.tokenCount) ?? 0;

    if (modality === "DOCUMENT") {
      documentPromptTokens += tokenCount;
    }
    if (modality === "TEXT") {
      textPromptTokens += tokenCount;
    }
  }

  const snapshot: VertexUsageSnapshot = {
    promptTokenCount: toFiniteNumber(usageMetadata.promptTokenCount),
    candidatesTokenCount: toFiniteNumber(usageMetadata.candidatesTokenCount),
    thoughtsTokenCount: toFiniteNumber(usageMetadata.thoughtsTokenCount),
    totalTokenCount: toFiniteNumber(usageMetadata.totalTokenCount),
    documentPromptTokens,
    textPromptTokens,
  };

  const hasValues = Object.values(snapshot).some((value) => value !== undefined && value !== 0);
  return hasValues ? snapshot : undefined;
};

const extractGenerationResultForLog = (result: unknown) => {
  if (typeof result !== "object" || result === null) {
    return {
      usage: undefined,
      details: {
        rawResultType: Object.prototype.toString.call(result),
      },
    };
  }

  const record = result as Record<string, unknown>;
  const usage = extractUsage(record.totalUsage ?? record.usage);
  const vertexUsage = extractVertexUsage(record.providerMetadata);

  return {
    usage,
    details: {
      finishReason: toTrimmedString(record.finishReason) || undefined,
      usage,
      warningCount: Array.isArray(record.warnings) ? record.warnings.length : undefined,
      vertexUsage,
      response: extractResponseForLog(record.response),
      stepsCount: Array.isArray(record.steps) ? record.steps.length : undefined,
    },
  };
};

const summarizeGeneratedQuiz = (generated: QuizGenerationResult | null | undefined) => {
  if (!generated) {
    return {
      hasOutput: false,
    };
  }

  return {
    hasOutput: true,
    sourceSummaryLength: generated.sourceSummary.length,
    topicsCount: generated.topics.length,
    questionsCount: generated.questions.length,
    firstTopic: generated.topics[0] ?? null,
    firstQuestionLength: generated.questions[0]?.prompt.length,
  };
};

const summarizeGeneratedDeepDive = (generated: DeepDiveGenerationResult | null | undefined) => {
  if (!generated) {
    return {
      hasOutput: false,
    };
  }

  return {
    hasOutput: true,
    sourceSummaryLength: generated.sourceSummary.length,
    topicsCount: generated.topics.length,
    questionsCount: generated.questions.length,
    firstTopic: generated.topics[0] ?? null,
    firstQuestionLength: generated.questions[0]?.prompt.length,
  };
};

const createAiTraceLogger = (scope: string, sessionId: string) => {
  const traceId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const startedAt = Date.now();
  const accumulatedUsage: UsageSnapshot = {};
  const sessionHash = hashIdentifier(sessionId);

  const log = (level: "info" | "warn" | "error", event: string, details?: Record<string, unknown>) => {
    const payload = {
      traceId,
      scope,
      sessionHash,
      event,
      elapsedMs: Date.now() - startedAt,
      usageTotals: accumulatedUsage,
      ...details,
    };

    if (level === "error") {
      console.error("[KI-Monitoring]", payload);
      return;
    }

    if (level === "warn") {
      console.warn("[KI-Monitoring]", payload);
      return;
    }

    console.log("[KI-Monitoring]", payload);
  };

  const addUsage = (usage?: UsageSnapshot) => {
    mergeUsage(accumulatedUsage, usage);
  };

  return {
    traceId,
    startedAt,
    log,
    addUsage,
    getUsageTotals: () => ({ ...accumulatedUsage }),
  };
};

const persistAiAnalyticsEvent = async (
  ctx: Pick<ActionCtx, "runMutation">,
  payload: PersistedAiAnalyticsPayload,
) => {
  try {
    const errorRecord = payload.error && typeof payload.error === "object" ? payload.error : undefined;
    const privacyMode = payload.privacyMode ?? getObservabilityMode();
    const contentCaptured = payload.contentCaptured ?? isSensitiveCaptureEnabled();
    const telemetryProvider = payload.telemetryProvider ?? getTelemetryProvider();

    await ctx.runMutation(internal.study.storeAiAnalyticsEvent, {
      traceId: payload.traceId,
      sessionId: payload.sessionId,
      scope: payload.scope,
      status: payload.status,
      privacyMode,
      contentCaptured,
      telemetryProvider,
      modelId: payload.modelId,
      fallbackUsed: payload.fallbackUsed,
      llmAttempts: payload.llmAttempts,
      latencyMs: payload.latencyMs,
      inputTokens: payload.usage?.inputTokens,
      outputTokens: payload.usage?.outputTokens,
      totalTokens: payload.usage?.totalTokens,
      promptTokenCount: payload.vertexUsage?.promptTokenCount,
      candidatesTokenCount: payload.vertexUsage?.candidatesTokenCount,
      thoughtsTokenCount: payload.vertexUsage?.thoughtsTokenCount,
      documentPromptTokens: payload.vertexUsage?.documentPromptTokens,
      textPromptTokens: payload.vertexUsage?.textPromptTokens,
      finishReason: payload.finishReason,
      totalDocuments: payload.totalDocuments,
      readyDocuments: payload.readyDocuments,
      filePartCount: payload.filePartCount,
      sourceContextLength: payload.sourceContextLength,
      outputQuestionCount: payload.outputQuestionCount,
      errorName:
        errorRecord && "name" in errorRecord && typeof errorRecord.name === "string"
          ? errorRecord.name
          : undefined,
      errorMessage:
        errorRecord && "message" in errorRecord && typeof errorRecord.message === "string"
          ? errorRecord.message
          : undefined,
      errorStackPreview:
        errorRecord && "stack" in errorRecord && typeof errorRecord.stack === "string"
          ? errorRecord.stack
          : undefined,
      metadataJson: sanitizeAnalyticsMetadata(payload.metadata),
    });
  } catch (error) {
    console.warn("[KI-Monitoring]", {
      event: "analytics_persist_failed",
      traceId: payload.traceId,
      scope: payload.scope,
      sessionHash: hashIdentifier(payload.sessionId),
      error: extractErrorForLog(error),
    });
  }
};

const parseJsonStringSafely = (value: string): unknown => {
  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const toObjectRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const pickFirstString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const candidate = toTrimmedString(record[key]);
    if (candidate) {
      return candidate;
    }
  }

  return "";
};

const normalizeQuizGenerationOutput = (value: unknown): QuizGenerationResult | null => {
  const parsedValue = typeof value === "string" ? parseJsonStringSafely(value) : value;

  const record = toObjectRecord(parsedValue);
  const rawQuestions = Array.isArray(parsedValue)
    ? parsedValue
    : Array.isArray(record?.questions)
      ? record.questions
      : Array.isArray(record?.fragen)
        ? record.fragen
        : Array.isArray(record?.quizQuestions)
          ? record.quizQuestions
          : [];

  const questions = rawQuestions
    .map((question) => {
      const questionRecord = toObjectRecord(question);
      if (!questionRecord) {
        return null;
      }

      const prompt = pickFirstString(questionRecord, [
        "prompt",
        "frage",
        "question",
        "fragestellung",
        "aufgabe",
      ]);
      const idealAnswer = pickFirstString(questionRecord, [
        "idealAnswer",
        "korrekte_antwort",
        "korrekteAntwort",
        "answer",
        "antwort",
        "lösung",
        "loesung",
      ]);

      if (!prompt || !idealAnswer) {
        return null;
      }

      return {
        topic: pickFirstString(questionRecord, ["topic", "thema", "bereich", "kapitel"]),
        prompt,
        idealAnswer,
        explanationHint:
          pickFirstString(questionRecord, [
            "explanationHint",
            "hilfe_falsche_antwort",
            "hilfe",
            "hint",
            "hinweis",
          ]) ||
          "Fokussiere dich auf die Kernbegriffe und erkläre sie in eigenen Worten.",
      };
    })
    .filter((question): question is QuizGenerationResult["questions"][number] => question !== null);

  if (questions.length === 0) {
    return null;
  }

  const rawTopics = Array.isArray(record?.topics)
    ? record.topics
    : Array.isArray(record?.themen)
      ? record.themen
      : [];
  const parsedTopics = rawTopics.map(toTrimmedString).filter((topic) => topic.length > 0);
  const inferredTopics = questions.map((question) => question.topic).filter((topic) => topic.length > 0);
  const topics = [...new Set([...parsedTopics, ...inferredTopics])].slice(0, 12);

  if (topics.length === 0) {
    topics.push("Allgemeines Verständnis");
  }

  const fallbackTopic = topics[0] ?? "Allgemeines Verständnis";

  return {
    sourceSummary:
      pickFirstString(record ?? {}, ["sourceSummary", "zusammenfassung", "summary"]) ||
      "Die wichtigsten Inhalte wurden aus dem hochgeladenen Lernmaterial zusammengefasst.",
    topics,
    questions: questions.map((question) => ({
      ...question,
      topic: question.topic || fallbackTopic,
    })),
  };
};

const isNoOutputGeneratedError = (error: unknown) =>
  NoOutputGeneratedError.isInstance(error) ||
  (typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ((error as { name?: unknown }).name === "AI_NoOutputGeneratedError" ||
      (error as { name?: unknown }).name === "AI_NoObjectGeneratedError"));

export const extractDocumentContent = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    documentId: v.id("sessionDocuments"),
  },
  handler: async (ctx, args) => {
    const trace = createAiTraceLogger("extractDocumentContent", args.sessionId);

    trace.log("info", "start", {
      documentId: args.documentId,
    });

    await ctx.runMutation(internal.study.setDocumentExtractionResult, {
      documentId: args.documentId,
      extractionStatus: "processing",
    });

    const { document } = await ctx.runQuery(internal.study.getDocumentExtractionContext, {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
      documentId: args.documentId,
    });

    trace.log("info", "context_loaded", {
      fileName: document.fileName,
      fileType: document.fileType,
      fileSizeBytes: document.fileSizeBytes,
      extractionStatus: document.extractionStatus,
      hasExtractedText: Boolean(document.extractedText),
      extractedTextLength: document.extractedText?.length ?? 0,
    });

    // Hybrid approach:
    // - Native Vertex file path for PDF/Slides/Word formats.
    // - officeparser/text extraction fallback for all other formats.
    if (isVertexNativeCandidate(document.fileType, document.fileName)) {
      trace.log("info", "skip_text_extraction_vertex_native", {
        fileName: document.fileName,
        fileType: document.fileType,
      });

      await ctx.runMutation(internal.study.setDocumentExtractionResult, {
        documentId: args.documentId,
        extractionStatus: "ready",
      });

      return {
        documentId: args.documentId,
        extractionStatus: "ready" as const,
      };
    }

    try {
      const fileUrl = await ctx.storage.getUrl(document.storageId);
      if (!fileUrl) {
        throw new Error("Auf das hochgeladene Dokument kann nicht zugegriffen werden.");
      }

      trace.log("info", "storage_url_loaded", {
        fileName: document.fileName,
        hasUrl: true,
      });

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Datei-Download fehlgeschlagen: ${response.status}`);
      }

      trace.log("info", "file_downloaded", {
        fileName: document.fileName,
        statusCode: response.status,
      });

      const fileBuffer = Buffer.from(await response.arrayBuffer());
      const extractedText = await extractTextFromBytes(document.fileName, document.fileType, fileBuffer);

      if (!extractedText) {
        throw new Error("Aus dieser Datei konnte kein Text extrahiert werden.");
      }

      trace.log("info", "text_extracted", {
        fileName: document.fileName,
        extractedLength: extractedText.length,
        extractedTextStats: redactTextForLog(extractedText),
      });

      await ctx.runMutation(internal.study.setDocumentExtractionResult, {
        documentId: args.documentId,
        extractionStatus: "ready",
        extractedText,
      });

      return {
        documentId: args.documentId,
        extractionStatus: "ready" as const,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler bei der Extraktion.";

      trace.log("error", "extraction_failed", {
        documentId: args.documentId,
        fileName: document.fileName,
        error: extractErrorForLog(error),
      });

      await ctx.runMutation(internal.study.setDocumentExtractionResult, {
        documentId: args.documentId,
        extractionStatus: "failed",
        extractionError: message,
      });

      return {
        documentId: args.documentId,
        extractionStatus: "failed" as const,
        error: message,
      };
    }
  },
});

export const generateQuiz = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    questionCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const trace = createAiTraceLogger("generateQuiz", args.sessionId);
    const analyticsModelId = "gemini-2.5-flash";
    const vertexUsageTotals: VertexUsageSnapshot = {};
    let fallbackUsed = false;
    let llmAttempts = 0;
    let finishReason: string | undefined;
    let totalDocuments = 0;
    let readyDocumentsCount = 0;
    let filePartCount = 0;
    let sourceContextLength = 0;
    let outputQuestionCount: number | undefined;
    let analyticsError: unknown;

    try {
    const desiredCount = Math.max(3, Math.min(10, Math.floor(args.questionCount ?? 6)));
    const quizInstruction = `Erstelle ${desiredCount} kurze, prüfungsnahe Fragen auf Basis des bereitgestellten Lernmaterials.

Anforderungen:
- Fragen sollen zu wahrscheinlichen Klausur-/Testfragen passen.
- Mische konzeptionelles Verständnis und Faktenabfrage.
- Antworthinweise müssen fachlich korrekt und konkret sein.
- Gib eine kurze Hilfezeile für den Fall einer falschen Antwort.`;

    trace.log("info", "start", {
      desiredCount,
      instructionLength: quizInstruction.length,
    });

    const quizContext: { documents: SessionDocumentInput[] } = await ctx.runQuery(internal.study.getQuizGenerationContext, {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
    });

    const documents = quizContext.documents;
    totalDocuments = documents.length;

    const readyDocuments = documents.filter(
      (document: SessionDocumentInput) => document.extractionStatus === "ready",
    );
    readyDocumentsCount = readyDocuments.length;

    trace.log("info", "documents_loaded", {
      totalDocuments: documents.length,
      readyDocuments: readyDocuments.length,
      documents: documents.map((document) => ({
        fileName: document.fileName,
        fileType: document.fileType,
        extractionStatus: document.extractionStatus,
        extractedTextLength: document.extractedText?.length ?? 0,
      })),
    });

    if (readyDocuments.length === 0) {
      trace.log("warn", "no_ready_documents");
      throw new Error("Lade mindestens ein Dokument hoch und verarbeite es, bevor du Quizfragen generierst.");
    }

    const model = createVertexModel();
    trace.log("info", "vertex_model_initialized", {
      modelId: "gemini-2.5-flash",
    });

    let fileParts: Array<{
      type: "file";
      data: Buffer;
      mediaType: string;
      filename: string;
    }> = [];
    let sourceContext = "";

    try {
      const modelInput = await buildModelInputFromDocuments(
        ctx,
        readyDocuments.map((document: SessionDocumentInput) => ({
          storageId: document.storageId,
          fileName: document.fileName,
          fileType: document.fileType,
          extractedText: document.extractedText,
        })),
      );
      fileParts = modelInput.fileParts;
      sourceContext = modelInput.sourceContext;
    } catch (error) {
      trace.log("error", "model_input_preparation_failed", {
        error: extractErrorForLog(error),
      });
      throw error;
    }

    trace.log("info", "model_input_prepared", {
      sourceContextLength: sourceContext.length,
      sourceContextStats: redactTextForLog(sourceContext),
      filePartCount: fileParts.length,
      fileParts: fileParts.map((part) => ({
        filename: part.filename,
        mediaType: part.mediaType,
        sizeBytes: part.data.byteLength,
      })),
    });

    filePartCount = fileParts.length;
    sourceContextLength = sourceContext.length;

    if (fileParts.length === 0 && !sourceContext) {
      trace.log("error", "no_usable_input");
      throw new Error("Es konnten keine nutzbaren Inhalte aus den hochgeladenen Dateien gelesen werden.");
    }

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: Buffer; mediaType: string; filename: string }
    > = [
      {
        type: "text",
        text: quizInstruction,
      },
    ];

    if (sourceContext) {
      userContent.push({
        type: "text",
        text: `Zusätzliche Textauszüge aus den Dateien:\n${sourceContext}`,
      });
    }

    userContent.push(...fileParts);

    let generated: QuizGenerationResult | null = null;
    const quizGenerationErrorMessage =
      "Die KI hat keine Fragen erzeugt. Bitte versuche es erneut oder lade das Dokument neu hoch.";

    try {
      trace.log("info", "llm_primary_request", {
        strategy: "structured_messages",
        temperature: 0.3,
        maxOutputTokens: 2_000,
        thinkingBudget: 0,
        sourceContextLength: sourceContext.length,
        filePartCount: fileParts.length,
      });

      llmAttempts += 1;

      const result = await generateText({
        model: model("gemini-2.5-flash"),
        temperature: 0.3,
        maxOutputTokens: 2_000,
        providerOptions: vertexProviderOptions,
        output: Output.object({
          schema: quizGenerationSchema,
        }),
        experimental_telemetry: buildAiSdkTelemetry("generateQuiz.primary", args.sessionId, trace.traceId, {
          appScope: "generateQuiz",
          stage: "primary",
          readyDocuments: readyDocuments.length,
          filePartCount: fileParts.length,
          sourceContextLength: sourceContext.length,
        }),
        system:
          "Du bist ein akademischer Tutor. Erzeuge realistische Prüfungsfragen auf Deutsch und bleibe klar und präzise.",
        messages: [{ role: "user", content: userContent }],
      });

      const resultLog = extractGenerationResultForLog(result);
      trace.addUsage(resultLog.usage);
      finishReason = resultLog.details.finishReason;
      mergeVertexUsage(vertexUsageTotals, resultLog.details.vertexUsage);
      trace.log("info", "llm_primary_response", {
        ...resultLog.details,
        outputSummary: summarizeGeneratedQuiz(result.output),
      });

      const primaryDocumentTokens = resultLog.details.vertexUsage?.documentPromptTokens ?? 0;
      if (fileParts.length > 0 && primaryDocumentTokens <= 0) {
        trace.log("warn", "no_document_tokens_detected", {
          stage: "primary",
          filePartCount: fileParts.length,
          vertexUsage: resultLog.details.vertexUsage,
        });
      }

      generated = result.output;
    } catch (error) {
      if (!isNoOutputGeneratedError(error)) {
        trace.addUsage(extractUsageFromError(error));
        trace.log("error", "llm_primary_failed", {
          error: extractErrorForLog(error),
        });
        throw error;
      }

      trace.addUsage(extractUsageFromError(error));
      trace.log("warn", "llm_primary_no_output", {
        error: extractErrorForLog(error),
      });

      fallbackUsed = true;

      try {
        if (sourceContext) {
          trace.log("info", "llm_fallback_request", {
            strategy: "structured_prompt",
            temperature: 0.2,
            maxOutputTokens: 2_000,
            thinkingBudget: 0,
            sourceContextLength: sourceContext.length,
          });

          llmAttempts += 1;

          const fallbackResult = await generateText({
            model: model("gemini-2.5-flash"),
            temperature: 0.2,
            maxOutputTokens: 2_000,
            providerOptions: vertexProviderOptions,
            output: Output.object({
              schema: quizGenerationSchema,
            }),
            experimental_telemetry: buildAiSdkTelemetry("generateQuiz.fallbackStructured", args.sessionId, trace.traceId, {
              appScope: "generateQuiz",
              stage: "fallback_structured",
              readyDocuments: readyDocuments.length,
              filePartCount: fileParts.length,
              sourceContextLength: sourceContext.length,
            }),
            system:
              "Du bist ein akademischer Tutor. Erzeuge realistische Prüfungsfragen auf Deutsch und bleibe klar und präzise.",
            prompt: `${quizInstruction}\n\nNutze ausschließlich das folgende Lernmaterial:\n${sourceContext}`,
          });

          const fallbackLog = extractGenerationResultForLog(fallbackResult);
          trace.addUsage(fallbackLog.usage);
          finishReason = fallbackLog.details.finishReason;
          mergeVertexUsage(vertexUsageTotals, fallbackLog.details.vertexUsage);
          trace.log("info", "llm_fallback_response", {
            ...fallbackLog.details,
            outputSummary: summarizeGeneratedQuiz(fallbackResult.output),
          });

          const fallbackDocumentTokens = fallbackLog.details.vertexUsage?.documentPromptTokens ?? 0;
          if (fileParts.length > 0 && fallbackDocumentTokens <= 0) {
            trace.log("warn", "no_document_tokens_detected", {
              stage: "fallback_structured",
              filePartCount: fileParts.length,
              vertexUsage: fallbackLog.details.vertexUsage,
            });
          }

          generated = fallbackResult.output;
        } else {
          trace.log("info", "llm_fallback_request", {
            strategy: "json_messages",
            temperature: 0.2,
            maxOutputTokens: 2_200,
            thinkingBudget: 0,
            sourceContextLength: 0,
          });

          llmAttempts += 1;

          const fallbackResult = await generateText({
            model: model("gemini-2.5-flash"),
            temperature: 0.2,
            maxOutputTokens: 2_200,
            providerOptions: vertexProviderOptions,
            output: Output.json(),
            experimental_telemetry: buildAiSdkTelemetry("generateQuiz.fallbackJson", args.sessionId, trace.traceId, {
              appScope: "generateQuiz",
              stage: "fallback_json",
              readyDocuments: readyDocuments.length,
              filePartCount: fileParts.length,
              sourceContextLength: sourceContext.length,
            }),
            system:
              "Du bist ein akademischer Tutor. Erzeuge realistische Prüfungsfragen auf Deutsch und antworte ausschließlich als JSON. Bevorzugtes Format: {\"sourceSummary\": string, \"topics\": string[], \"questions\": [{\"topic\": string, \"prompt\": string, \"idealAnswer\": string, \"explanationHint\": string}]}. Wenn du ein reines Array zurückgibst, verwende pro Eintrag die Felder \"frage\", \"korrekte_antwort\" und \"hilfe_falsche_antwort\".",
            messages: [{ role: "user", content: userContent }],
          });

          const fallbackLog = extractGenerationResultForLog(fallbackResult);
          trace.addUsage(fallbackLog.usage);
          finishReason = fallbackLog.details.finishReason;
          mergeVertexUsage(vertexUsageTotals, fallbackLog.details.vertexUsage);

          generated = normalizeQuizGenerationOutput(fallbackResult.output);

          trace.log("info", "llm_fallback_response", {
            ...fallbackLog.details,
            normalizedOutputSummary: summarizeGeneratedQuiz(generated),
          });

          const fallbackDocumentTokens = fallbackLog.details.vertexUsage?.documentPromptTokens ?? 0;
          if (fileParts.length > 0 && fallbackDocumentTokens <= 0) {
            trace.log("warn", "no_document_tokens_detected", {
              stage: "fallback_json",
              filePartCount: fileParts.length,
              vertexUsage: fallbackLog.details.vertexUsage,
            });
          }

          if (!generated) {
            trace.log("error", "llm_fallback_normalization_failed", {
              outputType: typeof fallbackResult.output,
            });
            throw new Error(quizGenerationErrorMessage);
          }
        }
      } catch (fallbackError) {
        if (isNoOutputGeneratedError(fallbackError)) {
          trace.addUsage(extractUsageFromError(fallbackError));
          trace.log("error", "llm_fallback_no_output", {
            error: extractErrorForLog(fallbackError),
          });
          throw new Error(quizGenerationErrorMessage);
        }

        trace.addUsage(extractUsageFromError(fallbackError));
        trace.log("error", "llm_fallback_failed", {
          error: extractErrorForLog(fallbackError),
        });

        throw fallbackError;
      }
    }

    if (!generated || generated.questions.length === 0) {
      trace.log("error", "validation_no_questions", {
        outputSummary: summarizeGeneratedQuiz(generated),
      });
      throw new Error("Die KI hat keine Fragen erzeugt. Bitte versuche es erneut.");
    }

    const normalizedQuestions = generated.questions.slice(0, desiredCount).map((question, index) => ({
      id: `${Date.now()}-${index + 1}`,
      topic: question.topic,
      prompt: question.prompt,
      idealAnswer: question.idealAnswer,
      explanationHint: question.explanationHint,
    }));

    await ctx.runMutation(internal.study.storeGeneratedQuiz, {
      sessionId: args.sessionId,
      sourceSummary: generated.sourceSummary,
      sourceTopics: generated.topics.slice(0, 10),
      quizQuestions: normalizedQuestions,
      incrementRound: false,
    });

    trace.log("info", "completed", {
      outputSummary: summarizeGeneratedQuiz(generated),
      normalizedQuestionCount: normalizedQuestions.length,
      usageTotals: trace.getUsageTotals(),
    });

    outputQuestionCount = normalizedQuestions.length;

    return {
      questionCount: normalizedQuestions.length,
    };
    } catch (error) {
      analyticsError = error;
      throw error;
    } finally {
      await persistAiAnalyticsEvent(ctx, {
        traceId: trace.traceId,
        sessionId: args.sessionId,
        scope: "generateQuiz",
        status: analyticsError ? "error" : "success",
        modelId: analyticsModelId,
        fallbackUsed,
        llmAttempts,
        latencyMs: Date.now() - trace.startedAt,
        usage: trace.getUsageTotals(),
        vertexUsage: vertexUsageTotals,
        finishReason,
        totalDocuments,
        readyDocuments: readyDocumentsCount,
        filePartCount,
        sourceContextLength,
        outputQuestionCount,
        error: analyticsError ? extractErrorForLog(analyticsError) : undefined,
      });
      await flushTelemetry({
        traceId: trace.traceId,
        appScope: "generateQuiz",
      });
    }
  },
});

export const evaluateAnswer = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    questionId: v.string(),
    userAnswer: v.string(),
    timeSpentSeconds: v.number(),
  },
  handler: async (ctx, args): Promise<AnswerEvaluationResult> => {
    const trace = createAiTraceLogger("evaluateAnswer", args.sessionId);
    const analyticsModelId = "gemini-2.5-flash";
    const vertexUsageTotals: VertexUsageSnapshot = {};
    let llmAttempts = 0;
    let finishReason: string | undefined;
    let analyticsError: unknown;

    try {

    trace.log("info", "start", {
      questionId: args.questionId,
      answerLength: args.userAnswer.length,
      timeSpentSeconds: args.timeSpentSeconds,
    });

    const evaluationContext: { round: number; question: QuestionForEvaluation } = await ctx.runQuery(
      internal.study.getQuestionForEvaluation,
      {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
      questionId: args.questionId,
      },
    );

    const { round, question } = evaluationContext;

    trace.log("info", "context_loaded", {
      round,
      topic: question.topic,
      promptLength: question.prompt.length,
      expectedAnswerLength: question.idealAnswer.length,
    });

    const model = createVertexModel();
    let generated: AnswerEvaluationResult;

    try {
      trace.log("info", "llm_request", {
        modelId: "gemini-2.5-flash",
        temperature: 0.1,
        maxOutputTokens: 800,
        thinkingBudget: 0,
      });

      llmAttempts += 1;

      const result = await generateText({
        model: model("gemini-2.5-flash"),
        temperature: 0.1,
        maxOutputTokens: 800,
        providerOptions: vertexProviderOptions,
        output: Output.object({
          schema: answerEvaluationSchema,
        }),
        experimental_telemetry: buildAiSdkTelemetry("evaluateAnswer", args.sessionId, trace.traceId, {
          appScope: "evaluateAnswer",
          round,
          questionId: args.questionId,
          questionTopic: question.topic,
        }),
        system:
          "Du bist ein fairer und unterstuetzender Pruefungs-Korrektor. Antworte auf Deutsch und erklaere kurz, was richtig ist oder fehlt.",
        prompt: `Thema: ${question.topic}
Frage: ${question.prompt}
Erwartete Antwort-Richtung: ${question.idealAnswer}
Hinweis bei Bedarf: ${question.explanationHint}

Antwort der lernenden Person:
${args.userAnswer}

Gib eine objektive Bewertung mit einem Score zwischen 0 und 100.`,
      });

      const resultLog = extractGenerationResultForLog(result);
      trace.addUsage(resultLog.usage);
      finishReason = resultLog.details.finishReason;
      mergeVertexUsage(vertexUsageTotals, resultLog.details.vertexUsage);
      trace.log("info", "llm_response", {
        ...resultLog.details,
        outputPreview: {
          isCorrect: result.output.isCorrect,
          score: result.output.score,
          explanationLength: result.output.explanation.length,
        },
      });

      generated = result.output;
    } catch (error) {
      if (isNoOutputGeneratedError(error)) {
        trace.addUsage(extractUsageFromError(error));
        trace.log("error", "llm_no_output", {
          error: extractErrorForLog(error),
        });
        throw new Error("Die KI konnte keine Auswertung erzeugen. Bitte versuche es erneut.");
      }

      trace.addUsage(extractUsageFromError(error));
      trace.log("error", "llm_failed", {
        error: extractErrorForLog(error),
      });

      throw error;
    }

    const roundedScore = Math.round(Math.max(0, Math.min(100, generated.score)));

    await ctx.runMutation(internal.study.storeQuizResponse, {
      sessionId: args.sessionId,
      round,
      questionId: question.id,
      topic: question.topic,
      prompt: question.prompt,
      userAnswer: args.userAnswer,
      isCorrect: generated.isCorrect,
      score: roundedScore,
      explanation: generated.explanation,
      idealAnswer: generated.idealAnswer,
      timeSpentSeconds: Math.max(1, Math.round(args.timeSpentSeconds)),
    });

    trace.log("info", "completed", {
      roundedScore,
      isCorrect: generated.isCorrect,
      usageTotals: trace.getUsageTotals(),
    });

    return {
      isCorrect: generated.isCorrect,
      score: roundedScore,
      explanation: generated.explanation,
      idealAnswer: generated.idealAnswer,
    };
    } catch (error) {
      analyticsError = error;
      throw error;
    } finally {
      await persistAiAnalyticsEvent(ctx, {
        traceId: trace.traceId,
        sessionId: args.sessionId,
        scope: "evaluateAnswer",
        status: analyticsError ? "error" : "success",
        modelId: analyticsModelId,
        llmAttempts,
        latencyMs: Date.now() - trace.startedAt,
        usage: trace.getUsageTotals(),
        vertexUsage: vertexUsageTotals,
        finishReason,
        error: analyticsError ? extractErrorForLog(analyticsError) : undefined,
        metadata: {
          questionId: args.questionId,
          answerLength: args.userAnswer.length,
          timeSpentSeconds: args.timeSpentSeconds,
        },
      });
      await flushTelemetry({
        traceId: trace.traceId,
        appScope: "evaluateAnswer",
      });
    }
  },
});

export const analyzePerformance = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
  },
  handler: async (ctx, args) => {
    const trace = createAiTraceLogger("analyzePerformance", args.sessionId);
    const analyticsModelId = "gemini-2.5-flash";
    const vertexUsageTotals: VertexUsageSnapshot = {};
    let llmAttempts = 0;
    let finishReason: string | undefined;
    let responseCount = 0;
    let usedFallback = false;
    let analyticsError: unknown;

    try {

    trace.log("info", "start");

    const { session, responses } = await ctx.runQuery(internal.study.getAnalysisContext, {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
    });

    trace.log("info", "context_loaded", {
      responseCount: responses.length,
      currentFocusTopic: session.currentFocusTopic ?? null,
      round: session.round,
    });
    responseCount = responses.length;

    if (responses.length === 0) {
      trace.log("warn", "no_responses_available");
      throw new Error("Beantworte mindestens eine Frage, bevor du die Analyse startest.");
    }

    const model = createVertexModel();
    const fallback = buildFallbackAnalysis(responses, session.currentFocusTopic);

    let analysis = fallback;

    try {
      trace.log("info", "llm_request", {
        modelId: "gemini-2.5-flash",
        temperature: 0.2,
        maxOutputTokens: 1_500,
        thinkingBudget: 0,
      });

      llmAttempts += 1;

      const result = await generateText({
        model: model("gemini-2.5-flash"),
        temperature: 0.2,
        maxOutputTokens: 1_500,
        providerOptions: vertexProviderOptions,
        output: Output.object({
          schema: analysisSchema,
        }),
        experimental_telemetry: buildAiSdkTelemetry("analyzePerformance", args.sessionId, trace.traceId, {
          appScope: "analyzePerformance",
          round: session.round,
          responseCount: responses.length,
          currentFocusTopic: session.currentFocusTopic ?? "",
        }),
        system:
          "Du bist ein Lerncoach. Analysiere Wissensluecken aus den Antworten und gib konkrete Empfehlungen auf Deutsch.",
        prompt: `Analysiere diese Uebungssitzung und erstelle einen themenbasierten Lernstandsbericht.

Fokus-Thema der Sitzung: ${session.currentFocusTopic ?? "kein spezielles Fokus-Thema"}
Antworten:
${JSON.stringify(responses, null, 2)}

Sei streng, aber konstruktiv.`,
      });

      const resultLog = extractGenerationResultForLog(result);
      trace.addUsage(resultLog.usage);
      finishReason = resultLog.details.finishReason;
      mergeVertexUsage(vertexUsageTotals, resultLog.details.vertexUsage);
      trace.log("info", "llm_response", {
        ...resultLog.details,
        outputPreview: {
          overallReadiness: result.output.overallReadiness,
          strongestTopics: result.output.strongestTopics,
          weakestTopics: result.output.weakestTopics,
          topicCount: result.output.topics.length,
        },
      });

      const generated: AnalysisResult = result.output;

      analysis = {
        overallReadiness: Math.round(generated.overallReadiness),
        strongestTopics: generated.strongestTopics,
        weakestTopics: generated.weakestTopics,
        topics: generated.topics.map((topic) => ({
          topic: topic.topic,
          comfortScore: Math.round(topic.comfortScore),
          rationale: topic.rationale,
          recommendation: topic.recommendation,
        })),
        recommendedNextStep: generated.recommendedNextStep,
      };
    } catch (error) {
      trace.addUsage(extractUsageFromError(error));
      usedFallback = true;
      trace.log("warn", "llm_failed_using_fallback", {
        error: extractErrorForLog(error),
        fallbackOverallReadiness: fallback.overallReadiness,
        fallbackTopicCount: fallback.topics.length,
      });
      // Keep deterministic fallback analysis when the LLM call fails.
    }

    await ctx.runMutation(internal.study.storeSessionAnalysis, {
      sessionId: args.sessionId,
      analysis,
    });

    trace.log("info", "completed", {
      usedFallback: analysis === fallback,
      overallReadiness: analysis.overallReadiness,
      topicCount: analysis.topics.length,
      usageTotals: trace.getUsageTotals(),
    });

    usedFallback = analysis === fallback;

    return analysis;
    } catch (error) {
      analyticsError = error;
      throw error;
    } finally {
      await persistAiAnalyticsEvent(ctx, {
        traceId: trace.traceId,
        sessionId: args.sessionId,
        scope: "analyzePerformance",
        status: analyticsError ? "error" : "success",
        modelId: analyticsModelId,
        fallbackUsed: usedFallback,
        llmAttempts,
        latencyMs: Date.now() - trace.startedAt,
        usage: trace.getUsageTotals(),
        vertexUsage: vertexUsageTotals,
        finishReason,
        error: analyticsError ? extractErrorForLog(analyticsError) : undefined,
        metadata: {
          responseCount,
          usedFallback,
        },
      });
      await flushTelemetry({
        traceId: trace.traceId,
        appScope: "analyzePerformance",
      });
    }
  },
});

export const generateTopicDeepDive = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    const trace = createAiTraceLogger("generateTopicDeepDive", args.sessionId);
    const analyticsModelId = "gemini-2.5-flash";
    const vertexUsageTotals: VertexUsageSnapshot = {};
    let llmAttempts = 0;
    let finishReason: string | undefined;
    let totalDocuments = 0;
    let readyDocumentsCount = 0;
    let filePartCount = 0;
    let sourceContextLength = 0;
    let outputQuestionCount: number | undefined;
    let analyticsError: unknown;

    try {

    trace.log("info", "start", {
      topic: args.topic,
    });

    const deepDiveContext: { documents: SessionDocumentInput[] } = await ctx.runQuery(
      internal.study.getQuizGenerationContext,
      {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
      },
    );

    const documents = deepDiveContext.documents;
    totalDocuments = documents.length;

    const readyDocuments = documents.filter(
      (document: SessionDocumentInput) => document.extractionStatus === "ready",
    );
    readyDocumentsCount = readyDocuments.length;

    trace.log("info", "documents_loaded", {
      totalDocuments: documents.length,
      readyDocuments: readyDocuments.length,
      documents: documents.map((document) => ({
        fileName: document.fileName,
        fileType: document.fileType,
        extractionStatus: document.extractionStatus,
        extractedTextLength: document.extractedText?.length ?? 0,
      })),
    });

    if (readyDocuments.length === 0) {
      trace.log("warn", "no_ready_documents");
      throw new Error("Es ist kein verarbeitetes Material fuer die Vertiefung verfuegbar.");
    }

    let fileParts: Array<{
      type: "file";
      data: Buffer;
      mediaType: string;
      filename: string;
    }> = [];
    let sourceContext = "";

    try {
      const modelInput = await buildModelInputFromDocuments(
        ctx,
        readyDocuments.map((document: SessionDocumentInput) => ({
          storageId: document.storageId,
          fileName: document.fileName,
          fileType: document.fileType,
          extractedText: document.extractedText,
        })),
      );

      fileParts = modelInput.fileParts;
      sourceContext = modelInput.sourceContext;
    } catch (error) {
      trace.log("error", "model_input_preparation_failed", {
        error: extractErrorForLog(error),
      });
      throw error;
    }

    trace.log("info", "model_input_prepared", {
      sourceContextLength: sourceContext.length,
      sourceContextStats: redactTextForLog(sourceContext),
      filePartCount: fileParts.length,
      fileParts: fileParts.map((part) => ({
        filename: part.filename,
        mediaType: part.mediaType,
        sizeBytes: part.data.byteLength,
      })),
    });

    filePartCount = fileParts.length;
    sourceContextLength = sourceContext.length;

    if (fileParts.length === 0 && !sourceContext) {
      trace.log("error", "no_usable_input");
      throw new Error("Es konnten keine nutzbaren Inhalte fuer die Vertiefung gelesen werden.");
    }

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: Buffer; mediaType: string; filename: string }
    > = [
      {
        type: "text",
        text: `Erstelle 5 kurze Vertiefungsfragen zu folgendem Thema: ${args.topic}

Nutze nur das bereitgestellte Lernmaterial und formuliere die Fragen prufungsnah.`,
      },
    ];

    if (sourceContext) {
      userContent.push({
        type: "text",
        text: `Zusaetzliche Textauszuege aus den Dateien:\n${sourceContext}`,
      });
    }

    userContent.push(...fileParts);

    const model = createVertexModel();
    trace.log("info", "vertex_model_initialized", {
      modelId: "gemini-2.5-flash",
    });

    let generated: DeepDiveGenerationResult;

    try {
      trace.log("info", "llm_request", {
        temperature: 0.25,
        maxOutputTokens: 1_700,
        thinkingBudget: 0,
        sourceContextLength: sourceContext.length,
        filePartCount: fileParts.length,
      });

      llmAttempts += 1;

      const result = await generateText({
        model: model("gemini-2.5-flash"),
        temperature: 0.25,
        maxOutputTokens: 1_700,
        providerOptions: vertexProviderOptions,
        output: Output.object({
          schema: deepDiveSchema,
        }),
        experimental_telemetry: buildAiSdkTelemetry("generateTopicDeepDive", args.sessionId, trace.traceId, {
          appScope: "generateTopicDeepDive",
          topic: args.topic,
          readyDocuments: readyDocuments.length,
          filePartCount: fileParts.length,
          sourceContextLength: sourceContext.length,
        }),
        system: "Du bist ein fokussierter Tutor und erstellst anspruchsvolle, aber faire Vertiefungsfragen auf Deutsch.",
        messages: [{ role: "user", content: userContent }],
      });

      const resultLog = extractGenerationResultForLog(result);
      trace.addUsage(resultLog.usage);
      finishReason = resultLog.details.finishReason;
      mergeVertexUsage(vertexUsageTotals, resultLog.details.vertexUsage);
      trace.log("info", "llm_response", {
        ...resultLog.details,
        outputSummary: summarizeGeneratedDeepDive(result.output),
      });

      const documentTokens = resultLog.details.vertexUsage?.documentPromptTokens ?? 0;
      if (fileParts.length > 0 && documentTokens <= 0) {
        trace.log("warn", "no_document_tokens_detected", {
          filePartCount: fileParts.length,
          vertexUsage: resultLog.details.vertexUsage,
        });
      }

      generated = result.output;
    } catch (error) {
      if (isNoOutputGeneratedError(error)) {
        trace.addUsage(extractUsageFromError(error));
        trace.log("error", "llm_no_output", {
          error: extractErrorForLog(error),
        });
        throw new Error("Die KI hat keine Vertiefungsfragen erzeugt. Bitte versuche es erneut.");
      }

      trace.addUsage(extractUsageFromError(error));
      trace.log("error", "llm_failed", {
        error: extractErrorForLog(error),
      });

      throw error;
    }

    if (generated.questions.length === 0) {
      trace.log("error", "validation_no_questions", {
        outputSummary: summarizeGeneratedDeepDive(generated),
      });
      throw new Error("Die KI hat keine Vertiefungsfragen erzeugt. Bitte versuche es erneut.");
    }

    const deepDiveQuestions = generated.questions.slice(0, 5).map((question, index) => ({
      id: `deep-${Date.now()}-${index + 1}`,
      topic: question.topic,
      prompt: question.prompt,
      idealAnswer: question.idealAnswer,
      explanationHint: question.explanationHint,
    }));

    await ctx.runMutation(internal.study.storeGeneratedQuiz, {
      sessionId: args.sessionId,
      sourceSummary: generated.sourceSummary,
      sourceTopics: generated.topics,
      quizQuestions: deepDiveQuestions,
      currentFocusTopic: args.topic,
      incrementRound: true,
    });

    trace.log("info", "completed", {
      outputSummary: summarizeGeneratedDeepDive(generated),
      questionCount: deepDiveQuestions.length,
      usageTotals: trace.getUsageTotals(),
    });

    outputQuestionCount = deepDiveQuestions.length;

    return {
      questionCount: deepDiveQuestions.length,
      topic: args.topic,
    };
    } catch (error) {
      analyticsError = error;
      throw error;
    } finally {
      await persistAiAnalyticsEvent(ctx, {
        traceId: trace.traceId,
        sessionId: args.sessionId,
        scope: "generateTopicDeepDive",
        status: analyticsError ? "error" : "success",
        modelId: analyticsModelId,
        llmAttempts,
        latencyMs: Date.now() - trace.startedAt,
        usage: trace.getUsageTotals(),
        vertexUsage: vertexUsageTotals,
        finishReason,
        totalDocuments,
        readyDocuments: readyDocumentsCount,
        filePartCount,
        sourceContextLength,
        outputQuestionCount,
        error: analyticsError ? extractErrorForLog(analyticsError) : undefined,
        metadata: {
          topic: args.topic,
        },
      });
      await flushTelemetry({
        traceId: trace.traceId,
        appScope: "generateTopicDeepDive",
      });
    }
  },
});
