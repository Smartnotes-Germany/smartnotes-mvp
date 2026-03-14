"use node";

import { generateText, NoOutputGeneratedError, Output } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { parseOffice } from "officeparser";
import { z } from "zod";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./errorTracking";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import {
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILE_LABEL,
  VERTEX_NATIVE_UPLOAD_EXTENSIONS,
  VERTEX_NATIVE_UPLOAD_MEDIA_TYPES,
  formatFileSizeMiB,
} from "../shared/uploadPolicy";
import {
  normalizeTopicKey,
  topicsMatchForFocusMode,
} from "../shared/topicMatching";
import {
  clampPercentage,
  inspectPercentageValues,
  normalizePercentageValueForScale,
  type PercentageScale,
} from "../shared/percentageNormalization";
import {
  buildTelemetryConfig,
  flushTelemetry,
  getObservabilityMode,
  getTelemetryProvider,
  hashIdentifier,
  redactTextForLog,
} from "./observability";
import { captureAiOperationCompleted } from "./posthog";
import { readOptionalEnv, readRequiredEnv } from "./env";

const MAX_EXTRACTED_TEXT_CHARS = 120_000;
const MAX_PROMPT_CONTEXT_CHARS = 90_000;
const MAX_VERTEX_INLINE_FILE_BYTES = MAX_UPLOAD_FILE_BYTES;
const MAX_VERTEX_INLINE_FILE_LABEL = MAX_UPLOAD_FILE_LABEL;
const PRE_DOWNLOAD_CONTENT_LENGTH_TOLERANCE_BYTES = 128 * 1024;
const DOWNLOAD_GRANT_TTL_MS = 5 * 60 * 1000;

const vertexProviderOptions = {
  google: {
    thinkingConfig: {
      thinkingBudget: 0,
    },
  },
} as const;

const plainTextExtensions = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "yaml",
  "yml",
]);
const vertexNativeFileExtensions = new Set<string>(
  VERTEX_NATIVE_UPLOAD_EXTENSIONS,
);
const vertexNativeMediaTypes = new Set<string>(
  VERTEX_NATIVE_UPLOAD_MEDIA_TYPES,
);

const extensionToMediaType: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
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

const percentageScoreSchema = z.number().int().min(0).max(100);
const percentageScaleSchema = z.enum(["percent", "fraction"]);
const analysisTopicOutputSchema = z.object({
  topic: z.string(),
  comfortScore: z.number().min(0).max(100),
  rationale: z.string(),
  recommendation: z.string(),
});

const analysisTopicSchema = z.object({
  topic: z.string(),
  comfortScore: percentageScoreSchema,
  rationale: z.string(),
  recommendation: z.string(),
});

const analysisOutputSchema = z.object({
  scoreUnit: percentageScaleSchema,
  overallReadiness: z.number().min(0).max(100),
  strongestTopics: z.array(z.string()).min(1).max(3),
  weakestTopics: z.array(z.string()).min(1).max(3),
  topics: z.array(analysisTopicOutputSchema),
  recommendedNextStep: z.string(),
});

const analysisSchema = z.object({
  overallReadiness: percentageScoreSchema,
  strongestTopics: z.array(z.string()).min(1).max(3),
  weakestTopics: z.array(z.string()).min(1).max(3),
  topics: z.array(analysisTopicSchema),
  recommendedNextStep: z.string(),
});

const focusTopicAnalysisOutputSchema = z.object({
  scoreUnit: percentageScaleSchema,
  comfortScore: z.number().min(0).max(100),
  rationale: z.string(),
  recommendation: z.string(),
});

const focusTopicAnalysisSchema = z.object({
  comfortScore: percentageScoreSchema,
  rationale: z.string(),
  recommendation: z.string(),
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
  _id: Id<"sessionDocuments">;
  storageId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
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
type AnalysisOutputResult = z.infer<typeof analysisOutputSchema>;
type AnalysisResult = z.infer<typeof analysisSchema>;
type AnalysisTopicInsight = z.infer<typeof analysisTopicSchema>;
type FocusTopicAnalysisOutputResult = z.infer<
  typeof focusTopicAnalysisOutputSchema
>;
type FocusTopicAnalysisResult = z.infer<typeof focusTopicAnalysisSchema>;
type DeepDiveGenerationResult = z.infer<typeof deepDiveSchema>;
type AnalysisMode = "full" | "focus";

const compactText = (value: string, maxChars: number) => {
  const normalized = value
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}\n\n[Inhalt wurde für die Verarbeitung gekürzt.]`;
};

const filenameExtension = (name: string) => {
  const parts = name.toLowerCase().split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1] ?? "";
};

const decodeUtf8 = (buffer: Buffer) => new TextDecoder("utf-8").decode(buffer);

const buildInlineFileTooLargeError = (fileName: string, sizeBytes?: number) => {
  const sizeDetail =
    sizeBytes && Number.isFinite(sizeBytes)
      ? ` (${formatFileSizeMiB(sizeBytes)})`
      : "";

  return new Error(
    `Die Datei "${fileName}"${sizeDetail} ist zu groß für die aktuelle KI-Verarbeitung (maximal ${MAX_VERTEX_INLINE_FILE_LABEL} pro Datei). Bitte verkleinere die Datei oder teile sie auf.`,
  );
};

const getOversizedInlineDocuments = (
  documents: Array<{
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
  }>,
) => {
  return documents.filter(
    (document) =>
      isVertexNativeCandidate(document.fileType, document.fileName) &&
      document.fileSizeBytes > MAX_VERTEX_INLINE_FILE_BYTES,
  );
};

const isVertexNativeCandidate = (fileType: string, fileName: string) => {
  const extension = filenameExtension(fileName);
  return (
    vertexNativeMediaTypes.has(fileType) ||
    vertexNativeFileExtensions.has(extension)
  );
};

const resolveMediaType = (fileType: string, fileName: string) => {
  if (fileType && fileType !== "application/octet-stream") {
    return fileType;
  }
  const extension = filenameExtension(fileName);
  return extensionToMediaType[extension] ?? "application/octet-stream";
};

const createDocumentReadUrl = async (
  ctx: {
    runMutation: ActionCtx["runMutation"];
    storage: { getUrl: (storageId: string) => Promise<string | null> };
  },
  storageId: string,
  accessKey?: string,
  trace?: {
    log: (
      level: "info" | "warn" | "error",
      event: string,
      details?: Record<string, unknown>,
    ) => void;
  },
) => {
  if (accessKey) {
    try {
      const downloadGrant = await ctx.runMutation(
        components.convexFilesControl.download.createDownloadGrant,
        {
          storageId,
          maxUses: 1,
          expiresAt: Date.now() + DOWNLOAD_GRANT_TTL_MS,
        },
      );

      const consumeResult = await ctx.runMutation(
        components.convexFilesControl.download.consumeDownloadGrantForUrl,
        {
          downloadToken: downloadGrant.downloadToken,
          accessKey,
        },
      );

      if (consumeResult.status === "ok" && consumeResult.downloadUrl) {
        return {
          fileUrl: consumeResult.downloadUrl,
          source: "download_grant" as const,
          status: consumeResult.status,
        };
      }

      return {
        fileUrl: await ctx.storage.getUrl(storageId),
        source: "storage" as const,
        status: consumeResult.status,
      };
    } catch (error) {
      const grantErrorDetail =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : {
              type: typeof error,
            };

      trace?.log("warn", "document_download_grant_url_failed", {
        storageId,
        grantErrorDetail,
      });

      return {
        fileUrl: await ctx.storage.getUrl(storageId),
        source: "storage" as const,
        status: "grant_error",
        grantErrorDetail,
      };
    }
  }

  return {
    fileUrl: await ctx.storage.getUrl(storageId),
    source: "storage" as const,
    status: "direct",
  };
};

const createVertexModel = () => {
  const apiKey = readOptionalEnv("GOOGLE_VERTEX_API_KEY");
  if (apiKey) {
    return createVertex({ apiKey });
  }

  const project = readRequiredEnv(
    "GOOGLE_VERTEX_PROJECT",
    "Konfiguriere GOOGLE_VERTEX_API_KEY (Express Mode) oder GOOGLE_VERTEX_PROJECT + GOOGLE_VERTEX_LOCATION.",
  );

  return createVertex({
    project,
    location: readOptionalEnv("GOOGLE_VERTEX_LOCATION") ?? "us-central1",
  });
};

const extractTextFromBytes = async (
  fileName: string,
  fileType: string,
  fileBuffer: Buffer,
) => {
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

const buildSourceContext = (
  documents: Array<{ fileName: string; extractedText?: string }>,
) => {
  const sections: string[] = [];
  for (const [index, document] of documents.entries()) {
    if (!document.extractedText) {
      continue;
    }
    sections.push(
      `Dokument ${index + 1}: ${document.fileName}\n${document.extractedText}`,
    );
  }

  return compactText(sections.join("\n\n---\n\n"), MAX_PROMPT_CONTEXT_CHARS);
};

const buildModelInputFromDocuments = async (
  ctx: {
    runMutation: ActionCtx["runMutation"];
    storage: { getUrl: (storageId: string) => Promise<string | null> };
  },
  documents: Array<{
    storageId: string;
    fileName: string;
    fileType: string;
    fileSizeBytes?: number;
    extractedText?: string;
  }>,
  accessKey?: string,
  trace?: {
    log: (
      level: "info" | "warn" | "error",
      event: string,
      details?: Record<string, unknown>,
    ) => void;
  },
) => {
  const fileParts: Array<{
    type: "file";
    data: Buffer;
    mediaType: string;
    filename: string;
  }> = [];
  const textOnlyDocuments: Array<{ fileName: string; extractedText?: string }> =
    [];

  for (const document of documents) {
    if (isVertexNativeCandidate(document.fileType, document.fileName)) {
      const fileLoadStartedAt = Date.now();
      trace?.log("info", "model_input_document_load_started", {
        fileName: document.fileName,
        fileType: document.fileType,
        fileSizeBytes: document.fileSizeBytes,
      });

      if (
        Number.isFinite(document.fileSizeBytes) &&
        (document.fileSizeBytes ?? 0) > MAX_VERTEX_INLINE_FILE_BYTES
      ) {
        trace?.log("warn", "model_input_document_size_precheck_failed", {
          fileName: document.fileName,
          fileSizeBytes: document.fileSizeBytes,
          maxInlineBytes: MAX_VERTEX_INLINE_FILE_BYTES,
        });
        throw buildInlineFileTooLargeError(
          document.fileName,
          document.fileSizeBytes,
        );
      }

      const { fileUrl, source, status, grantErrorDetail } =
        await createDocumentReadUrl(ctx, document.storageId, accessKey, trace);
      if (!fileUrl) {
        if (document.extractedText) {
          textOnlyDocuments.push({
            fileName: document.fileName,
            extractedText: document.extractedText,
          });
          continue;
        }
        throw new Error(
          `Datei konnte nicht gelesen werden: ${document.fileName}`,
        );
      }

      trace?.log("info", "model_input_document_url_loaded", {
        fileName: document.fileName,
        source,
        status,
        grantErrorDetail,
        elapsedMs: Date.now() - fileLoadStartedAt,
      });

      const response = await fetch(fileUrl);
      if (!response.ok) {
        if (document.extractedText) {
          textOnlyDocuments.push({
            fileName: document.fileName,
            extractedText: document.extractedText,
          });
          continue;
        }
        throw new Error(
          `Datei-Download fehlgeschlagen (${response.status}) für ${document.fileName}`,
        );
      }

      const contentLengthRaw = response.headers.get("content-length");
      const contentLength = contentLengthRaw
        ? Number.parseInt(contentLengthRaw, 10)
        : Number.NaN;

      trace?.log("info", "model_input_document_response_received", {
        fileName: document.fileName,
        statusCode: response.status,
        contentLength: Number.isFinite(contentLength)
          ? contentLength
          : undefined,
        elapsedMs: Date.now() - fileLoadStartedAt,
      });

      if (
        Number.isFinite(contentLength) &&
        contentLength >
          MAX_VERTEX_INLINE_FILE_BYTES +
            PRE_DOWNLOAD_CONTENT_LENGTH_TOLERANCE_BYTES
      ) {
        trace?.log("warn", "model_input_document_declared_too_large", {
          fileName: document.fileName,
          declaredSizeBytes: contentLength,
          maxInlineBytes: MAX_VERTEX_INLINE_FILE_BYTES,
          toleranceBytes: PRE_DOWNLOAD_CONTENT_LENGTH_TOLERANCE_BYTES,
        });
        throw buildInlineFileTooLargeError(document.fileName, contentLength);
      }

      const arrayBuffer = await response.arrayBuffer();
      const actualSizeBytes = arrayBuffer.byteLength;

      if (actualSizeBytes > MAX_VERTEX_INLINE_FILE_BYTES) {
        trace?.log("warn", "model_input_document_too_large", {
          fileName: document.fileName,
          actualSizeBytes,
          maxInlineBytes: MAX_VERTEX_INLINE_FILE_BYTES,
        });
        throw buildInlineFileTooLargeError(document.fileName, actualSizeBytes);
      }

      const mediaType = resolveMediaType(document.fileType, document.fileName);
      const documentBuffer = Buffer.from(arrayBuffer);

      fileParts.push({
        type: "file",
        data: documentBuffer,
        mediaType,
        filename: document.fileName,
      });

      trace?.log("info", "model_input_document_attached", {
        fileName: document.fileName,
        mediaType,
        sizeBytes: actualSizeBytes,
        elapsedMs: Date.now() - fileLoadStartedAt,
      });

      continue;
    }

    if (document.extractedText) {
      textOnlyDocuments.push({
        fileName: document.fileName,
        extractedText: document.extractedText,
      });
      continue;
    }

    const textLoadStartedAt = Date.now();
    trace?.log("info", "model_input_text_fallback_started", {
      fileName: document.fileName,
      fileType: document.fileType,
      fileSizeBytes: document.fileSizeBytes,
    });

    const { fileUrl, source, status, grantErrorDetail } =
      await createDocumentReadUrl(ctx, document.storageId, accessKey, trace);
    if (!fileUrl) {
      throw new Error(
        `Datei konnte nicht gelesen werden: ${document.fileName}`,
      );
    }

    trace?.log("info", "model_input_text_fallback_url_loaded", {
      fileName: document.fileName,
      source,
      status,
      grantErrorDetail,
      elapsedMs: Date.now() - textLoadStartedAt,
    });

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(
        `Datei-Download fehlgeschlagen (${response.status}) für ${document.fileName}`,
      );
    }

    const documentBuffer = Buffer.from(await response.arrayBuffer());
    const extractedText = await extractTextFromBytes(
      document.fileName,
      document.fileType,
      documentBuffer,
    );

    if (!extractedText) {
      throw new Error(
        `Aus dieser Datei konnte kein Text extrahiert werden: ${document.fileName}`,
      );
    }

    textOnlyDocuments.push({
      fileName: document.fileName,
      extractedText,
    });

    trace?.log("info", "model_input_text_fallback_extracted", {
      fileName: document.fileName,
      extractedLength: extractedText.length,
      elapsedMs: Date.now() - textLoadStartedAt,
    });
  }

  return {
    fileParts,
    sourceContext: buildSourceContext(textOnlyDocuments),
  };
};

const toComfortScore = clampPercentage;

type InvalidAnalysisScoreFormatError = Error & {
  details: Record<string, unknown>;
};

const createInvalidAnalysisScoreFormatError = (
  message: string,
  details: Record<string, unknown>,
): InvalidAnalysisScoreFormatError => {
  const error = new Error(message) as InvalidAnalysisScoreFormatError;
  error.name = "InvalidAnalysisScoreFormatError";
  error.details = details;
  return error;
};

const isInvalidAnalysisScoreFormatError = (
  error: unknown,
): error is InvalidAnalysisScoreFormatError =>
  error instanceof Error &&
  error.name === "InvalidAnalysisScoreFormatError" &&
  "details" in error;

const validatePercentageValuesForScale = (
  values: number[],
  scoreUnit: PercentageScale,
  label: string,
) => {
  const inspected = inspectPercentageValues(values);

  if (scoreUnit === "fraction") {
    const invalidValues = inspected.finiteValues.filter(
      (value) => value < 0 || value > 1,
    );
    if (invalidValues.length > 0) {
      throw createInvalidAnalysisScoreFormatError(
        `${label} mischt Prozent- und Bruchwerte trotz scoreUnit="fraction".`,
        {
          label,
          scoreUnit,
          invalidValues,
          inspected,
        },
      );
    }
    return;
  }

  const nonIntegerValues = inspected.finiteValues.filter(
    (value) => !Number.isInteger(value),
  );
  if (nonIntegerValues.length > 0) {
    throw createInvalidAnalysisScoreFormatError(
      `${label} enthält keine ganzen Prozentwerte trotz scoreUnit="percent".`,
      {
        label,
        scoreUnit,
        nonIntegerValues,
        inspected,
      },
    );
  }
};

const normalizeAnalysisScores = (
  analysis: AnalysisOutputResult,
): AnalysisResult => {
  const values = [
    analysis.overallReadiness,
    ...analysis.topics.map((topic) => topic.comfortScore),
  ];
  validatePercentageValuesForScale(values, analysis.scoreUnit, "full_analysis");

  return analysisSchema.parse({
    overallReadiness: normalizePercentageValueForScale(
      analysis.overallReadiness,
      analysis.scoreUnit,
    ),
    strongestTopics: analysis.strongestTopics,
    weakestTopics: analysis.weakestTopics,
    topics: analysis.topics.map((topic) => ({
      topic: topic.topic,
      comfortScore: normalizePercentageValueForScale(
        topic.comfortScore,
        analysis.scoreUnit,
      ),
      rationale: topic.rationale,
      recommendation: topic.recommendation,
    })),
    recommendedNextStep: analysis.recommendedNextStep,
  });
};

const normalizeFocusTopicScore = (
  analysis: FocusTopicAnalysisOutputResult,
): FocusTopicAnalysisResult => {
  validatePercentageValuesForScale(
    [analysis.comfortScore],
    analysis.scoreUnit,
    "focus_analysis",
  );

  return focusTopicAnalysisSchema.parse({
    comfortScore: normalizePercentageValueForScale(
      analysis.comfortScore,
      analysis.scoreUnit,
    ),
    rationale: analysis.rationale,
    recommendation: analysis.recommendation,
  });
};

const analysisScoreFormatRules = [
  'Füge ein Feld "scoreUnit" hinzu. Erlaubte Werte sind nur "percent" oder "fraction".',
  'Wenn "scoreUnit" = "percent", müssen overallReadiness und alle comfortScore-Werte ganze Zahlen zwischen 0 und 100 sein.',
  'Wenn "scoreUnit" = "fraction", müssen overallReadiness und alle comfortScore-Werte Zahlen zwischen 0 und 1 sein.',
  "Mische niemals Prozentwerte und Bruchwerte in derselben Antwort.",
];

const buildAnalysisFormatCorrectionPrompt = (
  basePrompt: string,
  error: unknown,
  invalidOutput?: unknown,
) => {
  const errorMessage =
    error instanceof Error ? error.message : "Das Ausgabeformat war ungültig.";

  return `${basePrompt}

Deine letzte Antwort war ungültig und muss korrigiert werden.
Grund: ${errorMessage}

${invalidOutput ? `Ungültige Antwort:\n${JSON.stringify(invalidOutput, null, 2)}\n\n` : ""}Pflichtregeln:
- ${analysisScoreFormatRules.join("\n- ")}

Antworte jetzt erneut und halte dich exakt an diese Regeln.`;
};

const buildTopicInsightFromScore = (
  topic: string,
  comfortScore: number,
): AnalysisTopicInsight => {
  const roundedScore = toComfortScore(comfortScore);
  const rationale =
    roundedScore >= 75
      ? "Sehr sichere Wissensabfrage mit präzisen Antworten."
      : roundedScore >= 50
        ? "Gemischte Leistung. Teile des Themas sitzen, aber es braucht mehr Wiederholung."
        : "Hier besteht deutlicher Lernbedarf. Konzentriere dich auf Grundkonzepte und kurze Active-Recall-Runden.";

  return {
    topic,
    comfortScore: roundedScore,
    rationale,
    recommendation:
      roundedScore >= 75
        ? "Mit kurzer Spaced Repetition stabil halten."
        : roundedScore >= 50
          ? "Mache eine gezielte Vertiefung mit 5-10 Abruffragen."
          : "Starte eine geführte Vertiefung und wiederhole zuerst die Grundlagen.",
  };
};

const sortTopicsByComfort = (topics: AnalysisTopicInsight[]) =>
  [...topics].sort((a, b) => a.comfortScore - b.comfortScore);

const buildRecommendedNextStep = (
  weakestTopics: string[],
  focusTopic?: string,
) => {
  const primaryWeakTopic = weakestTopics[0];
  const secondaryWeakTopic = weakestTopics[1];

  if (!primaryWeakTopic) {
    return "Wähle dein schwächstes Thema und beginne eine fokussierte Vertiefung.";
  }

  if (
    focusTopic &&
    normalizeTopicKey(primaryWeakTopic) === normalizeTopicKey(focusTopic)
  ) {
    return secondaryWeakTopic
      ? `Du hast ${focusTopic} bereits vertieft. Wechsle jetzt zu ${secondaryWeakTopic}, damit du alle Themen abdeckst.`
      : `Du hast ${focusTopic} bereits vertieft. Wechsle jetzt zu einem anderen Thema, damit du breiter lernst.`;
  }

  return `Starte als Nächstes eine Vertiefung zu ${primaryWeakTopic}.`;
};

const summarizeAnalysisTopics = (
  topics: AnalysisTopicInsight[],
  focusTopic?: string,
) => {
  const sortedTopics = sortTopicsByComfort(topics);
  const overallReadiness = sortedTopics.length
    ? Math.round(
        sortedTopics.reduce((total, topic) => total + topic.comfortScore, 0) /
          sortedTopics.length,
      )
    : 0;
  const weakestTopics = sortedTopics.slice(0, 3).map((topic) => topic.topic);
  const strongestTopics = sortedTopics
    .slice(-3)
    .reverse()
    .map((topic) => topic.topic);

  return {
    overallReadiness,
    strongestTopics,
    weakestTopics,
    recommendedNextStep: buildRecommendedNextStep(weakestTopics, focusTopic),
  };
};

const mergeTopicInsight = (
  topics: AnalysisTopicInsight[],
  updatedTopic: AnalysisTopicInsight,
) => {
  const updatedTopicKey = normalizeTopicKey(updatedTopic.topic);
  let replaced = false;

  const merged = topics.map((topic) => {
    if (normalizeTopicKey(topic.topic) !== updatedTopicKey) {
      return topic;
    }

    replaced = true;
    return {
      ...updatedTopic,
      topic: topic.topic,
    };
  });

  if (!replaced) {
    merged.push(updatedTopic);
  }

  return sortTopicsByComfort(merged);
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
    const average =
      scores.reduce((total, value) => total + value, 0) /
      Math.max(scores.length, 1);
    return buildTopicInsightFromScore(topic, average);
  });

  const summary = summarizeAnalysisTopics(topics, focusTopic);

  return {
    ...summary,
    topics: sortTopicsByComfort(topics),
  };
};

const MAX_FULL_MODE_RECENT_RESPONSES = 90;
const MAX_FULL_MODE_TOPIC_SUMMARIES = 20;
const MAX_FULL_MODE_PROMPT_CONTEXT_CHARS = 24_000;
const MAX_FULL_MODE_FIELD_PREVIEW_CHARS = 220;

type FullModeResponseContextInput = {
  round: number;
  topic: string;
  score: number;
  isCorrect: boolean;
  prompt: string;
  userAnswer: string;
  explanation: string;
  timeSpentSeconds: number;
};

const toSingleLinePreview = (value: string, maxChars: number) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars)}…`;
};

const buildFullModePromptResponseContext = (
  responses: FullModeResponseContextInput[],
) => {
  const roundsCovered = new Set<number>();
  const topicAggregates = new Map<
    string,
    {
      topic: string;
      attempts: number;
      totalScore: number;
      correctAnswers: number;
      totalTimeSeconds: number;
      latestRound: number;
      latestScore: number;
    }
  >();

  for (const response of responses) {
    roundsCovered.add(response.round);

    const topicKey = normalizeTopicKey(response.topic);
    const current = topicAggregates.get(topicKey) ?? {
      topic: response.topic,
      attempts: 0,
      totalScore: 0,
      correctAnswers: 0,
      totalTimeSeconds: 0,
      latestRound: response.round,
      latestScore: response.score,
    };

    current.attempts += 1;
    current.totalScore += response.score;
    current.correctAnswers += response.isCorrect ? 1 : 0;
    current.totalTimeSeconds += response.timeSpentSeconds;

    if (response.round >= current.latestRound) {
      current.topic = response.topic;
      current.latestRound = response.round;
      current.latestScore = response.score;
    }

    topicAggregates.set(topicKey, current);
  }

  const topicSummaries = [...topicAggregates.values()]
    .map((topic) => {
      const attempts = Math.max(1, topic.attempts);
      return {
        topic: topic.topic,
        attempts: topic.attempts,
        averageScore: Math.round(topic.totalScore / attempts),
        correctnessRate: Math.round((topic.correctAnswers / attempts) * 100),
        averageTimeSeconds: Math.round(topic.totalTimeSeconds / attempts),
        latestRound: topic.latestRound,
        latestScore: Math.round(topic.latestScore),
      };
    })
    .sort((a, b) => {
      if (a.averageScore !== b.averageScore) {
        return a.averageScore - b.averageScore;
      }
      return b.attempts - a.attempts;
    })
    .slice(0, MAX_FULL_MODE_TOPIC_SUMMARIES);

  const recentResponses = responses.slice(-MAX_FULL_MODE_RECENT_RESPONSES);
  const responsePayload = recentResponses.map((response) => ({
    round: response.round,
    topic: response.topic,
    score: response.score,
    isCorrect: response.isCorrect,
    timeSpentSeconds: response.timeSpentSeconds,
    prompt: toSingleLinePreview(
      response.prompt,
      MAX_FULL_MODE_FIELD_PREVIEW_CHARS,
    ),
    userAnswer: toSingleLinePreview(
      response.userAnswer,
      MAX_FULL_MODE_FIELD_PREVIEW_CHARS,
    ),
    explanation: toSingleLinePreview(
      response.explanation,
      MAX_FULL_MODE_FIELD_PREVIEW_CHARS,
    ),
  }));

  const serializedContext = compactText(
    JSON.stringify(
      {
        overview: {
          totalResponses: responses.length,
          includedRecentResponses: responsePayload.length,
          omittedResponses: Math.max(
            0,
            responses.length - responsePayload.length,
          ),
          roundsCovered: roundsCovered.size,
          totalTopics: topicAggregates.size,
        },
        topicSummaries,
        recentResponses: responsePayload,
      },
      null,
      2,
    ),
    MAX_FULL_MODE_PROMPT_CONTEXT_CHARS,
  );

  return {
    serializedContext,
    includedRecentResponses: responsePayload.length,
    omittedResponses: Math.max(0, responses.length - responsePayload.length),
    topicSummaryCount: topicSummaries.length,
  };
};

const toTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

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
type PersistedAiErrorCategory =
  | "file_too_large"
  | "storage_fetch_failed"
  | "model_no_output"
  | "vertex_request_failed"
  | "unknown";

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
  errorCategory?: PersistedAiErrorCategory;
  error?: ReturnType<typeof extractErrorForLog>;
  metadata?: Record<string, unknown>;
  posthogInput?: string;
  posthogOutput?: string;
  posthogProperties?: Record<string, string | number | boolean | string[]>;
};

type DocumentCorrelationMetadata = {
  documentIds?: string[];
  readyDocumentIds?: string[];
};

type PostHogFileAttachmentSummary = {
  filename: string;
  mediaType: string;
  sizeBytes: number;
};

const analyticsMetadataAllowlist = new Set([
  "clientRequestId",
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
  "documentIds",
  "readyDocumentIds",
  "fallbackStrategy",
  "finishReason",
  "currentFocusTopic",
  "analysisMode",
]);

const truncateForLog = (value: string, maxChars = MAX_LOG_PREVIEW_CHARS) => {
  if (value.length <= maxChars) {
    return value;
  }

  const omitted = value.length - maxChars;
  return `${value.slice(0, maxChars)}\n...[gekürzt: ${omitted} Zeichen]`;
};

const toSafeAnalyticsMetadataValue = (
  value: unknown,
): string | number | boolean | null => {
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

const stringifyForPostHog = (value: unknown) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const summarizeFilePartsForPostHog = (
  fileParts: Array<{
    filename: string;
    mediaType: string;
    data: Buffer;
  }>,
): PostHogFileAttachmentSummary[] =>
  fileParts.map((part) => ({
    filename: part.filename,
    mediaType: part.mediaType,
    sizeBytes: part.data.byteLength,
  }));

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

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter(
    (entry): entry is string => typeof entry === "string",
  );

  return normalized.length > 0 ? normalized : undefined;
};

const buildDocumentCorrelationMetadata = (
  documentIds: string[],
  readyDocumentIds: string[],
): DocumentCorrelationMetadata => {
  return {
    ...(documentIds.length > 0 ? { documentIds } : {}),
    ...(readyDocumentIds.length > 0 ? { readyDocumentIds } : {}),
  };
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

  if (
    normalizedMetadata.scope !== undefined &&
    normalizedMetadata.appScope === undefined
  ) {
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

const mergeVertexUsage = (
  target: VertexUsageSnapshot,
  incoming?: VertexUsageSnapshot,
) => {
  if (!incoming) {
    return;
  }

  if (incoming.promptTokenCount !== undefined) {
    target.promptTokenCount =
      (target.promptTokenCount ?? 0) + incoming.promptTokenCount;
  }
  if (incoming.candidatesTokenCount !== undefined) {
    target.candidatesTokenCount =
      (target.candidatesTokenCount ?? 0) + incoming.candidatesTokenCount;
  }
  if (incoming.thoughtsTokenCount !== undefined) {
    target.thoughtsTokenCount =
      (target.thoughtsTokenCount ?? 0) + incoming.thoughtsTokenCount;
  }
  if (incoming.totalTokenCount !== undefined) {
    target.totalTokenCount =
      (target.totalTokenCount ?? 0) + incoming.totalTokenCount;
  }
  if (incoming.documentPromptTokens !== undefined) {
    target.documentPromptTokens =
      (target.documentPromptTokens ?? 0) + incoming.documentPromptTokens;
  }
  if (incoming.textPromptTokens !== undefined) {
    target.textPromptTokens =
      (target.textPromptTokens ?? 0) + incoming.textPromptTokens;
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
      if (
        IMPORTANT_RESPONSE_HEADER_KEYS.has(lower) ||
        lower.includes("request") ||
        lower.includes("trace")
      ) {
        extracted[key] = value;
      }
    });
  } else if (typeof headers === "object") {
    for (const [key, value] of Object.entries(
      headers as Record<string, unknown>,
    )) {
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
    stack: truncateForLog(
      error.stack?.split("\n").slice(0, MAX_LOG_STACK_LINES).join("\n") ?? "",
    ),
    causeType:
      withUnknownFields.cause === undefined || withUnknownFields.cause === null
        ? undefined
        : Object.prototype.toString.call(withUnknownFields.cause),
    finishReason: toTrimmedString(withUnknownFields.finishReason) || undefined,
    usage: extractUsage(
      withUnknownFields.totalUsage ?? withUnknownFields.usage,
    ),
    response: extractResponseForLog(withUnknownFields.response),
  };
};

const classifyAiErrorCategory = (
  error: unknown,
): PersistedAiErrorCategory | undefined => {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const message = error.message.toLowerCase();
  const hasMaximalSizeHint =
    message.includes("maximal") &&
    (/(maximal\s+[\d.,]+\s*(kib|kb|mib|mb|gib|gb))/.test(message) ||
      /(maximal(?:e|er|en)?\s+(dateigröße|datei[- ]?größe|file size|größe|size))/.test(
        message,
      ) ||
      /((dateigröße|datei[- ]?größe|file size|größe|size)\s+maximal)/.test(
        message,
      ));

  if (
    message.includes("zu groß") ||
    message.includes("too large") ||
    message.includes("payload too large") ||
    message.includes("entity too large") ||
    hasMaximalSizeHint
  ) {
    return "file_too_large";
  }

  if (
    message.includes("datei konnte nicht gelesen werden") ||
    message.includes("datei-download fehlgeschlagen") ||
    message.includes("kann nicht zugegriffen") ||
    message.includes("storage")
  ) {
    return "storage_fetch_failed";
  }

  if (
    message.includes("keine fragen erzeugt") ||
    message.includes("keine vertiefungsfragen erzeugt") ||
    message.includes("no output")
  ) {
    return "model_no_output";
  }

  if (
    message.includes("vertex") ||
    message.includes("generatecontent") ||
    message.includes("quota") ||
    message.includes("ratelimit") ||
    message.includes("rate limit")
  ) {
    return "vertex_request_failed";
  }

  return "unknown";
};

const extractUsageFromError = (error: unknown) => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  return extractUsage(record.totalUsage ?? record.usage);
};

const extractVertexUsage = (
  providerMetadata: unknown,
): VertexUsageSnapshot | undefined => {
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
    typeof vertexRecord.usageMetadata === "object" &&
    vertexRecord.usageMetadata !== null
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

  const hasValues = Object.values(snapshot).some(
    (value) => value !== undefined && value !== 0,
  );
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
      warningCount: Array.isArray(record.warnings)
        ? record.warnings.length
        : undefined,
      vertexUsage,
      response: extractResponseForLog(record.response),
      stepsCount: Array.isArray(record.steps) ? record.steps.length : undefined,
    },
  };
};

const summarizeGeneratedQuiz = (
  generated: QuizGenerationResult | null | undefined,
) => {
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

const summarizeGeneratedDeepDive = (
  generated: DeepDiveGenerationResult | null | undefined,
) => {
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

const createAiTraceLogger = (
  scope: string,
  sessionId: string,
  clientRequestId?: string,
) => {
  const traceId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const startedAt = Date.now();
  const accumulatedUsage: UsageSnapshot = {};
  const sessionHash = hashIdentifier(sessionId);

  const log = (
    level: "info" | "warn" | "error",
    event: string,
    details?: Record<string, unknown>,
  ) => {
    const payload = {
      traceId,
      scope,
      sessionHash,
      ...(clientRequestId ? { clientRequestId } : {}),
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
    const errorRecord =
      payload.error && typeof payload.error === "object"
        ? payload.error
        : undefined;
    const privacyMode = payload.privacyMode ?? getObservabilityMode();
    const contentCaptured = payload.contentCaptured ?? true;
    const telemetryProvider =
      payload.telemetryProvider ?? getTelemetryProvider();

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
      errorCategory: payload.errorCategory,
      errorName:
        errorRecord &&
        "name" in errorRecord &&
        typeof errorRecord.name === "string"
          ? errorRecord.name
          : undefined,
      errorMessage:
        errorRecord &&
        "message" in errorRecord &&
        typeof errorRecord.message === "string"
          ? errorRecord.message
          : undefined,
      errorStackPreview:
        errorRecord &&
        "stack" in errorRecord &&
        typeof errorRecord.stack === "string"
          ? errorRecord.stack
          : undefined,
      metadataJson: sanitizeAnalyticsMetadata(payload.metadata),
    });

    const sessionHash = hashIdentifier(payload.sessionId);

    await captureAiOperationCompleted({
      distinctId: `session_${sessionHash}`,
      traceId: payload.traceId,
      scope: payload.scope,
      status: payload.status,
      latencyMs: payload.latencyMs,
      inputTokens: payload.usage?.inputTokens,
      outputTokens: payload.usage?.outputTokens,
      totalTokens: payload.usage?.totalTokens,
      llmAttempts: payload.llmAttempts,
      fallbackUsed: payload.fallbackUsed,
      telemetryProvider,
      privacyMode,
      modelId: payload.modelId,
      finishReason: payload.finishReason,
      totalDocuments: payload.totalDocuments,
      readyDocuments: payload.readyDocuments,
      filePartCount: payload.filePartCount,
      sourceContextLength: payload.sourceContextLength,
      outputQuestionCount: payload.outputQuestionCount,
      errorCategory: payload.errorCategory,
      errorName:
        errorRecord &&
        "name" in errorRecord &&
        typeof errorRecord.name === "string"
          ? errorRecord.name
          : undefined,
      errorMessage:
        errorRecord &&
        "message" in errorRecord &&
        typeof errorRecord.message === "string"
          ? errorRecord.message
          : undefined,
      errorStackPreview:
        errorRecord &&
        "stack" in errorRecord &&
        typeof errorRecord.stack === "string"
          ? errorRecord.stack
          : undefined,
      contentCaptured,
      input: payload.posthogInput,
      output: payload.posthogOutput,
      documentIds: toStringArray(payload.metadata?.documentIds),
      readyDocumentIds: toStringArray(payload.metadata?.readyDocumentIds),
      extraProperties: payload.posthogProperties,
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

const normalizeQuizGenerationOutput = (
  value: unknown,
): QuizGenerationResult | null => {
  const parsedValue =
    typeof value === "string" ? parseJsonStringSafely(value) : value;

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
        topic: pickFirstString(questionRecord, [
          "topic",
          "thema",
          "bereich",
          "kapitel",
        ]),
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
    .filter(
      (question): question is QuizGenerationResult["questions"][number] =>
        question !== null,
    );

  if (questions.length === 0) {
    return null;
  }

  const rawTopics = Array.isArray(record?.topics)
    ? record.topics
    : Array.isArray(record?.themen)
      ? record.themen
      : [];
  const parsedTopics = rawTopics
    .map(toTrimmedString)
    .filter((topic) => topic.length > 0);
  const inferredTopics = questions
    .map((question) => question.topic)
    .filter((topic) => topic.length > 0);
  const topics = [...new Set([...parsedTopics, ...inferredTopics])].slice(
    0,
    12,
  );

  if (topics.length === 0) {
    topics.push("Allgemeines Verständnis");
  }

  const fallbackTopic = topics[0] ?? "Allgemeines Verständnis";

  return {
    sourceSummary:
      pickFirstString(record ?? {}, [
        "sourceSummary",
        "zusammenfassung",
        "summary",
      ]) ||
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
    clientRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trace = createAiTraceLogger(
      "extractDocumentContent",
      args.sessionId,
      args.clientRequestId,
    );

    trace.log("info", "start", {
      documentId: args.documentId,
    });

    await ctx.runMutation(internal.study.setDocumentExtractionResult, {
      documentId: args.documentId,
      extractionStatus: "processing",
    });

    const extractionContext: {
      document: SessionDocumentInput;
      accessKey?: string;
    } = await ctx.runQuery(internal.study.getDocumentExtractionContext, {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
      documentId: args.documentId,
    });
    const document = extractionContext.document;
    const accessKey = extractionContext.accessKey;

    trace.log("info", "context_loaded", {
      fileName: document.fileName,
      fileType: document.fileType,
      fileSizeBytes: document.fileSizeBytes,
      extractionStatus: document.extractionStatus,
      hasExtractedText: Boolean(document.extractedText),
      extractedTextLength: document.extractedText?.length ?? 0,
    });

    // Hybrid approach:
    // - Native Vertex file path for PDF/image formats supported by Gemini.
    // - officeparser/text extraction fallback for Office/text formats.
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
      const { fileUrl, source, status, grantErrorDetail } =
        await createDocumentReadUrl(ctx, document.storageId, accessKey, trace);
      if (!fileUrl) {
        throw new Error(
          "Auf das hochgeladene Dokument kann nicht zugegriffen werden.",
        );
      }

      trace.log("info", "document_url_loaded", {
        fileName: document.fileName,
        hasUrl: true,
        source,
        status,
        grantErrorDetail,
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
      const extractedText = await extractTextFromBytes(
        document.fileName,
        document.fileType,
        fileBuffer,
      );

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
      const message =
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler bei der Extraktion.";

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
    clientRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trace = createAiTraceLogger(
      "generateQuiz",
      args.sessionId,
      args.clientRequestId,
    );
    const analyticsModelId = "gemini-3-flash-preview";
    const vertexUsageTotals: VertexUsageSnapshot = {};
    let fallbackUsed = false;
    let llmAttempts = 0;
    let finishReason: string | undefined;
    let totalDocuments = 0;
    let readyDocumentsCount = 0;
    let documentIds: string[] = [];
    let readyDocumentIds: string[] = [];
    let documentCorrelationMetadata: DocumentCorrelationMetadata = {};
    let filePartCount = 0;
    let sourceContextLength = 0;
    let outputQuestionCount: number | undefined;
    let desiredCount = 6;
    let sourceContext = "";
    let generatedQuiz: QuizGenerationResult | null = null;
    let normalizedQuestions: QuestionForEvaluation[] = [];
    let filePartSummaries: PostHogFileAttachmentSummary[] = [];
    let analyticsError: unknown;

    try {
      desiredCount = Math.max(
        3,
        Math.min(10, Math.floor(args.questionCount ?? 6)),
      );
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

      const quizContext: {
        documents: SessionDocumentInput[];
        accessKey?: string;
      } = await ctx.runQuery(internal.study.getQuizGenerationContext, {
        grantToken: args.grantToken,
        sessionId: args.sessionId,
      });

      const documents = quizContext.documents;
      const accessKey = quizContext.accessKey;
      totalDocuments = documents.length;

      const readyDocuments = documents.filter(
        (document: SessionDocumentInput) =>
          document.extractionStatus === "ready",
      );
      readyDocumentsCount = readyDocuments.length;
      documentIds = documents.map((document) => String(document._id));
      readyDocumentIds = readyDocuments.map((document) => String(document._id));
      documentCorrelationMetadata = buildDocumentCorrelationMetadata(
        documentIds,
        readyDocumentIds,
      );

      trace.log("info", "documents_loaded", {
        totalDocuments: documents.length,
        readyDocuments: readyDocuments.length,
        documents: documents.map((document) => ({
          documentId: document._id,
          fileName: document.fileName,
          fileType: document.fileType,
          fileSizeBytes: document.fileSizeBytes,
          extractionStatus: document.extractionStatus,
          extractedTextLength: document.extractedText?.length ?? 0,
        })),
      });

      if (readyDocuments.length === 0) {
        trace.log("warn", "no_ready_documents");
        throw new Error(
          "Lade mindestens ein Dokument hoch und verarbeite es, bevor du Quizfragen generierst.",
        );
      }

      const oversizedDocuments = getOversizedInlineDocuments(readyDocuments);
      if (oversizedDocuments.length > 0) {
        trace.log("warn", "oversized_documents_blocked", {
          oversizedCount: oversizedDocuments.length,
          maxInlineBytes: MAX_VERTEX_INLINE_FILE_BYTES,
          files: oversizedDocuments.map((document) => ({
            fileName: document.fileName,
            fileSizeBytes: document.fileSizeBytes,
          })),
        });

        const filesPreview = oversizedDocuments
          .slice(0, 3)
          .map((document) => document.fileName)
          .join(", ");
        const suffix = oversizedDocuments.length > 3 ? " ..." : "";

        throw new Error(
          `Mindestens eine Datei ist für die aktuelle KI-Verarbeitung zu groß (maximal ${MAX_VERTEX_INLINE_FILE_LABEL}). Bitte verkleinere die Datei oder teile sie auf: ${filesPreview}${suffix}`,
        );
      }

      const model = createVertexModel();
      trace.log("info", "vertex_model_initialized", {
        modelId: "gemini-3-flash-preview",
      });

      let fileParts: Array<{
        type: "file";
        data: Buffer;
        mediaType: string;
        filename: string;
      }> = [];

      try {
        const modelInput = await buildModelInputFromDocuments(
          ctx,
          readyDocuments.map((document: SessionDocumentInput) => ({
            storageId: document.storageId,
            fileName: document.fileName,
            fileType: document.fileType,
            fileSizeBytes: document.fileSizeBytes,
            extractedText: document.extractedText,
          })),
          accessKey,
          trace,
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
      filePartSummaries = summarizeFilePartsForPostHog(fileParts);

      if (fileParts.length === 0 && !sourceContext) {
        trace.log("error", "no_usable_input");
        throw new Error(
          "Es konnten keine nutzbaren Inhalte aus den hochgeladenen Dateien gelesen werden.",
        );
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
          model: model("gemini-3-flash-preview"),
          temperature: 0.3,
          maxOutputTokens: 2_000,
          providerOptions: vertexProviderOptions,
          output: Output.object({
            schema: quizGenerationSchema,
          }),
          experimental_telemetry: buildAiSdkTelemetry(
            "generateQuiz.primary",
            args.sessionId,
            trace.traceId,
            {
              appScope: "generateQuiz",
              stage: "primary",
              readyDocuments: readyDocuments.length,
              ...documentCorrelationMetadata,
              filePartCount: fileParts.length,
              sourceContextLength: sourceContext.length,
            },
          ),
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

        const primaryDocumentTokens =
          resultLog.details.vertexUsage?.documentPromptTokens ?? 0;
        if (fileParts.length > 0 && primaryDocumentTokens <= 0) {
          trace.log("warn", "no_document_tokens_detected", {
            stage: "primary",
            filePartCount: fileParts.length,
            vertexUsage: resultLog.details.vertexUsage,
          });
        }

        generated = result.output;
        generatedQuiz = result.output;
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
              model: model("gemini-3-flash-preview"),
              temperature: 0.2,
              maxOutputTokens: 2_000,
              providerOptions: vertexProviderOptions,
              output: Output.object({
                schema: quizGenerationSchema,
              }),
              experimental_telemetry: buildAiSdkTelemetry(
                "generateQuiz.fallbackStructured",
                args.sessionId,
                trace.traceId,
                {
                  appScope: "generateQuiz",
                  stage: "fallback_structured",
                  readyDocuments: readyDocuments.length,
                  ...documentCorrelationMetadata,
                  filePartCount: fileParts.length,
                  sourceContextLength: sourceContext.length,
                },
              ),
              system:
                "Du bist ein akademischer Tutor. Erzeuge realistische Prüfungsfragen auf Deutsch und bleibe klar und präzise.",
              prompt: `${quizInstruction}\n\nNutze ausschließlich das folgende Lernmaterial:\n${sourceContext}`,
            });

            const fallbackLog = extractGenerationResultForLog(fallbackResult);
            trace.addUsage(fallbackLog.usage);
            finishReason = fallbackLog.details.finishReason;
            mergeVertexUsage(
              vertexUsageTotals,
              fallbackLog.details.vertexUsage,
            );
            trace.log("info", "llm_fallback_response", {
              ...fallbackLog.details,
              outputSummary: summarizeGeneratedQuiz(fallbackResult.output),
            });

            const fallbackDocumentTokens =
              fallbackLog.details.vertexUsage?.documentPromptTokens ?? 0;
            if (fileParts.length > 0 && fallbackDocumentTokens <= 0) {
              trace.log("warn", "no_document_tokens_detected", {
                stage: "fallback_structured",
                filePartCount: fileParts.length,
                vertexUsage: fallbackLog.details.vertexUsage,
              });
            }

            generated = fallbackResult.output;
            generatedQuiz = fallbackResult.output;
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
              model: model("gemini-3-flash-preview"),
              temperature: 0.2,
              maxOutputTokens: 2_200,
              providerOptions: vertexProviderOptions,
              output: Output.json(),
              experimental_telemetry: buildAiSdkTelemetry(
                "generateQuiz.fallbackJson",
                args.sessionId,
                trace.traceId,
                {
                  appScope: "generateQuiz",
                  stage: "fallback_json",
                  readyDocuments: readyDocuments.length,
                  ...documentCorrelationMetadata,
                  filePartCount: fileParts.length,
                  sourceContextLength: sourceContext.length,
                },
              ),
              system:
                'Du bist ein akademischer Tutor. Erzeuge realistische Prüfungsfragen auf Deutsch und antworte ausschließlich als JSON. Bevorzugtes Format: {"sourceSummary": string, "topics": string[], "questions": [{"topic": string, "prompt": string, "idealAnswer": string, "explanationHint": string}]}. Wenn du ein reines Array zurückgibst, verwende pro Eintrag die Felder "frage", "korrekte_antwort" und "hilfe_falsche_antwort".',
              messages: [{ role: "user", content: userContent }],
            });

            const fallbackLog = extractGenerationResultForLog(fallbackResult);
            trace.addUsage(fallbackLog.usage);
            finishReason = fallbackLog.details.finishReason;
            mergeVertexUsage(
              vertexUsageTotals,
              fallbackLog.details.vertexUsage,
            );

            generated = normalizeQuizGenerationOutput(fallbackResult.output);
            generatedQuiz = generated;

            trace.log("info", "llm_fallback_response", {
              ...fallbackLog.details,
              normalizedOutputSummary: summarizeGeneratedQuiz(generated),
            });

            const fallbackDocumentTokens =
              fallbackLog.details.vertexUsage?.documentPromptTokens ?? 0;
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
        throw new Error(
          "Die KI hat keine Fragen erzeugt. Bitte versuche es erneut.",
        );
      }

      normalizedQuestions = generated.questions
        .slice(0, desiredCount)
        .map((question, index) => ({
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
        errorCategory: analyticsError
          ? classifyAiErrorCategory(analyticsError)
          : undefined,
        error: analyticsError ? extractErrorForLog(analyticsError) : undefined,
        metadata: {
          clientRequestId: args.clientRequestId,
          ...documentCorrelationMetadata,
        },
        posthogInput: stringifyForPostHog({
          desiredCount,
          sourceContext,
          attachedFiles: filePartSummaries,
        }),
        posthogOutput: stringifyForPostHog({
          generatedQuiz,
          normalizedQuestions,
        }),
        posthogProperties: {
          requestedQuestionCount: desiredCount,
          sourceContext,
          attachedFiles: stringifyForPostHog(filePartSummaries) ?? "[]",
          generatedQuiz: stringifyForPostHog(generatedQuiz) ?? "",
          normalizedQuestions: stringifyForPostHog(normalizedQuestions) ?? "[]",
        },
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
    clientRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AnswerEvaluationResult> => {
    const trace = createAiTraceLogger(
      "evaluateAnswer",
      args.sessionId,
      args.clientRequestId,
    );
    const analyticsModelId = "gemini-3-flash-preview";
    const vertexUsageTotals: VertexUsageSnapshot = {};
    let llmAttempts = 0;
    let finishReason: string | undefined;
    let round = 0;
    let question: QuestionForEvaluation | null = null;
    let evaluationPrompt = "";
    let generatedEvaluation: AnswerEvaluationResult | null = null;
    let analyticsError: unknown;

    try {
      trace.log("info", "start", {
        questionId: args.questionId,
        answerLength: args.userAnswer.length,
        timeSpentSeconds: args.timeSpentSeconds,
      });

      const evaluationContext: {
        round: number;
        question: QuestionForEvaluation;
      } = await ctx.runQuery(internal.study.getQuestionForEvaluation, {
        grantToken: args.grantToken,
        sessionId: args.sessionId,
        questionId: args.questionId,
      });

      round = evaluationContext.round;
      question = evaluationContext.question;

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
          modelId: "gemini-3-flash-preview",
          temperature: 0.1,
          maxOutputTokens: 300,
          thinkingBudget: 0,
        });

        llmAttempts += 1;

        const result = await generateText({
          model: model("gemini-3-flash-preview"),
          temperature: 0.1,
          maxOutputTokens: 300,
          providerOptions: vertexProviderOptions,
          output: Output.object({
            schema: answerEvaluationSchema,
          }),
          experimental_telemetry: buildAiSdkTelemetry(
            "evaluateAnswer",
            args.sessionId,
            trace.traceId,
            {
              appScope: "evaluateAnswer",
              round,
              questionId: args.questionId,
              questionTopic: question.topic,
            },
          ),
          system:
            "Du bist ein fairer und unterstützender Prüfungs-Korrektor. Antworte auf Deutsch und erkläre kurz, was richtig ist oder fehlt.",
          prompt: (evaluationPrompt = `Thema: ${question.topic}
Frage: ${question.prompt}
Probiere dich bei deiner Antwort kurz und knapp zu halten. 
Erwartete Antwort-Richtung: ${question.idealAnswer}
Hinweis bei Bedarf: ${question.explanationHint}

Antwort der lernenden Person:
${args.userAnswer}

Gib eine objektive Bewertung mit einem Score zwischen 0 und 100 wie gut die Antwort der lernenden Person ist.`),
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
        generatedEvaluation = result.output;
      } catch (error) {
        if (isNoOutputGeneratedError(error)) {
          trace.addUsage(extractUsageFromError(error));
          trace.log("error", "llm_no_output", {
            error: extractErrorForLog(error),
          });
          throw new Error(
            "Die KI konnte keine Auswertung erzeugen. Bitte versuche es erneut.",
          );
        }

        trace.addUsage(extractUsageFromError(error));
        trace.log("error", "llm_failed", {
          error: extractErrorForLog(error),
        });

        throw error;
      }

      const roundedScore = Math.round(
        Math.max(0, Math.min(100, generated.score)),
      );

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
        errorCategory: analyticsError
          ? classifyAiErrorCategory(analyticsError)
          : undefined,
        error: analyticsError ? extractErrorForLog(analyticsError) : undefined,
        metadata: {
          clientRequestId: args.clientRequestId,
          questionId: args.questionId,
          answerLength: args.userAnswer.length,
          timeSpentSeconds: args.timeSpentSeconds,
        },
        posthogInput: stringifyForPostHog({
          round,
          question,
          userAnswer: args.userAnswer,
          prompt: evaluationPrompt,
        }),
        posthogOutput: stringifyForPostHog(generatedEvaluation),
        posthogProperties: {
          round,
          questionTopic: question?.topic ?? "",
          questionPrompt: question?.prompt ?? "",
          expectedAnswer: question?.idealAnswer ?? "",
          explanationHint: question?.explanationHint ?? "",
          userAnswer: args.userAnswer,
          prompt: evaluationPrompt,
          evaluationResult: stringifyForPostHog(generatedEvaluation) ?? "",
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
    mode: v.optional(v.union(v.literal("full"), v.literal("focus"))),
    focusTopic: v.optional(v.string()),
    clientRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trace = createAiTraceLogger(
      "analyzePerformance",
      args.sessionId,
      args.clientRequestId,
    );
    const analyticsModelId = "gemini-3-flash-preview";
    const vertexUsageTotals: VertexUsageSnapshot = {};
    let llmAttempts = 0;
    let finishReason: string | undefined;
    let responseCount = 0;
    let usedFallback = false;
    let analysisMode: AnalysisMode = args.mode ?? "full";
    let resolvedFocusTopic = toTrimmedString(args.focusTopic);
    let documentIds: string[] = [];
    let readyDocumentIds: string[] = [];
    let documentCorrelationMetadata: DocumentCorrelationMetadata = {};
    let responsesForPostHog: FullModeResponseContextInput[] = [];
    let analysisSystemPrompt = "";
    let analysisPrompt = "";
    let generatedAnalysis: AnalysisResult | null = null;
    let analyticsError: unknown;

    try {
      trace.log("info", "start", {
        requestedMode: args.mode ?? "full",
        requestedFocusTopic: args.focusTopic ?? null,
      });

      const result = await ctx.runQuery(internal.study.getAnalysisContext, {
        grantToken: args.grantToken,
        sessionId: args.sessionId,
        mode: analysisMode,
        focusTopic: resolvedFocusTopic || undefined,
      });

      let { session, responses } = result;
      const { documents } = result;
      responsesForPostHog = responses;

      trace.log("info", "context_loaded", {
        responseCount: responses.length,
        currentFocusTopic: session.currentFocusTopic ?? null,
        round: session.round,
        requestedMode: args.mode ?? "full",
        totalDocuments: documents.length,
        readyDocuments: documents.filter(
          (document) => document.extractionStatus === "ready",
        ).length,
      });
      responseCount = responses.length;
      documentIds = documents.map((document) => String(document._id));
      readyDocumentIds = documents
        .filter((document) => document.extractionStatus === "ready")
        .map((document) => String(document._id));
      documentCorrelationMetadata = buildDocumentCorrelationMetadata(
        documentIds,
        readyDocumentIds,
      );
      if (!resolvedFocusTopic) {
        resolvedFocusTopic = toTrimmedString(session.currentFocusTopic);
      }

      let focusTopicInsight =
        analysisMode === "focus" && session.analysis && resolvedFocusTopic
          ? (session.analysis.topics.find((topic) =>
              topicsMatchForFocusMode(topic.topic, resolvedFocusTopic),
            ) ?? null)
          : null;

      const reloadContextForFullMode = async (reason: string) => {
        const fullContext = await ctx.runQuery(
          internal.study.getAnalysisContext,
          {
            grantToken: args.grantToken,
            sessionId: args.sessionId,
            mode: "full",
          },
        );

        session = fullContext.session;
        responses = fullContext.responses;
        responsesForPostHog = responses;
        responseCount = responses.length;

        trace.log("info", "context_reloaded_for_full_mode", {
          responseCount: responses.length,
          round: session.round,
          reason,
        });
      };

      if (analysisMode === "focus") {
        if (!session.analysis || !resolvedFocusTopic || !focusTopicInsight) {
          trace.log("warn", "focus_mode_downgraded_to_full", {
            hasExistingAnalysis: Boolean(session.analysis),
            focusTopic: resolvedFocusTopic || null,
            hasFocusTopicInsight: Boolean(focusTopicInsight),
          });
          analysisMode = "full";
          await reloadContextForFullMode("focus_mode_missing_prerequisites");
          focusTopicInsight = null;
        }
      }

      if (responses.length === 0) {
        trace.log("warn", "no_responses_available");
        throw new Error(
          "Beantworte mindestens eine Frage, bevor du die Analyse startest.",
        );
      }

      const model = createVertexModel();
      let analysis = buildFallbackAnalysis(
        responses,
        analysisMode === "focus" ? resolvedFocusTopic || undefined : undefined,
      );

      if (analysisMode === "focus" && session.analysis && resolvedFocusTopic) {
        const topicResponses = responses.filter((response) =>
          topicsMatchForFocusMode(response.topic, resolvedFocusTopic),
        );

        if (topicResponses.length === 0) {
          trace.log("warn", "focus_mode_missing_topic_responses", {
            focusTopic: resolvedFocusTopic,
          });
          analysisMode = "full";
          await reloadContextForFullMode("focus_mode_missing_topic_responses");
          analysis = buildFallbackAnalysis(responses);
        } else {
          const fallbackAverage =
            topicResponses.reduce(
              (total, response) => total + response.score,
              0,
            ) / topicResponses.length;
          const fallbackTopicInsight = buildTopicInsightFromScore(
            resolvedFocusTopic,
            fallbackAverage,
          );
          const fallbackMergedTopics = mergeTopicInsight(
            session.analysis.topics,
            fallbackTopicInsight,
          );
          const fallbackSummary = summarizeAnalysisTopics(
            fallbackMergedTopics,
            resolvedFocusTopic,
          );
          const focusFallbackAnalysis = {
            ...fallbackSummary,
            topics: fallbackMergedTopics,
          };

          analysis = focusFallbackAnalysis;

          try {
            const focusSystemPrompt =
              'Du bist ein Lerncoach. Bewerte in dieser Auswertung ausschließlich ein einzelnes Thema auf Deutsch. Gib immer ein Feld scoreUnit mit entweder "percent" oder "fraction" zurück. Bevorzuge "percent". Wenn du "percent" verwendest, müssen alle Scores ganze Zahlen von 0 bis 100 sein.';
            const focusBasePrompt = `Analysiere ausschließlich das Thema "${resolvedFocusTopic}" anhand der Antworten.

Vorherige Themenbewertung (falls vorhanden):
${JSON.stringify(focusTopicInsight, null, 2)}

Antworten nur zu diesem Thema:
${JSON.stringify(topicResponses, null, 2)}

Erstelle eine aktualisierte Bewertung für genau dieses Thema.
Pflichtregeln:
- ${analysisScoreFormatRules.join("\n- ")}`;

            let generated: FocusTopicAnalysisResult | null = null;
            let invalidOutput: unknown;
            let retrySourceError: unknown = null;

            for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
              trace.log("info", "llm_request", {
                modelId: "gemini-3-flash-preview",
                mode: "focus",
                stage: attemptIndex === 0 ? "primary" : "format_retry",
                focusTopic: resolvedFocusTopic,
                responseCount: topicResponses.length,
                temperature: 0.2,
                maxOutputTokens: 600,
                thinkingBudget: 0,
              });

              llmAttempts += 1;

              try {
                const prompt =
                  attemptIndex === 0
                    ? focusBasePrompt
                    : buildAnalysisFormatCorrectionPrompt(
                        focusBasePrompt,
                        retrySourceError,
                        invalidOutput,
                      );
                analysisSystemPrompt = focusSystemPrompt;
                analysisPrompt = prompt;

                const result = await generateText({
                  model: model("gemini-3-flash-preview"),
                  temperature: 0.2,
                  maxOutputTokens: 600,
                  providerOptions: vertexProviderOptions,
                  output: Output.object({
                    schema: focusTopicAnalysisOutputSchema,
                  }),
                  experimental_telemetry: buildAiSdkTelemetry(
                    "analyzePerformance",
                    args.sessionId,
                    trace.traceId,
                    {
                      appScope: "analyzePerformance",
                      analysisMode,
                      round: session.round,
                      responseCount: topicResponses.length,
                      currentFocusTopic: resolvedFocusTopic,
                      topic: resolvedFocusTopic,
                      stage:
                        attemptIndex === 0 ? "focus_primary" : "focus_retry",
                    },
                  ),
                  system: focusSystemPrompt,
                  prompt,
                });

                const resultLog = extractGenerationResultForLog(result);
                trace.addUsage(resultLog.usage);
                finishReason = resultLog.details.finishReason;
                mergeVertexUsage(
                  vertexUsageTotals,
                  resultLog.details.vertexUsage,
                );
                trace.log("info", "llm_response", {
                  ...resultLog.details,
                  mode: "focus",
                  stage: attemptIndex === 0 ? "primary" : "format_retry",
                  outputPreview: {
                    focusTopic: resolvedFocusTopic,
                    scoreUnit: result.output.scoreUnit,
                    comfortScore: result.output.comfortScore,
                  },
                });

                invalidOutput = result.output;
                generated = normalizeFocusTopicScore(result.output);
                break;
              } catch (error) {
                if (
                  attemptIndex === 0 &&
                  (isNoOutputGeneratedError(error) ||
                    isInvalidAnalysisScoreFormatError(error))
                ) {
                  retrySourceError = error;
                  trace.addUsage(extractUsageFromError(error));
                  trace.log("warn", "llm_response_invalid_retrying", {
                    error: extractErrorForLog(error),
                    mode: "focus",
                    stage: "primary",
                    invalidOutput: isInvalidAnalysisScoreFormatError(error)
                      ? error.details
                      : invalidOutput,
                  });
                  continue;
                }

                throw error;
              }
            }

            if (!generated) {
              throw (
                retrySourceError ??
                new Error("Die Fokus-Analyse blieb ungültig.")
              );
            }

            const mergedTopics = mergeTopicInsight(session.analysis.topics, {
              topic: resolvedFocusTopic,
              comfortScore: generated.comfortScore,
              rationale: generated.rationale,
              recommendation: generated.recommendation,
            });
            const summary = summarizeAnalysisTopics(
              mergedTopics,
              resolvedFocusTopic,
            );

            analysis = {
              ...summary,
              topics: mergedTopics,
            };
            generatedAnalysis = analysis;
          } catch (error) {
            trace.addUsage(extractUsageFromError(error));
            usedFallback = true;
            trace.log("warn", "llm_failed_using_fallback", {
              error: extractErrorForLog(error),
              mode: "focus",
              fallbackOverallReadiness: focusFallbackAnalysis.overallReadiness,
              fallbackTopicCount: focusFallbackAnalysis.topics.length,
            });
            // Keep deterministic fallback analysis when the LLM call fails.
          }
        }
      }

      if (analysisMode === "full") {
        const fullModeFallback = buildFallbackAnalysis(responses);
        analysis = fullModeFallback;

        try {
          const coveredTopics = [
            ...new Set(responses.map((response) => response.topic)),
          ];
          const fullModePromptContext =
            buildFullModePromptResponseContext(responses);
          const fullSystemPrompt =
            'Du bist ein Lerncoach. Analysiere Wissenslücken aus den Antworten und gib konkrete Empfehlungen auf Deutsch. Gib immer ein Feld scoreUnit mit entweder "percent" oder "fraction" zurück. Bevorzuge "percent". Wenn du "percent" verwendest, müssen overallReadiness und alle comfortScore-Werte ganze Zahlen von 0 bis 100 sein.';
          const fullBasePrompt = `Analysiere diese Übungssitzung und erstelle einen themenbasierten Lernstandsbericht.

Die Antworten enthalten mehrere Runden. Beziehe den gesamten Verlauf ein.
Bewerte alle behandelten Themen ausgewogen und vermeide eine reine Fokussierung auf das aktuelle Fokus-Thema.

Fokus-Thema der Sitzung: ${session.currentFocusTopic ?? "kein spezielles Fokus-Thema"}
Alle behandelten Themen: ${coveredTopics.join(", ") || "keine"}
Antwortkontext (kompakt, neueste Antworten + Themenstatistik):
${fullModePromptContext.serializedContext}

Sei streng, aber konstruktiv.
Pflichtregeln:
- ${analysisScoreFormatRules.join("\n- ")}`;

          let generated: AnalysisResult | null = null;
          let invalidOutput: unknown;
          let retrySourceError: unknown = null;

          for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
            trace.log("info", "llm_request", {
              modelId: "gemini-3-flash-preview",
              mode: "full",
              stage: attemptIndex === 0 ? "primary" : "format_retry",
              responseCount: responses.length,
              promptResponseCount:
                fullModePromptContext.includedRecentResponses,
              omittedResponseCount: fullModePromptContext.omittedResponses,
              topicSummaryCount: fullModePromptContext.topicSummaryCount,
              temperature: 0.2,
              maxOutputTokens: 1_500,
              thinkingBudget: 0,
            });

            llmAttempts += 1;

            try {
              const prompt =
                attemptIndex === 0
                  ? fullBasePrompt
                  : buildAnalysisFormatCorrectionPrompt(
                      fullBasePrompt,
                      retrySourceError,
                      invalidOutput,
                    );
              analysisSystemPrompt = fullSystemPrompt;
              analysisPrompt = prompt;

              const result = await generateText({
                model: model("gemini-3-flash-preview"),
                temperature: 0.2,
                maxOutputTokens: 1_500,
                providerOptions: vertexProviderOptions,
                output: Output.object({
                  schema: analysisOutputSchema,
                }),
                experimental_telemetry: buildAiSdkTelemetry(
                  "analyzePerformance",
                  args.sessionId,
                  trace.traceId,
                  {
                    appScope: "analyzePerformance",
                    analysisMode,
                    round: session.round,
                    responseCount: responses.length,
                    currentFocusTopic: session.currentFocusTopic ?? "",
                    stage: attemptIndex === 0 ? "full_primary" : "full_retry",
                  },
                ),
                system: fullSystemPrompt,
                prompt,
              });

              const resultLog = extractGenerationResultForLog(result);
              trace.addUsage(resultLog.usage);
              finishReason = resultLog.details.finishReason;
              mergeVertexUsage(
                vertexUsageTotals,
                resultLog.details.vertexUsage,
              );
              trace.log("info", "llm_response", {
                ...resultLog.details,
                mode: "full",
                stage: attemptIndex === 0 ? "primary" : "format_retry",
                outputPreview: {
                  scoreUnit: result.output.scoreUnit,
                  overallReadiness: result.output.overallReadiness,
                  strongestTopics: result.output.strongestTopics,
                  weakestTopics: result.output.weakestTopics,
                  topicCount: result.output.topics.length,
                },
              });

              invalidOutput = result.output;
              generated = normalizeAnalysisScores(result.output);
              break;
            } catch (error) {
              if (
                attemptIndex === 0 &&
                (isNoOutputGeneratedError(error) ||
                  isInvalidAnalysisScoreFormatError(error))
              ) {
                retrySourceError = error;
                trace.addUsage(extractUsageFromError(error));
                trace.log("warn", "llm_response_invalid_retrying", {
                  error: extractErrorForLog(error),
                  mode: "full",
                  stage: "primary",
                  invalidOutput: isInvalidAnalysisScoreFormatError(error)
                    ? error.details
                    : invalidOutput,
                });
                continue;
              }

              throw error;
            }
          }

          if (!generated) {
            throw (
              retrySourceError ?? new Error("Die Gesamtanalyse blieb ungültig.")
            );
          }

          analysis = generated;
          generatedAnalysis = analysis;
        } catch (error) {
          trace.addUsage(extractUsageFromError(error));
          usedFallback = true;
          trace.log("warn", "llm_failed_using_fallback", {
            error: extractErrorForLog(error),
            mode: "full",
            fallbackOverallReadiness: fullModeFallback.overallReadiness,
            fallbackTopicCount: fullModeFallback.topics.length,
          });
          // Keep deterministic fallback analysis when the LLM call fails.
        }
      }

      await ctx.runMutation(internal.study.storeSessionAnalysis, {
        sessionId: args.sessionId,
        analysis,
      });

      trace.log("info", "completed", {
        usedFallback,
        analysisMode,
        overallReadiness: analysis.overallReadiness,
        topicCount: analysis.topics.length,
        usageTotals: trace.getUsageTotals(),
      });
      generatedAnalysis = analysis;

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
        errorCategory: analyticsError
          ? classifyAiErrorCategory(analyticsError)
          : undefined,
        error: analyticsError ? extractErrorForLog(analyticsError) : undefined,
        metadata: {
          clientRequestId: args.clientRequestId,
          responseCount,
          usedFallback,
          analysisMode,
          topic: resolvedFocusTopic || undefined,
          ...documentCorrelationMetadata,
        },
        posthogInput: stringifyForPostHog({
          analysisMode,
          resolvedFocusTopic,
          prompt: analysisPrompt,
          system: analysisSystemPrompt,
          responses: responsesForPostHog,
        }),
        posthogOutput: stringifyForPostHog(generatedAnalysis),
        posthogProperties: {
          analysisMode,
          resolvedFocusTopic,
          prompt: analysisPrompt,
          system: analysisSystemPrompt,
          responses: stringifyForPostHog(responsesForPostHog) ?? "[]",
          analysisResult: stringifyForPostHog(generatedAnalysis) ?? "",
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
    clientRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trace = createAiTraceLogger(
      "generateTopicDeepDive",
      args.sessionId,
      args.clientRequestId,
    );
    const analyticsModelId = "gemini-3-flash-preview";
    const vertexUsageTotals: VertexUsageSnapshot = {};
    let llmAttempts = 0;
    let finishReason: string | undefined;
    let totalDocuments = 0;
    let readyDocumentsCount = 0;
    let documentIds: string[] = [];
    let readyDocumentIds: string[] = [];
    let documentCorrelationMetadata: DocumentCorrelationMetadata = {};
    let filePartCount = 0;
    let sourceContextLength = 0;
    let outputQuestionCount: number | undefined;
    let sourceContext = "";
    let generatedDeepDive: DeepDiveGenerationResult | null = null;
    let deepDiveQuestionsForPostHog: QuestionForEvaluation[] = [];
    let filePartSummaries: PostHogFileAttachmentSummary[] = [];
    let analyticsError: unknown;

    try {
      trace.log("info", "start", {
        topic: args.topic,
      });

      const deepDiveContext: {
        documents: SessionDocumentInput[];
        accessKey?: string;
      } = await ctx.runQuery(internal.study.getQuizGenerationContext, {
        grantToken: args.grantToken,
        sessionId: args.sessionId,
      });

      const documents = deepDiveContext.documents;
      const accessKey = deepDiveContext.accessKey;
      totalDocuments = documents.length;

      const readyDocuments = documents.filter(
        (document: SessionDocumentInput) =>
          document.extractionStatus === "ready",
      );
      readyDocumentsCount = readyDocuments.length;
      documentIds = documents.map((document) => String(document._id));
      readyDocumentIds = readyDocuments.map((document) => String(document._id));
      documentCorrelationMetadata = buildDocumentCorrelationMetadata(
        documentIds,
        readyDocumentIds,
      );

      trace.log("info", "documents_loaded", {
        totalDocuments: documents.length,
        readyDocuments: readyDocuments.length,
        documents: documents.map((document) => ({
          documentId: document._id,
          fileName: document.fileName,
          fileType: document.fileType,
          fileSizeBytes: document.fileSizeBytes,
          extractionStatus: document.extractionStatus,
          extractedTextLength: document.extractedText?.length ?? 0,
        })),
      });

      if (readyDocuments.length === 0) {
        trace.log("warn", "no_ready_documents");
        throw new Error(
          "Es ist kein verarbeitetes Material für die Vertiefung verfügbar.",
        );
      }

      const oversizedDocuments = getOversizedInlineDocuments(readyDocuments);
      if (oversizedDocuments.length > 0) {
        trace.log("warn", "oversized_documents_blocked", {
          oversizedCount: oversizedDocuments.length,
          maxInlineBytes: MAX_VERTEX_INLINE_FILE_BYTES,
          files: oversizedDocuments.map((document) => ({
            fileName: document.fileName,
            fileSizeBytes: document.fileSizeBytes,
          })),
        });

        const filesPreview = oversizedDocuments
          .slice(0, 3)
          .map((document) => document.fileName)
          .join(", ");
        const suffix = oversizedDocuments.length > 3 ? " ..." : "";

        throw new Error(
          `Mindestens eine Datei ist für die aktuelle KI-Verarbeitung zu groß (maximal ${MAX_VERTEX_INLINE_FILE_LABEL}). Bitte verkleinere die Datei oder teile sie auf: ${filesPreview}${suffix}`,
        );
      }

      let fileParts: Array<{
        type: "file";
        data: Buffer;
        mediaType: string;
        filename: string;
      }> = [];
      try {
        const modelInput = await buildModelInputFromDocuments(
          ctx,
          readyDocuments.map((document: SessionDocumentInput) => ({
            storageId: document.storageId,
            fileName: document.fileName,
            fileType: document.fileType,
            fileSizeBytes: document.fileSizeBytes,
            extractedText: document.extractedText,
          })),
          accessKey,
          trace,
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
      filePartSummaries = summarizeFilePartsForPostHog(fileParts);

      if (fileParts.length === 0 && !sourceContext) {
        trace.log("error", "no_usable_input");
        throw new Error(
          "Es konnten keine nutzbaren Inhalte für die Vertiefung gelesen werden.",
        );
      }

      const userContent: Array<
        | { type: "text"; text: string }
        | { type: "file"; data: Buffer; mediaType: string; filename: string }
      > = [
        {
          type: "text",
          text: `Erstelle 5 kurze Vertiefungsfragen zu folgendem Thema: ${args.topic}

Nutze nur das bereitgestellte Lernmaterial und formuliere die Fragen prüfungsnah.`,
        },
      ];

      if (sourceContext) {
        userContent.push({
          type: "text",
          text: `Zusätzliche Textauszüge aus den Dateien:\n${sourceContext}`,
        });
      }

      userContent.push(...fileParts);

      const model = createVertexModel();
      trace.log("info", "vertex_model_initialized", {
        modelId: "gemini-3-flash-preview",
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
          model: model("gemini-3-flash-preview"),
          temperature: 0.25,
          maxOutputTokens: 1_700,
          providerOptions: vertexProviderOptions,
          output: Output.object({
            schema: deepDiveSchema,
          }),
          experimental_telemetry: buildAiSdkTelemetry(
            "generateTopicDeepDive",
            args.sessionId,
            trace.traceId,
            {
              appScope: "generateTopicDeepDive",
              topic: args.topic,
              readyDocuments: readyDocuments.length,
              ...documentCorrelationMetadata,
              filePartCount: fileParts.length,
              sourceContextLength: sourceContext.length,
            },
          ),
          system:
            "Du bist ein fokussierter Tutor und erstellst anspruchsvolle, aber faire Vertiefungsfragen auf Deutsch.",
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

        const documentTokens =
          resultLog.details.vertexUsage?.documentPromptTokens ?? 0;
        if (fileParts.length > 0 && documentTokens <= 0) {
          trace.log("warn", "no_document_tokens_detected", {
            filePartCount: fileParts.length,
            vertexUsage: resultLog.details.vertexUsage,
          });
        }

        generated = result.output;
        generatedDeepDive = result.output;
      } catch (error) {
        if (isNoOutputGeneratedError(error)) {
          trace.addUsage(extractUsageFromError(error));
          trace.log("error", "llm_no_output", {
            error: extractErrorForLog(error),
          });
          throw new Error(
            "Die KI hat keine Vertiefungsfragen erzeugt. Bitte versuche es erneut.",
          );
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
        throw new Error(
          "Die KI hat keine Vertiefungsfragen erzeugt. Bitte versuche es erneut.",
        );
      }

      const deepDiveQuestions = generated.questions
        .slice(0, 5)
        .map((question, index) => ({
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

      deepDiveQuestionsForPostHog = deepDiveQuestions;
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
        errorCategory: analyticsError
          ? classifyAiErrorCategory(analyticsError)
          : undefined,
        error: analyticsError ? extractErrorForLog(analyticsError) : undefined,
        metadata: {
          clientRequestId: args.clientRequestId,
          topic: args.topic,
          ...documentCorrelationMetadata,
        },
        posthogInput: stringifyForPostHog({
          topic: args.topic,
          sourceContext,
          attachedFiles: filePartSummaries,
        }),
        posthogOutput: stringifyForPostHog({
          generatedDeepDive,
          deepDiveQuestions: deepDiveQuestionsForPostHog,
        }),
        posthogProperties: {
          topic: args.topic,
          sourceContext,
          attachedFiles: stringifyForPostHog(filePartSummaries) ?? "[]",
          generatedDeepDive: stringifyForPostHog(generatedDeepDive) ?? "",
          deepDiveQuestions:
            stringifyForPostHog(deepDiveQuestionsForPostHog) ?? "[]",
        },
      });
      await flushTelemetry({
        traceId: trace.traceId,
        appScope: "generateTopicDeepDive",
      });
    }
  },
});
