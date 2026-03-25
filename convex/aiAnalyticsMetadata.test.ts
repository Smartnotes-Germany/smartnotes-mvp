import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import { serializeAnalyticsMetadata } from "./ai";
import schema from "./schema";
import { modules } from "./test.setup";

const createTestHarness = () => convexTest(schema, modules);

const buildRawMetadata = () => ({
  clientRequestId: "client-request-123",
  documentIds: ["doc_123", "doc_456"],
  readyDocumentIds: ["doc_456"],
  longText: "x".repeat(600),
  responseCount: 3,
  usedFallback: false,
  arbitraryField: "bleibt erhalten",
  nested: {
    source: "deep-dive",
    ranking: [1, 2, 3],
  },
});

const createOwnedSession = async (
  t: ReturnType<typeof createTestHarness>,
  grantToken: string,
) => {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const grantId = await ctx.db.insert("accessGrants", {
      token: grantToken,
      createdAt: now,
      identityLabel: "Max Mustermann",
      identityEmail: "max@schule.de",
    });

    const sessionId = await ctx.db.insert("studySessions", {
      grantId,
      title: "Analytics-Test",
      stage: "analysis",
      round: 1,
      sourceTopics: [],
      quizQuestions: [],
      createdAt: now,
      updatedAt: now,
    });

    return { grantId, sessionId };
  });
};

describe("convex/ai analytics metadata contract", () => {
  it("serialisiert interne AI-Metadaten unverändert als JSON", () => {
    const metadata = buildRawMetadata();

    const serialized = serializeAnalyticsMetadata(metadata);

    expect(serialized).toBeDefined();
    expect(JSON.parse(serialized ?? "null")).toEqual(metadata);
    expect(serialized).toContain(`"longText":"${"x".repeat(600)}"`);
  });

  it("liefert rohe metadataJson-Werte über die Session-Analytics-Abfrage zurück", async () => {
    const t = createTestHarness();
    const grantToken = "grant-token-analytics-1";
    const { sessionId } = await createOwnedSession(t, grantToken);
    const metadata = buildRawMetadata();

    await t.mutation(internal.study.storeAiAnalyticsEvent, {
      traceId: "trace-analytics-1",
      sessionId,
      scope: "generateTopicDeepDive",
      status: "success",
      privacyMode: "balanced",
      contentCaptured: true,
      telemetryProvider: "langfuse",
      latencyMs: 420,
      metadataJson: serializeAnalyticsMetadata(metadata),
    });

    const events = await t.query(api.study.getAiAnalyticsForSession, {
      grantToken,
      sessionId,
      limit: 10,
    });

    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]?.metadataJson ?? "null")).toEqual(metadata);
  });

  it("findet den letzten Fehler weiter über clientRequestId in vollständigen Metadaten", async () => {
    const t = createTestHarness();
    const grantToken = "grant-token-analytics-2";
    const { sessionId } = await createOwnedSession(t, grantToken);

    await t.mutation(internal.study.storeAiAnalyticsEvent, {
      traceId: "trace-other",
      sessionId,
      scope: "generateQuiz",
      status: "error",
      privacyMode: "balanced",
      contentCaptured: true,
      telemetryProvider: "langfuse",
      latencyMs: 120,
      errorCategory: "unknown",
      errorMessage: "anderer Fehler",
      metadataJson: serializeAnalyticsMetadata({
        clientRequestId: "other-request",
        nested: { keep: true },
      }),
    });

    await t.mutation(internal.study.storeAiAnalyticsEvent, {
      traceId: "trace-target",
      sessionId,
      scope: "analyzePerformance",
      status: "error",
      privacyMode: "balanced",
      contentCaptured: true,
      telemetryProvider: "langfuse",
      latencyMs: 300,
      errorCategory: "vertex_request_failed",
      errorName: "VertexError",
      errorMessage: "Ziel-Fehler",
      metadataJson: serializeAnalyticsMetadata({
        clientRequestId: "target-request",
        documentIds: ["doc_1", "doc_2"],
        nested: { mode: "full", score: 88 },
      }),
    });

    const latestFailure = await t.query(
      api.study.getLatestAiFailureByClientRequestId,
      {
        grantToken,
        sessionId,
        clientRequestId: "target-request",
      },
    );

    expect(latestFailure).toMatchObject({
      traceId: "trace-target",
      scope: "analyzePerformance",
      errorCategory: "vertex_request_failed",
      errorName: "VertexError",
      errorMessage: "Ziel-Fehler",
    });
  });
});
