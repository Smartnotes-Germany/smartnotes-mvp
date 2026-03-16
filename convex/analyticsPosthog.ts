"use node";

import type { Doc } from "./_generated/dataModel";
import type { ActionCtx } from "./errorTracking";
import { internalAction } from "./errorTracking";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  MAX_POSTHOG_ATTEMPTS,
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

  if (attemptCount >= MAX_POSTHOG_ATTEMPTS) {
    await ctx.runMutation(internal.analyticsOutbox.markDeadLetter, {
      outboxId,
      attemptCount,
      lastErrorMessage,
      now,
    });
    return;
  }

  await ctx.runMutation(internal.analyticsOutbox.markRetry, {
    outboxId,
    attemptCount,
    lastErrorMessage,
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
    const outboxId = await ctx.runMutation(
      internal.analyticsOutbox.enqueueEvent,
      {
        scope: event.scope,
        event: event.event,
        distinctId: event.distinctId,
        propertiesJson: serializeProperties(event.properties),
        ...(event.personProperties
          ? {
              personPropertiesJson: serializeProperties(event.personProperties),
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
    const events: Doc<"posthogEventOutbox">[] = await ctx.runQuery(
      internal.analyticsOutbox.listRetryableEvents,
      {
        now,
        limit: args.limit ?? POSTHOG_RETRY_BATCH_SIZE,
      },
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
