import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

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

type GrantDoc = {
  _id: Id<"accessGrants">;
  expiresAt: number;
  revokedAt?: number;
};

const ensureGrant = async (ctx: QueryCtx | MutationCtx, grantToken: string): Promise<GrantDoc> => {
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
  if (grant.expiresAt <= Date.now()) {
    throw new Error("Zugangsfreigabe ist abgelaufen.");
  }

  return {
    _id: grant._id,
    expiresAt: grant.expiresAt,
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
    const title = args.title?.trim() || `Lernsitzung ${new Date(now).toLocaleString("de-DE")}`;

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
    const session = await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const documents = await ctx.db
      .query("sessionDocuments")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_session_round", (q) => q.eq("sessionId", args.sessionId).eq("round", session.round))
      .collect();

    return {
      session,
      documents,
      responses,
      stats: {
        totalQuestions: session.quizQuestions.length,
        answeredQuestions: responses.length,
        readyDocuments: documents.filter((doc) => doc.extractionStatus === "ready").length,
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
    return ctx.storage.generateUploadUrl();
  },
});

export const registerUploadedDocument = mutation({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const grant = await ensureGrant(ctx, args.grantToken);
    await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const now = Date.now();
    const documentId = await ctx.db.insert("sessionDocuments", {
      sessionId: args.sessionId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSizeBytes: args.fileSizeBytes,
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

    await ctx.db.delete(args.documentId);
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
      throw new Error("Dokument gehoert nicht zu dieser Sitzung.");
    }

    return {
      document,
    };
  },
});

export const setDocumentExtractionResult = internalMutation({
  args: {
    documentId: v.id("sessionDocuments"),
    extractionStatus: v.union(v.literal("processing"), v.literal("ready"), v.literal("failed")),
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
    const session = await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const documents = await ctx.db
      .query("sessionDocuments")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return {
      session,
      documents,
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
      ...(args.currentFocusTopic ? { currentFocusTopic: args.currentFocusTopic } : {}),
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
    const session = await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const question = session.quizQuestions.find((item) => item.id === args.questionId);
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
        q.eq("sessionId", args.sessionId).eq("round", args.round).eq("questionId", args.questionId),
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
    const session = await ensureSessionOwnership(ctx, args.sessionId, grant._id);

    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_session_round", (q) => q.eq("sessionId", args.sessionId).eq("round", session.round))
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
