import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";

const DEFAULT_RAW_RETENTION_DAYS = 14;
const DEFAULT_ANALYTICS_RETENTION_DAYS = 180;
const DEFAULT_BATCH_SIZE = 120;
const MAX_BATCHES_PER_RUN = 20;

const runRetentionBatchRef = makeFunctionReference<
  "mutation",
  { rawRetentionMs: number; analyticsRetentionMs: number; batchSize: number },
  { done: boolean; redactedDocuments: number; redactedResponses: number; deletedAnalyticsEvents: number }
>("retention:runRetentionBatch");

const sanitizePositiveInt = (value: string | undefined, fallbackValue: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
};

const resolveRetentionConfig = () => {
  const rawRetentionDays = sanitizePositiveInt(process.env.RETENTION_DAYS_RAW_CONTENT, DEFAULT_RAW_RETENTION_DAYS);
  const analyticsRetentionDays = sanitizePositiveInt(
    process.env.RETENTION_DAYS_ANALYTICS,
    DEFAULT_ANALYTICS_RETENTION_DAYS,
  );

  return {
    rawRetentionMs: rawRetentionDays * 24 * 60 * 60 * 1000,
    analyticsRetentionMs: analyticsRetentionDays * 24 * 60 * 60 * 1000,
  };
};

export const runRetentionBatch = internalMutation({
  args: {
    rawRetentionMs: v.number(),
    analyticsRetentionMs: v.number(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rawCutoff = now - args.rawRetentionMs;
    const analyticsCutoff = now - args.analyticsRetentionMs;

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

    const done =
      documents.length < args.batchSize &&
      responses.length < args.batchSize &&
      analyticsEvents.length < args.batchSize;

    return {
      done,
      redactedDocuments,
      redactedResponses,
      deletedAnalyticsEvents: analyticsEvents.length,
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
      batches: 0,
    };

    for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
      const result = await ctx.runMutation(runRetentionBatchRef, {
        rawRetentionMs: config.rawRetentionMs,
        analyticsRetentionMs: config.analyticsRetentionMs,
        batchSize: DEFAULT_BATCH_SIZE,
      });

      totals.redactedDocuments += result.redactedDocuments;
      totals.redactedResponses += result.redactedResponses;
      totals.deletedAnalyticsEvents += result.deletedAnalyticsEvents;
      totals.batches += 1;

      if (result.done) {
        break;
      }
    }

    return totals;
  },
});
