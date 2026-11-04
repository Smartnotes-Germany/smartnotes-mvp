import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import {
  resolvePostHogPersonProperties,
  serializeAnalyticsMetadata,
} from "./ai";
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
  subject: string,
) => {
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: `https://convex.test|${subject}`,
      email: "max@schule.de",
      name: "Max Mustermann",
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const sessionId = await ctx.db.insert("studySessions", {
      userId,
      title: "Analytics-Test",
      stage: "analysis",
      round: 1,
      sourceTopics: [],
      quizQuestions: [],
      createdAt: now,
      updatedAt: now,
    });

    return { userId, sessionId };
  });

  return { ...ids, asUser: t.withIdentity({ subject }) };
};

describe("convex/ai analytics metadata contract", () => {
  it("serialisiert interne AI-Metadaten unverändert als JSON", () => {
    const metadata = buildRawMetadata();

    const serialized = serializeAnalyticsMetadata(metadata);

    expect(serialized).toBeDefined();
    expect(JSON.parse(serialized ?? "null")).toEqual(metadata);
    expect(serialized).toContain(`"longText":"${"x".repeat(600)}"`);
  });

  it("erstellt PostHog-Person-Properties auch ohne identityLabel nur aus vorhandenen Feldern", () => {
    expect(
      resolvePostHogPersonProperties({
        analyticsUserId: "user-123",
        identityQuality: "app_only",
      }),
    ).toEqual({
      analyticsUserId: "user-123",
      identity_quality: "app_only",
    });
  });

  it("erstellt vollständige PostHog-Person-Properties wenn Label und E-Mail vorhanden sind", () => {
    expect(
      resolvePostHogPersonProperties({
        analyticsUserId: "user-123",
        identityLabel: "Jakob Rössner",
        identityEmail: "jakob.roessner@outlook.de",
        note: "Der Beste",
        identityQuality: "email",
      }),
    ).toEqual({
      analyticsUserId: "user-123",
      identityLabel: "Jakob Rössner",
      identityEmail: "jakob.roessner@outlook.de",
      note: "Der Beste",
      identity_quality: "email",
      $name: "Jakob Rössner",
      $email: "jakob.roessner@outlook.de",
    });
  });

  it("liefert rohe metadataJson-Werte über die Session-Analytics-Abfrage zurück", async () => {
    const t = createTestHarness();
    const { asUser, sessionId } = await createOwnedSession(
      t,
      "user_analytics_1",
    );
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

    const events = await asUser.query(api.study.getAiAnalyticsForSession, {
      sessionId,
      limit: 10,
    });

    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]?.metadataJson ?? "null")).toEqual(metadata);
  });

  it("findet den letzten Fehler weiter über clientRequestId in vollständigen Metadaten", async () => {
    const t = createTestHarness();
    const { asUser, sessionId } = await createOwnedSession(
      t,
      "user_analytics_2",
    );

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

    const latestFailure = await asUser.query(
      api.study.getLatestAiFailureByClientRequestId,
      {
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
