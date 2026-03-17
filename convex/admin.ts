import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./errorTracking";
import { v } from "convex/values";
import { assertAdminSecret } from "./adminAuth";
import { deleteManagedFile } from "./fileStorage";

const resolveTarget = async (
  ctx: QueryCtx | MutationCtx,
  args: { grantToken?: string; sessionId?: Id<"studySessions"> },
) => {
  if (!args.grantToken && !args.sessionId) {
    throw new Error("Gib entweder grantToken oder sessionId an.");
  }

  if (args.grantToken && args.sessionId) {
    throw new Error(
      "Bitte nur grantToken oder sessionId angeben, nicht beides gleichzeitig.",
    );
  }

  if (args.grantToken) {
    const grant = await ctx.db
      .query("accessGrants")
      .withIndex("by_token", (q) => q.eq("token", args.grantToken as string))
      .first();

    if (!grant) {
      throw new Error("Zugangsfreigabe wurde nicht gefunden.");
    }

    const sessions = await ctx.db
      .query("studySessions")
      .withIndex("by_grantId", (q) => q.eq("grantId", grant._id))
      .collect();

    return {
      grant,
      sessions,
    };
  }

  const session = await ctx.db.get(args.sessionId as Id<"studySessions">);
  if (!session) {
    throw new Error("Lernsitzung wurde nicht gefunden.");
  }

  return {
    grant: null,
    sessions: [session],
  };
};

const normalizeFocusTopics = (
  focusTopics?: string[],
  currentFocusTopic?: string,
) => {
  const normalizedTopics = [
    ...(focusTopics ?? []),
    ...(currentFocusTopic ? [currentFocusTopic] : []),
  ]
    .map((topic) => topic.trim())
    .filter((topic) => topic.length > 0);

  const deduplicatedTopics = [...new Set(normalizedTopics)];
  return deduplicatedTopics.length > 0 ? deduplicatedTopics : undefined;
};

export const exportData = query({
  args: {
    adminSecret: v.string(),
    grantToken: v.optional(v.string()),
    sessionId: v.optional(v.id("studySessions")),
    includeContent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const target = await resolveTarget(ctx, {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
    });

    const includeContent = args.includeContent ?? false;

    const sessions = [];
    for (const session of target.sessions) {
      const documents = await ctx.db
        .query("sessionDocuments")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();

      const responses = await ctx.db
        .query("quizResponses")
        .withIndex("by_session_round", (q) => q.eq("sessionId", session._id))
        .collect();

      const analyticsEvents = await ctx.db
        .query("aiAnalyticsEvents")
        .withIndex("by_session_createdAt", (q) =>
          q.eq("sessionId", session._id),
        )
        .collect();

      sessions.push({
        session,
        documents: documents.map((document) => ({
          ...document,
          extractedText: includeContent ? document.extractedText : undefined,
        })),
        responses: responses.map((response) => ({
          ...response,
          userAnswer: includeContent ? response.userAnswer : "[ausgeblendet]",
        })),
        analyticsEvents,
      });
    }

    return {
      exportedAt: Date.now(),
      grant: target.grant,
      sessionCount: sessions.length,
      includeContent,
      sessions,
    };
  },
});

export const deleteData = mutation({
  args: {
    adminSecret: v.string(),
    grantToken: v.optional(v.string()),
    sessionId: v.optional(v.id("studySessions")),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const target = await resolveTarget(ctx, {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
    });

    let deletedSessions = 0;
    let deletedDocuments = 0;
    let deletedResponses = 0;
    let deletedAnalyticsEvents = 0;
    let deletedStorageFiles = 0;

    for (const session of target.sessions) {
      const documents = await ctx.db
        .query("sessionDocuments")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const document of documents) {
        try {
          const deleteResult = await deleteManagedFile(ctx, {
            storageId: document.storageId,
            storageProvider: document.storageProvider,
          });

          if (deleteResult.deleted) {
            deletedStorageFiles += 1;
          } else {
            // Treat an unsuccessful deletion as a failure to keep counts accurate.
            throw new Error("Failed to delete managed file");
          }
        } catch {
          // Continue deleting DB records even if storage deletion fails.
        }

        await ctx.db.delete(document._id);
        deletedDocuments += 1;
      }

      const responses = await ctx.db
        .query("quizResponses")
        .withIndex("by_session_round", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const response of responses) {
        await ctx.db.delete(response._id);
        deletedResponses += 1;
      }

      const analyticsEvents = await ctx.db
        .query("aiAnalyticsEvents")
        .withIndex("by_session_createdAt", (q) =>
          q.eq("sessionId", session._id),
        )
        .collect();
      for (const event of analyticsEvents) {
        await ctx.db.delete(event._id);
        deletedAnalyticsEvents += 1;
      }

      await ctx.db.delete(session._id);
      deletedSessions += 1;
    }

    if (target.grant) {
      await ctx.db.patch(target.grant._id, {
        token: `deleted-${crypto.randomUUID()}`,
        revokedAt: Date.now(),
      });
    }

    return {
      deletedSessions,
      deletedDocuments,
      deletedResponses,
      deletedAnalyticsEvents,
      deletedStorageFiles,
      revokedGrant: Boolean(target.grant),
    };
  },
});

export const verifySecret = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (_, args) => {
    try {
      assertAdminSecret(args.adminSecret);
      return { valid: true };
    } catch {
      return { valid: false };
    }
  },
});

export const migrateLegacySchemaFields = mutation({
  args: {
    adminSecret: v.string(),
    grantToken: v.optional(v.string()),
    sessionId: v.optional(v.id("studySessions")),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const dryRun = args.dryRun ?? false;
    const targetSessions =
      args.grantToken || args.sessionId
        ? (
            await resolveTarget(ctx, {
              grantToken: args.grantToken,
              sessionId: args.sessionId,
            })
          ).sessions
        : await ctx.db.query("studySessions").collect();

    let scannedSessions = 0;
    let scannedDocuments = 0;
    let migratedSessions = 0;
    let migratedDocuments = 0;
    let normalizedFocusTopics = 0;
    let removedCurrentFocusTopic = 0;
    let removedStorageProvider = 0;

    for (const session of targetSessions) {
      scannedSessions += 1;

      const nextFocusTopics = normalizeFocusTopics(
        session.focusTopics,
        session.currentFocusTopic,
      );
      const hadLegacyFocusTopic = Boolean(session.currentFocusTopic);
      const focusTopicsChanged =
        JSON.stringify(session.focusTopics ?? []) !==
        JSON.stringify(nextFocusTopics ?? []);
      const sessionNeedsMigration = hadLegacyFocusTopic || focusTopicsChanged;

      if (sessionNeedsMigration) {
        migratedSessions += 1;
        if (hadLegacyFocusTopic) {
          removedCurrentFocusTopic += 1;
        }
        if (focusTopicsChanged) {
          normalizedFocusTopics += 1;
        }

        if (!dryRun) {
          await ctx.db.replace(session._id, {
            grantId: session.grantId,
            title: session.title,
            stage: session.stage,
            round: session.round,
            ...(nextFocusTopics ? { focusTopics: nextFocusTopics } : {}),
            ...(session.sourceSummary
              ? { sourceSummary: session.sourceSummary }
              : {}),
            sourceTopics: session.sourceTopics,
            quizQuestions: session.quizQuestions,
            ...(session.analysis ? { analysis: session.analysis } : {}),
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          });
        }
      }

      const documents = await ctx.db
        .query("sessionDocuments")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const document of documents) {
        scannedDocuments += 1;

        if (!document.storageProvider) {
          continue;
        }

        migratedDocuments += 1;
        removedStorageProvider += 1;

        if (dryRun) {
          continue;
        }

        await ctx.db.replace(document._id, {
          sessionId: document.sessionId,
          storageId: document.storageId,
          fileName: document.fileName,
          fileType: document.fileType,
          fileSizeBytes: document.fileSizeBytes,
          extractionStatus: document.extractionStatus,
          ...(document.extractedText
            ? { extractedText: document.extractedText }
            : {}),
          ...(document.extractionError
            ? { extractionError: document.extractionError }
            : {}),
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        });
      }
    }

    return {
      dryRun,
      scannedSessions,
      scannedDocuments,
      migratedSessions,
      migratedDocuments,
      normalizedFocusTopics,
      removedCurrentFocusTopic,
      removedStorageProvider,
    };
  },
});

export const generateMagicLink = mutation({
  args: {
    adminSecret: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const now = Date.now();

    await ctx.db.insert("accessCodes", {
      code,
      normalizedCode: "SMARTNOTES-" + code,
      note: args.note,
      createdAt: now,
    });

    return { code };
  },
});
