import type { Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./errorTracking";
import { v } from "convex/values";
import { validateUploadFile } from "../shared/uploadPolicy";

const quizQuestionValidator = v.object({
  id: v.string(),
  topic: v.string(),
  prompt: v.string(),
  idealAnswer: v.string(),
  explanationHint: v.string(),
});

const analysisTopicValidator = v.object({
  topic: v.string(),
  comfortScore: v.number(),
  rationale: v.string(),
  recommendation: v.string(),
});

const analysisValidator = v.object({
  overallReadiness: v.number(),
  strongestTopics: v.array(v.string()),
  weakestTopics: v.array(v.string()),
  topics: v.array(analysisTopicValidator),
  recommendedNextStep: v.string(),
});

const aiAnalyticsStatusValidator = v.union(
  v.literal("success"),
  v.literal("error"),
);
const aiAnalyticsPrivacyModeValidator = v.union(
  v.literal("balanced"),
  v.literal("full"),
  v.literal("off"),
);
const aiAnalyticsTelemetryProviderValidator = v.union(
  v.literal("langfuse"),
  v.literal("none"),
);
const aiAnalyticsErrorCategoryValidator = v.union(
  v.literal("file_too_large"),
  v.literal("storage_fetch_failed"),
  v.literal("model_no_output"),
  v.literal("vertex_request_failed"),
  v.literal("unknown"),
);

type GrantDoc = {
  _id: Id<"accessGrants">;
  revokedAt?: number;
};

const buildGrantAccessKey = (grantId: Id<"accessGrants">) => `grant:${grantId}`;

const deleteStorageFileWithFallback = async (
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) => {
  try {
    const deleted = await ctx.runMutation(
      components.convexFilesControl.cleanUp.deleteFile,
      {
        storageId,
      },
    );

    if (!deleted.deleted) {
      await ctx.storage.delete(storageId);
    }
  } catch {
    try {
      await ctx.storage.delete(storageId);
    } catch {
      // Best-effort cleanup.
    }
  }
};

const parseMetadataJson = (
  raw: string | undefined,
): Record<string, unknown> | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const extractClientRequestId = (
  metadata: Record<string, unknown> | null,
): string | null => {
  if (!metadata) {
    return null;
  }

  return typeof metadata.clientRequestId === "string"
    ? metadata.clientRequestId
    : null;
};

const ensureGrant = async (
  ctx: QueryCtx | MutationCtx,
  grantToken: string,
): Promise<GrantDoc> => {
  const grant = await ctx.db
    .query("accessGrants")
    .withIndex("by_token", (q) => q.eq("token", grantToken))
    .first();

  if (!grant) {
    throw new Error("Zugangsfreigabe nicht gefunden.");
  }
  if (grant.revokedAt) {
    throw new Error("Zugangsfreigabe wurde widerrufen.");
  }

  return {
    _id: grant._id,
    revokedAt: grant.revokedAt,
  };
};

const ensureSessionOwnership = async (
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"studySessions">,
  grantId: Id<"accessGrants">,
) => {
  const session = await ctx.db.get(sessionId);
  if (!session) {
    throw new Error("Lernsitzung nicht gefunden.");
  }
  if (session.grantId !== grantId) {
    throw new Error("Du darfst auf diese Sitzung nicht zugreifen.");
  }
  return session;
};

export const startSession = mutation({
  args: {
    grantToken: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    const now = Date.now();
    const title =
      args.title?.trim() ||
      `Lernsitzung ${new Date(now).toLocaleString("de-DE")}`;

    const sessionId = await ctx.db.insert("studySessions", {
      grantId: grant._id,
      title,
      stage: "upload",
      round: 1,
      sourceTopics: [],
      quizQuestions: [],
      createdAt: now,
      updatedAt: now,
    });

    return sessionId;
  },
});

export const getLatestSessionId = query({
  args: {
    grantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    const latestSession = await ctx.db
      .query("studySessions")
      .withIndex("by_grantId", (q) => q.eq("grantId", grant._id))
      .order("desc")
      .first();

    return latestSession?._id ?? null;
  },
});

export const getSessionSnapshot = query({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    const session = await ensureSessionOwnership(
      ctx,
      args.sessionId,
      grant._id,
    );

    const documents = await ctx.db
      .query("sessionDocuments")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_session_round", (q) =>
        q.eq("sessionId", args.sessionId).eq("round", session.round),
      )
      .collect();

    return {
      session,
      documents,
      responses,
      stats: {
        totalQuestions: session.quizQuestions.length,
        answeredQuestions: responses.length,
        readyDocuments: documents.filter(
          (doc) => doc.extractionStatus === "ready",
        ).length,
      },
    };
  },
});

export const generateUploadUrl = mutation({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    return ctx.runMutation(
      components.convexFilesControl.upload.generateUploadUrl,
      {
        provider: "convex",
      },
    );
  },
});

export const registerUploadedDocument = mutation({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    uploadToken: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const finalizedUpload = await ctx.runMutation(
      components.convexFilesControl.upload.finalizeUpload,
      {
        uploadToken: args.uploadToken,
        storageId: args.storageId,
        accessKeys: [buildGrantAccessKey(grant._id)],
      },
    );

    if (finalizedUpload.storageProvider !== "convex") {
      throw new Error(
        "Aktuell wird nur Convex-Speicher für Lernmaterial unterstützt.",
      );
    }
    if (finalizedUpload.storageId !== args.storageId) {
      throw new Error(
        "Upload konnte nicht verifiziert werden. Bitte versuche es erneut.",
      );
    }

    const trustedMetadata = finalizedUpload.metadata;
    if (!trustedMetadata) {
      await deleteStorageFileWithFallback(ctx, args.storageId);
      throw new Error(
        "Upload konnte nicht verifiziert werden. Bitte versuche es erneut.",
      );
    }

    if (trustedMetadata.storageId !== args.storageId) {
      await deleteStorageFileWithFallback(ctx, args.storageId);
      throw new Error(
        "Upload konnte nicht verifiziert werden. Bitte versuche es erneut.",
      );
    }

    const trustedFileSizeBytes = trustedMetadata.size;
    const trustedFileType =
      trustedMetadata.contentType ||
      args.fileType ||
      "application/octet-stream";

    if (args.fileSizeBytes !== trustedFileSizeBytes) {
      await deleteStorageFileWithFallback(ctx, args.storageId);
      throw new Error(
        "Uploadgröße konnte nicht verifiziert werden. Bitte lade die Datei erneut hoch.",
      );
    }

    const uploadValidation = validateUploadFile({
      name: args.fileName,
      size: trustedFileSizeBytes,
    });
    if (!uploadValidation.valid) {
      await deleteStorageFileWithFallback(ctx, args.storageId);
      throw new Error(uploadValidation.message);
    }

    const now = Date.now();
    const documentId = await ctx.db.insert("sessionDocuments", {
      sessionId: args.sessionId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: trustedFileType,
      fileSizeBytes: trustedFileSizeBytes,
      extractionStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return documentId;
  },
});

export const removeDocument = mutation({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    documentId: v.id("sessionDocuments"),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const document = await ctx.db.get(args.documentId);
    if (!document || document.sessionId !== args.sessionId) {
      throw new Error("Dokument wurde in dieser Sitzung nicht gefunden.");
    }

    await deleteStorageFileWithFallback(ctx, document.storageId);

    await ctx.db.delete(args.documentId);
  },
});

export const createDocumentDownloadUrl = mutation({
  // Not wired in the current UI yet; kept as the download endpoint for planned
  // document preview/export actions without exposing raw storage IDs.
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    documentId: v.id("sessionDocuments"),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const document = await ctx.db.get(args.documentId);
    if (!document || document.sessionId !== args.sessionId) {
      throw new Error("Dokument wurde in dieser Sitzung nicht gefunden.");
    }

    const accessKey = buildGrantAccessKey(grant._id);
    const downloadGrant = await ctx.runMutation(
      components.convexFilesControl.download.createDownloadGrant,
      {
        storageId: document.storageId,
        maxUses: 1,
        expiresAt: Date.now() + 5 * 60 * 1000,
      },
    );

    const consumeResult = await ctx.runMutation(
      components.convexFilesControl.download.consumeDownloadGrantForUrl,
      {
        downloadToken: downloadGrant.downloadToken,
        accessKey,
      },
    );

    if (consumeResult.status !== "ok" || !consumeResult.downloadUrl) {
      throw new Error("Download-Link konnte nicht erstellt werden.");
    }

    return {
      downloadUrl: consumeResult.downloadUrl,
    };
  },
});

export const getDocumentExtractionContext = internalQuery({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    documentId: v.id("sessionDocuments"),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const document = await ctx.db.get(args.documentId);
    if (!document || document.sessionId !== args.sessionId) {
      throw new Error("Dokument gehört nicht zu dieser Sitzung.");
    }

    return {
      document,
      accessKey: buildGrantAccessKey(grant._id),
    };
  },
});

export const setDocumentExtractionResult = internalMutation({
  args: {
    documentId: v.id("sessionDocuments"),
    extractionStatus: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    extractedText: v.optional(v.string()),
    extractionError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const patch: {
      extractionStatus: "processing" | "ready" | "failed";
      updatedAt: number;
      extractedText?: string;
      extractionError?: string;
    } = {
      extractionStatus: args.extractionStatus,
      updatedAt: now,
    };

    if (args.extractedText !== undefined) {
      patch.extractedText = args.extractedText;
    }
    if (args.extractionError !== undefined) {
      patch.extractionError = args.extractionError;
    }

    await ctx.db.patch(args.documentId, {
      ...patch,
    });
  },
});

export const getQuizGenerationContext = internalQuery({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    const session = await ensureSessionOwnership(
      ctx,
      args.sessionId,
      grant._id,
    );

    const documents = await ctx.db
      .query("sessionDocuments")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return {
      session,
      documents,
      accessKey: buildGrantAccessKey(grant._id),
    };
  },
});

export const storeGeneratedQuiz = internalMutation({
  args: {
    sessionId: v.id("studySessions"),
    sourceSummary: v.string(),
    sourceTopics: v.array(v.string()),
    quizQuestions: v.array(quizQuestionValidator),
    currentFocusTopic: v.optional(v.string()),
    incrementRound: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Lernsitzung nicht gefunden.");
    }

    const nextRound = args.incrementRound ? session.round + 1 : session.round;
    const now = Date.now();

    await ctx.db.patch(args.sessionId, {
      stage: "quiz",
      round: nextRound,
      sourceSummary: args.sourceSummary,
      sourceTopics: args.sourceTopics,
      quizQuestions: args.quizQuestions,
      ...(args.currentFocusTopic
        ? { currentFocusTopic: args.currentFocusTopic }
        : {}),
      updatedAt: now,
    });
  },
});

export const getQuestionForEvaluation = internalQuery({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    questionId: v.string(),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    const session = await ensureSessionOwnership(
      ctx,
      args.sessionId,
      grant._id,
    );

    const question = session.quizQuestions.find(
      (item) => item.id === args.questionId,
    );
    if (!question) {
      throw new Error("Frage wurde in dieser Sitzung nicht gefunden.");
    }

    return {
      sessionId: session._id,
      round: session.round,
      question,
    };
  },
});

export const storeQuizResponse = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("quizResponses")
      .withIndex("by_session_round_question", (q) =>
        q
          .eq("sessionId", args.sessionId)
          .eq("round", args.round)
          .eq("questionId", args.questionId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        topic: args.topic,
        prompt: args.prompt,
        userAnswer: args.userAnswer,
        isCorrect: args.isCorrect,
        score: args.score,
        explanation: args.explanation,
        idealAnswer: args.idealAnswer,
        timeSpentSeconds: args.timeSpentSeconds,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("quizResponses", {
      sessionId: args.sessionId,
      round: args.round,
      questionId: args.questionId,
      topic: args.topic,
      prompt: args.prompt,
      userAnswer: args.userAnswer,
      isCorrect: args.isCorrect,
      score: args.score,
      explanation: args.explanation,
      idealAnswer: args.idealAnswer,
      timeSpentSeconds: args.timeSpentSeconds,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getAnalysisContext = internalQuery({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    const session = await ensureSessionOwnership(
      ctx,
      args.sessionId,
      grant._id,
    );

    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_session_round", (q) =>
        q.eq("sessionId", args.sessionId).eq("round", session.round),
      )
      .collect();

    const documents = await ctx.db
      .query("sessionDocuments")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return {
      session,
      responses,
      documents,
    };
  },
});

export const storeSessionAnalysis = internalMutation({
  args: {
    sessionId: v.id("studySessions"),
    analysis: analysisValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      stage: "analysis",
      analysis: args.analysis,
      updatedAt: Date.now(),
    });
  },
});

export const storeAiAnalyticsEvent = internalMutation({
  args: {
    traceId: v.string(),
    sessionId: v.id("studySessions"),
    scope: v.string(),
    status: aiAnalyticsStatusValidator,
    privacyMode: aiAnalyticsPrivacyModeValidator,
    contentCaptured: v.boolean(),
    telemetryProvider: aiAnalyticsTelemetryProviderValidator,
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
    errorCategory: v.optional(aiAnalyticsErrorCategoryValidator),
    errorName: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorStackPreview: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiAnalyticsEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getAiAnalyticsForSession = query({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const limit = Math.max(1, Math.min(200, Math.round(args.limit ?? 50)));

    return ctx.db
      .query("aiAnalyticsEvents")
      .withIndex("by_session_createdAt", (q) =>
        q.eq("sessionId", args.sessionId),
      )
      .order("desc")
      .take(limit);
  },
});

export const getLatestAiFailureByClientRequestId = query({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    clientRequestId: v.string(),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const candidates = await ctx.db
      .query("aiAnalyticsEvents")
      .withIndex("by_session_createdAt", (q) =>
        q.eq("sessionId", args.sessionId),
      )
      .order("desc")
      .take(250);

    for (const event of candidates) {
      if (event.status !== "error") {
        continue;
      }

      const metadata = parseMetadataJson(event.metadataJson);
      const metadataClientRequestId = extractClientRequestId(metadata);
      if (metadataClientRequestId !== args.clientRequestId) {
        continue;
      }

      return {
        traceId: event.traceId,
        scope: event.scope,
        errorCategory: event.errorCategory,
        errorName: event.errorName,
        errorMessage: event.errorMessage,
        createdAt: event.createdAt,
      };
    }

    return null;
  },
});
