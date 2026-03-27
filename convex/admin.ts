import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./errorTracking";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { assertAdminSecret } from "./adminAuth";
import { deleteManagedFile } from "./fileStorage";
import {
  assertMeaningfulIdentityLabel,
  hasMeaningfulIdentityLabel,
  normalizeIdentityEmail,
  normalizeIdentityLabel,
} from "../shared/identity";

const LEGACY_GRANT_IDENTITY_LABEL = "Unbekannte Nutzerkennung";
const SAMPLE_LIMIT = 10;

type BackfillSnapshot = {
  identityLabel?: string;
  identityEmail?: string;
  note?: string;
};

const buildLegacyGrantIdentityLabel = (grantId: Id<"accessGrants">) =>
  `${LEGACY_GRANT_IDENTITY_LABEL} (${grantId})`;

const normalizeMeaningfulIdentityLabel = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeIdentityLabel(value);
  return hasMeaningfulIdentityLabel(normalized) ? normalized : undefined;
};

const normalizeOptionalIdentityEmail = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  return normalizeIdentityEmail(value);
};

const normalizeOptionalNote = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

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

  const grant = await ctx.db.get(session.grantId);

  return {
    grant,
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
    const shouldRevokeGrant = Boolean(args.grantToken);

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

    if (shouldRevokeGrant && target.grant) {
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
      revokedGrant: shouldRevokeGrant && Boolean(target.grant),
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

export const generateMagicLink = mutation({
  args: {
    adminSecret: v.string(),
    identityLabel: v.string(),
    identityEmail: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const identityLabel = assertMeaningfulIdentityLabel(args.identityLabel);
    const identityEmail = args.identityEmail
      ? normalizeIdentityEmail(args.identityEmail)
      : undefined;
    const note = args.note?.trim();

    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const now = Date.now();

    await ctx.db.insert("accessCodes", {
      code,
      normalizedCode: "SMARTNOTES-" + code,
      identityLabel,
      ...(identityEmail ? { identityEmail } : {}),
      ...(note ? { note } : {}),
      createdAt: now,
    });

    return { code };
  },
});

export const backfillQuizResponseMisunderstanding = mutation({
  args: {
    adminSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const effectiveLimit = Math.max(1, Math.min(500, args.limit ?? 200));
    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_createdAt")
      .order("asc")
      .take(effectiveLimit);

    let scanned = 0;
    let patched = 0;

    for (const response of responses) {
      scanned += 1;
      if (typeof response.misunderstanding === "string") {
        continue;
      }

      const fallbackMisunderstanding = response.isCorrect
        ? "Kein spezifisches Missverständnis"
        : "Keine Angabe";

      await ctx.db.patch(response._id, {
        misunderstanding: fallbackMisunderstanding,
        updatedAt: Date.now(),
      });
      patched += 1;
    }

    return {
      scanned,
      patched,
      limit: effectiveLimit,
    };
  },
});

export const backfillGrantAnalyticsIdentity = mutation({
  args: {
    adminSecret: v.string(),
    dryRun: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const dryRun = args.dryRun ?? false;
    const page = await ctx.db
      .query("accessGrants")
      .withIndex("by_createdAt")
      .order("asc")
      .paginate(args.paginationOpts);

    let scanned = 0;
    let updated = 0;
    let labelsBackfilled = 0;
    let emailsBackfilled = 0;
    let notesBackfilled = 0;
    let skipped = 0;
    const samples: Array<{
      grantId: string;
      before: BackfillSnapshot;
      after: BackfillSnapshot;
    }> = [];
    const incompleteSamples: Array<{
      grantId: string;
      reason: string;
      before: BackfillSnapshot;
      after: BackfillSnapshot;
    }> = [];

    for (const grant of page.page) {
      scanned += 1;

      const relatedAccessCode = await ctx.db
        .query("accessCodes")
        .withIndex("by_consumedByGrantId", (q) =>
          q.eq("consumedByGrantId", grant._id),
        )
        .order("asc")
        .first();

      const before: BackfillSnapshot = {
        identityLabel: grant.identityLabel,
        identityEmail: grant.identityEmail,
        note: grant.note,
      };

      const currentLabel = normalizeMeaningfulIdentityLabel(grant.identityLabel);
      const accessCodeLabel = normalizeMeaningfulIdentityLabel(
        relatedAccessCode?.identityLabel,
      );
      const nextLabel =
        currentLabel ??
        accessCodeLabel ??
        buildLegacyGrantIdentityLabel(grant._id);

      const currentEmail = normalizeOptionalIdentityEmail(grant.identityEmail);
      const accessCodeEmail = normalizeOptionalIdentityEmail(
        relatedAccessCode?.identityEmail,
      );
      const nextEmail = currentEmail ?? accessCodeEmail;

      const currentNote = normalizeOptionalNote(grant.note);
      const accessCodeNote = normalizeOptionalNote(relatedAccessCode?.note);
      const nextNote = currentNote ?? accessCodeNote;

      const patch: Record<string, string> = {};
      let grantUpdated = false;

      if (nextLabel !== grant.identityLabel) {
        patch.identityLabel = nextLabel;
        labelsBackfilled += 1;
        grantUpdated = true;
      }

      if (nextEmail && nextEmail !== grant.identityEmail) {
        patch.identityEmail = nextEmail;
        emailsBackfilled += 1;
        grantUpdated = true;
      }

      if (nextNote && nextNote !== grant.note) {
        patch.note = nextNote;
        notesBackfilled += 1;
        grantUpdated = true;
      }

      const after: BackfillSnapshot = {
        identityLabel: nextLabel,
        ...(nextEmail ? { identityEmail: nextEmail } : {}),
        ...(nextNote ? { note: nextNote } : {}),
      };

      if (!normalizeMeaningfulIdentityLabel(after.identityLabel)) {
        if (incompleteSamples.length < SAMPLE_LIMIT) {
          incompleteSamples.push({
            grantId: grant._id,
            reason: "identityLabel fehlt weiterhin",
            before,
            after,
          });
        }
      }

      if (!grantUpdated) {
        skipped += 1;
        continue;
      }

      if (!dryRun) {
        await ctx.db.patch(grant._id, patch);
      }

      updated += 1;

      if (samples.length < SAMPLE_LIMIT) {
        samples.push({
          grantId: grant._id,
          before,
          after,
        });
      }
    }

    if (incompleteSamples.length > 0) {
      console.warn("Grant-Analytics-Backfill konnte nicht alle Felder füllen.", {
        scanned,
        updated,
        incompleteSamples,
      });
    }

    return {
      scanned,
      updated,
      labelsBackfilled,
      emailsBackfilled,
      notesBackfilled,
      skipped,
      dryRun,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      samples,
      incompleteSamples,
    };
  },
});
