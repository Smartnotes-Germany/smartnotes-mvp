import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalAction, internalMutation } from "./errorTracking";
import { readIntegerEnv } from "./env";
import { components } from "./_generated/api";

const DEFAULT_RAW_RETENTION_DAYS = 14;
const DEFAULT_ANALYTICS_RETENTION_DAYS = 180;
const DEFAULT_POSTHOG_OUTBOX_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 120;
const MAX_BATCHES_PER_RUN = 20;
const DELETABLE_OUTBOX_STATUSES = ["dead_letter", "delivered"] as const;

const runRetentionBatchRef = makeFunctionReference<
  "mutation",
  {
    rawRetentionMs: number;
    analyticsRetentionMs: number;
    posthogOutboxRetentionMs: number;
    batchSize: number;
  },
  {
    done: boolean;
    redactedDocuments: number;
    redactedResponses: number;
    deletedAnalyticsEvents: number;
    deletedPostHogOutboxEvents: number;
  }
>("retention:runRetentionBatch");

const resolveRetentionConfig = () => {
  const rawRetentionDays = readIntegerEnv(
    "RETENTION_DAYS_RAW_CONTENT",
    DEFAULT_RAW_RETENTION_DAYS,
    { min: 1 },
  );
  const analyticsRetentionDays = readIntegerEnv(
    "RETENTION_DAYS_ANALYTICS",
    DEFAULT_ANALYTICS_RETENTION_DAYS,
    { min: 1 },
  );
  const posthogOutboxRetentionDays = readIntegerEnv(
    "RETENTION_DAYS_POSTHOG_OUTBOX",
    DEFAULT_POSTHOG_OUTBOX_RETENTION_DAYS,
    { min: 1 },
  );

  return {
    rawRetentionMs: rawRetentionDays * 24 * 60 * 60 * 1000,
    analyticsRetentionMs: analyticsRetentionDays * 24 * 60 * 60 * 1000,
    posthogOutboxRetentionMs: posthogOutboxRetentionDays * 24 * 60 * 60 * 1000,
  };
};

export const runRetentionBatch = internalMutation({
  args: {
    rawRetentionMs: v.number(),
    analyticsRetentionMs: v.number(),
    posthogOutboxRetentionMs: v.number(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rawCutoff = now - args.rawRetentionMs;
    const analyticsCutoff = now - args.analyticsRetentionMs;
    const posthogOutboxCutoff = now - args.posthogOutboxRetentionMs;

    const documents = await ctx.db
      .query("sessionDocuments")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", rawCutoff))
      .order("asc")
      .take(args.batchSize);

    let redactedDocuments = 0;
    for (const document of documents) {
      if (!document.extractedText) {
        continue;
      }

      await ctx.db.patch(document._id, {
        extractedText: undefined,
        updatedAt: now,
      });
      redactedDocuments += 1;
    }

    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", rawCutoff))
      .order("asc")
      .take(args.batchSize);

    let redactedResponses = 0;
    for (const response of responses) {
      if (response.userAnswer === "[entfernt]") {
        continue;
      }

      await ctx.db.patch(response._id, {
        userAnswer: "[entfernt]",
        updatedAt: now,
      });
      redactedResponses += 1;
    }

    const analyticsEvents = await ctx.db
      .query("aiAnalyticsEvents")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", analyticsCutoff))
      .order("asc")
      .take(args.batchSize);

    for (const event of analyticsEvents) {
      await ctx.db.delete(event._id);
    }

    const eligibleOutboxEvents = (
      await Promise.all(
        DELETABLE_OUTBOX_STATUSES.map((deliveryStatus) =>
          ctx.db
            .query("posthogEventOutbox")
            .withIndex("by_deliveryStatus_createdAt", (q) =>
              q
                .eq("deliveryStatus", deliveryStatus)
                .lt("createdAt", posthogOutboxCutoff),
            )
            .order("asc")
            .take(args.batchSize),
        ),
      )
    )
      .flat()
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(0, args.batchSize);

    for (const event of eligibleOutboxEvents) {
      await ctx.db.delete(event._id);
    }

    const deletedPostHogOutboxEvents = eligibleOutboxEvents.length;

    const done =
      documents.length < args.batchSize &&
      responses.length < args.batchSize &&
      analyticsEvents.length < args.batchSize &&
      deletedPostHogOutboxEvents < args.batchSize;

    return {
      done,
      redactedDocuments,
      redactedResponses,
      deletedAnalyticsEvents: analyticsEvents.length,
      deletedPostHogOutboxEvents,
    };
  },
});

export const runDailyRetention = internalAction({
  args: {},
  handler: async (ctx) => {
    const config = resolveRetentionConfig();
    const totals = {
      redactedDocuments: 0,
      redactedResponses: 0,
      deletedAnalyticsEvents: 0,
      deletedPostHogOutboxEvents: 0,
      deletedManagedFiles: 0,
      batches: 0,
    };

    for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
      const result = await ctx.runMutation(runRetentionBatchRef, {
        rawRetentionMs: config.rawRetentionMs,
        analyticsRetentionMs: config.analyticsRetentionMs,
        posthogOutboxRetentionMs: config.posthogOutboxRetentionMs,
        batchSize: DEFAULT_BATCH_SIZE,
      });

      totals.redactedDocuments += result.redactedDocuments;
      totals.redactedResponses += result.redactedResponses;
      totals.deletedAnalyticsEvents += result.deletedAnalyticsEvents;
      totals.deletedPostHogOutboxEvents += result.deletedPostHogOutboxEvents;
      totals.batches += 1;

      if (result.done) {
        break;
      }
    }

    for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
      const cleanupResult = await ctx.runMutation(
        components.convexFilesControl.cleanUp.cleanupExpired,
        {
          limit: DEFAULT_BATCH_SIZE,
        },
      );

      totals.deletedManagedFiles += cleanupResult.deletedCount;

      if (!cleanupResult.hasMore) {
        break;
      }
    }

    return totals;
  },
});
