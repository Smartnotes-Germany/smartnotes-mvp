import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./errorTracking";

export const MAX_POSTHOG_ATTEMPTS = 5;

export type PostHogPrimitive = string | number | boolean;
export type PostHogPropertyValue =
  | PostHogPrimitive
  | PostHogPrimitive[]
  | undefined;
export type PostHogProperties = Record<string, PostHogPropertyValue>;

export const deliveryStatusValidator = v.union(
  v.literal("pending"),
  v.literal("retry"),
  v.literal("delivered"),
  v.literal("dead_letter"),
);

const outboxIdValidator = v.id("posthogEventOutbox");

const buildNextRetryAt = (attemptCount: number, now: number) => {
  switch (attemptCount) {
    case 1:
      return now + 60_000;
    case 2:
      return now + 5 * 60_000;
    case 3:
      return now + 15 * 60_000;
    case 4:
      return now + 60 * 60_000;
    default:
      return null;
  }
};

export const enqueueEvent = internalMutation({
  args: {
    scope: v.string(),
    event: v.string(),
    distinctId: v.string(),
    propertiesJson: v.string(),
    personPropertiesJson: v.optional(v.string()),
    insertId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("posthogEventOutbox", {
      scope: args.scope,
      event: args.event,
      distinctId: args.distinctId,
      propertiesJson: args.propertiesJson,
      ...(args.personPropertiesJson
        ? { personPropertiesJson: args.personPropertiesJson }
        : {}),
      insertId: args.insertId,
      deliveryStatus: "pending",
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listRetryableEvents = internalQuery({
  args: {
    now: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("posthogEventOutbox")
      .withIndex("by_deliveryStatus_nextRetryAt", (q) =>
        q.eq("deliveryStatus", "retry").lte("nextRetryAt", args.now),
      )
      .order("asc")
      .take(args.limit);
  },
});

export const markDelivered = internalMutation({
  args: {
    outboxId: outboxIdValidator,
    attemptCount: v.number(),
    deliveredAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.outboxId, {
      deliveryStatus: "delivered",
      attemptCount: args.attemptCount,
      deliveredAt: args.deliveredAt,
      lastErrorMessage: undefined,
      nextRetryAt: undefined,
      updatedAt: args.deliveredAt,
    });
  },
});

export const markRetry = internalMutation({
  args: {
    outboxId: outboxIdValidator,
    attemptCount: v.number(),
    lastErrorMessage: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const nextRetryAt = buildNextRetryAt(args.attemptCount, args.now);
    if (nextRetryAt === null) {
      throw new Error(
        "markRetry wurde mit einer Versuchszahl ohne gültiges Retry-Fenster aufgerufen.",
      );
    }

    await ctx.db.patch(args.outboxId, {
      deliveryStatus: "retry",
      attemptCount: args.attemptCount,
      lastErrorMessage: args.lastErrorMessage,
      nextRetryAt,
      updatedAt: args.now,
    });
  },
});

export const markDeadLetter = internalMutation({
  args: {
    outboxId: outboxIdValidator,
    attemptCount: v.number(),
    lastErrorMessage: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.outboxId, {
      deliveryStatus: "dead_letter",
      attemptCount: args.attemptCount,
      lastErrorMessage: args.lastErrorMessage,
      nextRetryAt: undefined,
      updatedAt: args.now,
    });
  },
});

export const getPostHogOutboxRetryAt = (attemptCount: number, now: number) =>
  buildNextRetryAt(attemptCount, now);

export const isPostHogOutboxExhausted = (attemptCount: number) =>
  attemptCount >= MAX_POSTHOG_ATTEMPTS;

export type PostHogOutboxId = Id<"posthogEventOutbox">;
