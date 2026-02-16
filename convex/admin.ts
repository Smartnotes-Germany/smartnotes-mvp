import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

const getConfiguredAdminSecret = () => {
  const secret = process.env.ACCESS_CODE_ADMIN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_CODE_ADMIN_SECRET ist nicht konfiguriert.");
  }
  return secret;
};

const assertAdminSecret = (providedSecret: string) => {
  const expectedSecret = getConfiguredAdminSecret();
  if (providedSecret !== expectedSecret) {
    throw new Error("Ungültiges Admin-Secret.");
  }
};

const resolveTarget = async (
  ctx: QueryCtx | MutationCtx,
  args: { grantToken?: string; sessionId?: Id<"studySessions"> },
) => {
  if (!args.grantToken && !args.sessionId) {
    throw new Error("Gib entweder grantToken oder sessionId an.");
  }

  if (args.grantToken && args.sessionId) {
    throw new Error("Bitte nur grantToken oder sessionId angeben, nicht beides gleichzeitig.");
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
        .withIndex("by_session_createdAt", (q) => q.eq("sessionId", session._id))
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
          await ctx.storage.delete(document.storageId);
          deletedStorageFiles += 1;
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
        .withIndex("by_session_createdAt", (q) => q.eq("sessionId", session._id))
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
        expiresAt: Date.now(),
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
