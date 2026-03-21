"use node";

import { createHash } from "node:crypto";
import type { Doc } from "./_generated/dataModel";
import type { ActionCtx } from "./errorTracking";
import { internalAction } from "./errorTracking";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  MAX_POSTHOG_ATTEMPTS,
  POSTHOG_PENDING_ORPHAN_THRESHOLD_MS,
  type PostHogOutboxId,
  type PostHogProperties,
} from "./analyticsOutbox";
import {
  readBooleanEnv,
  readOptionalEnv,
  readOptionalEnvFromAliases,
} from "./env";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";
const CAPTURE_TIMEOUT_MS = 1_500;
const POSTHOG_RETRY_BATCH_SIZE = 50;
const HASH_PREVIEW_LENGTH = 12;
const MAX_STORED_TEXT_LENGTH = 160;
const SAFE_PROPERTY_KEYS = new Set([
  "identity_quality",
  "status",
  "scope",
  "source",
  "attribution",
  "app_area",
  "source_surface",
  "environment",
]);
const SENSITIVE_PROPERTY_KEY_PATTERN =
  /(?:^|[_$.])(email|name|label|note|code|token|grant|session|trace|distinct|identity|person|phone|address|input|output|message|stack|documentids?|readydocumentids?|traceid|analyticsgrantid|normalizedcode)(?:$|[_$.])/i;
const SENSITIVE_STRING_VALUE_PATTERN =
  /@|smartnotes-|^ph-|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9+/_=-]{24,}/i;

type DeliverablePostHogEvent = {
  scope: string;
  event: string;
  distinctId: string;
  properties: PostHogProperties;
  personProperties?: PostHogProperties;
  insertId: string;
};

const createInsertId = () => {
  const maybeCrypto = globalThis as {
    crypto?: {
      randomUUID?: () => string;
    };
  };

  return (
    maybeCrypto.crypto?.randomUUID?.() ??
    `ph-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
};

const getServerBaseProperties = () => {
  const environment = readOptionalEnvFromAliases([
    "POSTHOG_APP_ENV",
    "APP_ENV",
  ]);

  return {
    app_area: "app",
    source_surface: "server",
    ...(environment ? { environment } : {}),
  } satisfies PostHogProperties;
};

const getPostHogConfig = () => {
  if (!readBooleanEnv("POSTHOG_ENABLED")) {
    return null;
  }

  const projectKey = readOptionalEnv("POSTHOG_PROJECT_KEY");
  if (!projectKey) {
    return null;
  }

  const rawHost = readOptionalEnv("POSTHOG_HOST") ?? DEFAULT_POSTHOG_HOST;
  const host = rawHost.endsWith("/") ? rawHost.slice(0, -1) : rawHost;

  return {
    host,
    projectKey,
  };
};

const serializeProperties = (value: PostHogProperties | undefined) =>
  JSON.stringify(value ?? {});

const deserializeProperties = (value: string) =>
  JSON.parse(value) as PostHogProperties;

const hashStoredToken = (value: string) =>
  createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, HASH_PREVIEW_LENGTH);

const redactStoredToken = (value: string) => `hash:${hashStoredToken(value)}`;

const shouldHashStoredValue = (key: string, value: string) =>
  (!SAFE_PROPERTY_KEYS.has(key) && SENSITIVE_PROPERTY_KEY_PATTERN.test(key)) ||
  SENSITIVE_STRING_VALUE_PATTERN.test(value);

const sanitizeStoredPrimitive = (
  key: string,
  value: string | number | boolean,
): string | number | boolean => {
  if (typeof value !== "string") {
    return value;
  }

  if (shouldHashStoredValue(key, value)) {
    return redactStoredToken(value);
  }

  return value.length > MAX_STORED_TEXT_LENGTH
    ? `${value.slice(0, MAX_STORED_TEXT_LENGTH - 3)}...`
    : value;
};

const sanitizeStoredArray = (
  key: string,
  value: Array<string | number | boolean>,
) => value.map((entry) => sanitizeStoredPrimitive(key, entry));

export const sanitizePostHogPropertiesForStorage = (
  value: PostHogProperties | undefined,
): PostHogProperties => {
  if (!value) {
    return {};
  }

  const sanitized: PostHogProperties = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      continue;
    }

    sanitized[key] = Array.isArray(entry)
      ? sanitizeStoredArray(key, entry)
      : sanitizeStoredPrimitive(key, entry);
  }

  return sanitized;
};

export const sanitizePostHogErrorMessageForStorage = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "redacted_error";
  }

  const sanitized = trimmed
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/smartnotes-[^\s,)]+/gi, "[redacted-id]")
    .replace(/[A-Za-z0-9+/_=-]{24,}/g, "[redacted-token]");
  const normalized =
    sanitized.length > MAX_STORED_TEXT_LENGTH
      ? `${sanitized.slice(0, MAX_STORED_TEXT_LENGTH - 3)}...`
      : sanitized;

  if (normalized === trimmed) {
    return normalized;
  }

  return `${normalized} [hash:${hashStoredToken(trimmed)}]`;
};

const errorMessageFromUnknown = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const deliverPostHogEvent = async (payload: DeliverablePostHogEvent) => {
  const config = getPostHogConfig();
  if (!config) {
    return { skipped: true as const };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, CAPTURE_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.host}/capture/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: config.projectKey,
        event: payload.event,
        distinct_id: payload.distinctId,
        properties: {
          ...getServerBaseProperties(),
          ...payload.properties,
          $insert_id: payload.insertId,
          ...(payload.personProperties
            ? { $set: payload.personProperties }
            : {}),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `PostHog-Capture fehlgeschlagen (${response.status}) für ${payload.event}.`,
      );
    }

    return { skipped: false as const };
  } finally {
    clearTimeout(timeout);
  }
};

const markDeliveryResult = async (
  ctx: Pick<ActionCtx, "runMutation">,
  outboxId: PostHogOutboxId,
  attemptCount: number,
  error: unknown | null,
) => {
  const now = Date.now();
  if (!error) {
    await ctx.runMutation(internal.analyticsOutbox.markDelivered, {
      outboxId,
      attemptCount,
      deliveredAt: now,
    });
    return;
  }

  const lastErrorMessage = errorMessageFromUnknown(error);
  const sanitizedLastErrorMessage =
    sanitizePostHogErrorMessageForStorage(lastErrorMessage);

  if (attemptCount >= MAX_POSTHOG_ATTEMPTS) {
    await ctx.runMutation(internal.analyticsOutbox.markDeadLetter, {
      outboxId,
      attemptCount,
      lastErrorMessage: sanitizedLastErrorMessage,
      now,
    });
    return;
  }

  await ctx.runMutation(internal.analyticsOutbox.markRetry, {
    outboxId,
    attemptCount,
    lastErrorMessage: sanitizedLastErrorMessage,
    now,
  });
};

const deliverQueuedEvent = async (
  ctx: Pick<ActionCtx, "runMutation">,
  outboxId: PostHogOutboxId,
  payload: DeliverablePostHogEvent,
  previousAttemptCount: number,
) => {
  const nextAttemptCount = previousAttemptCount + 1;

  try {
    const result = await deliverPostHogEvent(payload);
    await ctx.runMutation(internal.analyticsOutbox.markDelivered, {
      outboxId,
      attemptCount: result.skipped ? previousAttemptCount : nextAttemptCount,
      deliveredAt: Date.now(),
    });
  } catch (error) {
    await markDeliveryResult(ctx, outboxId, nextAttemptCount, error);
  }
};

export const queueAndDeliverPostHogEvents = async (
  ctx: Pick<ActionCtx, "runMutation">,
  events: DeliverablePostHogEvent[],
) => {
  for (const event of events) {
    const sanitizedProperties = sanitizePostHogPropertiesForStorage(
      event.properties,
    );
    const sanitizedPersonProperties = sanitizePostHogPropertiesForStorage(
      event.personProperties,
    );
    const outboxId = await ctx.runMutation(
      internal.analyticsOutbox.enqueueEvent,
      {
        scope: event.scope,
        event: event.event,
        distinctId: event.distinctId,
        propertiesJson: serializeProperties(sanitizedProperties),
        ...(Object.keys(sanitizedPersonProperties).length > 0
          ? {
              personPropertiesJson: serializeProperties(
                sanitizedPersonProperties,
              ),
            }
          : {}),
        insertId: event.insertId,
      },
    );

    await deliverQueuedEvent(ctx, outboxId, event, 0);
  }
};

export const buildPostHogEvent = (
  event: Omit<DeliverablePostHogEvent, "insertId"> & { insertId?: string },
): DeliverablePostHogEvent => ({
  ...event,
  insertId: event.insertId ?? createInsertId(),
});

export const processPostHogOutbox = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const now = Date.now();
    const limit = args.limit ?? POSTHOG_RETRY_BATCH_SIZE;
    const orphanedPendingEvents: Doc<"posthogEventOutbox">[] =
      await ctx.runQuery(internal.analyticsOutbox.listOrphanedPendingEvents, {
        createdBefore: now - POSTHOG_PENDING_ORPHAN_THRESHOLD_MS,
        limit,
      });

    const remainingCapacity = Math.max(limit - orphanedPendingEvents.length, 0);
    const retryableEvents: Doc<"posthogEventOutbox">[] =
      remainingCapacity > 0
        ? await ctx.runQuery(internal.analyticsOutbox.listRetryableEvents, {
            now,
            limit: remainingCapacity,
          })
        : [];

    const events = [...orphanedPendingEvents, ...retryableEvents].sort(
      (left, right) => left.createdAt - right.createdAt,
    );

    for (const event of events) {
      await deliverQueuedEvent(
        ctx,
        event._id,
        {
          scope: event.scope,
          event: event.event,
          distinctId: event.distinctId,
          properties: deserializeProperties(event.propertiesJson),
          personProperties: event.personPropertiesJson
            ? deserializeProperties(event.personPropertiesJson)
            : undefined,
          insertId: event.insertId,
        },
        event.attemptCount,
      );
    }

    return {
      processed: events.length,
    };
  },
});
