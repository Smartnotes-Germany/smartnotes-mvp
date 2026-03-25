import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import {
  buildPostHogEvent,
  queueAndDeliverPostHogEvents,
} from "./analyticsPosthog";
import {
  POSTHOG_PENDING_ORPHAN_THRESHOLD_MS,
  type PostHogProperties,
} from "./analyticsOutbox";
import schema from "./schema";
import { modules } from "./test.setup";

const createTestHarness = () => convexTest(schema, modules);

const buildTestProperties = (): PostHogProperties => ({
  status: "succeeded",
  identityEmail: "max@schule.de",
  normalizedCode: "SMARTNOTES-ABCD1234",
  documentIds: ["doc_123", "doc_456"],
  traceId: "trace-123",
});

const buildTestPersonProperties = (): PostHogProperties => ({
  identityLabel: "Max Mustermann",
  identityEmail: "max@schule.de",
  note: "LK Biologie",
});

describe("convex/analyticsPosthog delivery contract", () => {
  beforeEach(() => {
    process.env.POSTHOG_ENABLED = "true";
    process.env.POSTHOG_PROJECT_KEY = "test-project-key";
  });

  afterEach(() => {
    delete process.env.POSTHOG_ENABLED;
    delete process.env.POSTHOG_PROJECT_KEY;
    delete process.env.POSTHOG_HOST;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("persistiert und sendet beim ersten Zustellversuch den originalen Payload unverändert", async () => {
    const properties = buildTestProperties();
    const personProperties = buildTestPersonProperties();
    const mutationCalls: unknown[] = [];
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await queueAndDeliverPostHogEvents(
      {
        runMutation: async (_reference, args) => {
          mutationCalls.push(args);

          if (mutationCalls.length === 1) {
            return "jt7d9xwz9v9s1m2n3p4q5r6s7t8u9v0w";
          }

          return null;
        },
      },
      [
        buildPostHogEvent({
          scope: "ai_bridge",
          event: "ai_operation_completed",
          distinctId: "smartnotes-user:email:max@schule.de",
          properties,
          personProperties,
          insertId: "insert-1",
        }),
      ],
    );

    expect(mutationCalls[0]).toMatchObject({
      scope: "ai_bridge",
      event: "ai_operation_completed",
      distinctId: "smartnotes-user:email:max@schule.de",
      propertiesJson: JSON.stringify(properties),
      personPropertiesJson: JSON.stringify(personProperties),
      insertId: "insert-1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchMock.mock.calls[0]?.[1];
    const requestBody = JSON.parse(String(requestInit?.body)) as {
      event: string;
      distinct_id: string;
      properties: PostHogProperties & {
        $insert_id: string;
        $set: PostHogProperties;
      };
    };

    expect(requestBody).toMatchObject({
      event: "ai_operation_completed",
      distinct_id: "smartnotes-user:email:max@schule.de",
    });
    expect(requestBody.properties.identityEmail).toBe("max@schule.de");
    expect(requestBody.properties.normalizedCode).toBe("SMARTNOTES-ABCD1234");
    expect(requestBody.properties.documentIds).toEqual(["doc_123", "doc_456"]);
    expect(requestBody.properties.$set).toMatchObject(personProperties);
    expect(requestBody.properties.$insert_id).toBe("insert-1");
  });

  it("liefert beim Retry exakt den im Outbox-Eintrag gespeicherten Roh-Payload aus", async () => {
    const t = createTestHarness();
    const properties = buildTestProperties();
    const personProperties = buildTestPersonProperties();
    const createdAt = Date.now() - POSTHOG_PENDING_ORPHAN_THRESHOLD_MS - 1_000;
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const outboxId = await t.run(async (ctx) => {
      return await ctx.db.insert("posthogEventOutbox", {
        scope: "ai_bridge",
        event: "ai_operation_completed",
        distinctId: "smartnotes-user:email:max@schule.de",
        propertiesJson: JSON.stringify(properties),
        personPropertiesJson: JSON.stringify(personProperties),
        insertId: "insert-retry-1",
        deliveryStatus: "pending",
        attemptCount: 0,
        createdAt,
        updatedAt: createdAt,
      });
    });

    const result = await t.action(
      internal.analyticsPosthog.processPostHogOutbox,
      {
        limit: 10,
      },
    );

    expect(result).toEqual({ processed: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const requestBody = JSON.parse(String(requestInit?.body)) as {
      properties: PostHogProperties & {
        $insert_id: string;
        $set: PostHogProperties;
      };
    };

    expect(requestBody.properties.identityEmail).toBe("max@schule.de");
    expect(requestBody.properties.normalizedCode).toBe("SMARTNOTES-ABCD1234");
    expect(requestBody.properties.documentIds).toEqual(["doc_123", "doc_456"]);
    expect(requestBody.properties.$set).toMatchObject(personProperties);
    expect(requestBody.properties.$insert_id).toBe("insert-retry-1");

    const storedEvent = await t.run(async (ctx) => await ctx.db.get(outboxId));

    expect(storedEvent).toMatchObject({
      deliveryStatus: "delivered",
      attemptCount: 1,
      propertiesJson: JSON.stringify(properties),
      personPropertiesJson: JSON.stringify(personProperties),
      insertId: "insert-retry-1",
    });
  });
});
