import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const createTestHarness = () => convexTest(schema, modules);

const buildQuizQuestion = (
  overrides?: Partial<{
    id: string;
    topic: string;
    prompt: string;
    idealAnswer: string;
    explanationHint: string;
  }>,
) => ({
  id: overrides?.id ?? "frage-1",
  topic: overrides?.topic ?? "Photosynthese",
  prompt: overrides?.prompt ?? "Erkläre die Lichtreaktion.",
  idealAnswer: overrides?.idealAnswer ?? "ATP und NADPH entstehen.",
  explanationHint:
    overrides?.explanationHint ?? "Beschreibe die Umwandlung von Lichtenergie.",
});

const buildAnalysis = (
  overrides?: Partial<{
    overallReadiness: number;
    strongestTopics: string[];
    weakestTopics: string[];
    recommendedNextStep: string;
  }>,
) => ({
  overallReadiness: overrides?.overallReadiness ?? 78,
  strongestTopics: overrides?.strongestTopics ?? ["Photosynthese"],
  weakestTopics: overrides?.weakestTopics ?? ["Zellatmung"],
  topics: [
    {
      topic: "Photosynthese",
      comfortScore: 78,
      rationale: "Sicherer Umgang mit den Grundlagen.",
      recommendation: "Mehr Details zu ATP und NADPH üben.",
    },
  ],
  recommendedNextStep:
    overrides?.recommendedNextStep ?? "Die Dunkelreaktion gezielt wiederholen.",
});

const createOwnedSession = async (
  t: ReturnType<typeof createTestHarness>,
  overrides?: Partial<{
    title: string;
    stage: "upload" | "quiz" | "analysis";
    round: number;
    focusTopics: string[];
    sourceSummary: string;
    sourceTopics: string[];
    quizQuestions: ReturnType<typeof buildQuizQuestion>[];
    analysis: ReturnType<typeof buildAnalysis>;
    updatedAt: number;
  }>,
) => {
  const now = Date.now();

  return t.run(async (ctx) => {
    const grantToken = `grant-${Math.random().toString(36).slice(2)}`;
    const grantId = await ctx.db.insert("accessGrants", {
      token: grantToken,
      createdAt: now,
      identityLabel: "Testnutzer",
    });

    const sessionId = await ctx.db.insert("studySessions", {
      grantId,
      title: overrides?.title ?? "Studientest",
      stage: overrides?.stage ?? "quiz",
      round: overrides?.round ?? 2,
      ...(overrides?.focusTopics ? { focusTopics: overrides.focusTopics } : {}),
      ...(overrides?.sourceSummary
        ? { sourceSummary: overrides.sourceSummary }
        : {}),
      sourceTopics: overrides?.sourceTopics ?? ["Photosynthese"],
      quizQuestions: overrides?.quizQuestions ?? [buildQuizQuestion()],
      ...(overrides?.analysis ? { analysis: overrides.analysis } : {}),
      createdAt: now,
      updatedAt: overrides?.updatedAt ?? now - 1_000,
    });

    return { grantToken, grantId, sessionId };
  });
};

describe("convex/study", () => {
  it("liefert im Session-Snapshot nur die für die UI benötigten Felder", async () => {
    const t = createTestHarness();
    const now = Date.now();

    const { grantToken, sessionId } = await t.run(async (ctx) => {
      const grantToken = "snapshot-grant-token";
      const grantId = await ctx.db.insert("accessGrants", {
        token: grantToken,
        createdAt: now,
        identityLabel: "Testnutzer",
      });

      const sessionId = await ctx.db.insert("studySessions", {
        grantId,
        title: "Snapshot-Test",
        stage: "quiz",
        round: 2,
        focusTopics: ["Photosynthese"],
        sourceSummary:
          "Interne Zusammenfassung, die nicht im UI-Snapshot sein soll.",
        sourceTopics: ["Photosynthese", "Zellatmung"],
        quizQuestions: [
          buildQuizQuestion({
            idealAnswer: "Interne Musterlösung",
            explanationHint: "Interner Hinweis",
          }),
        ],
        analysis: buildAnalysis(),
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("sessionDocuments", {
        sessionId,
        storageId: "storage-intern",
        storageProvider: "convex",
        fileName: "skript.pdf",
        fileType: "application/pdf",
        fileSizeBytes: 1_024,
        extractionStatus: "ready",
        extractedText:
          "Interner Extraktionstext, der nicht im UI-Snapshot auftauchen soll.",
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("quizResponses", {
        sessionId,
        round: 2,
        questionId: "frage-1",
        topic: "Photosynthese",
        prompt: "Erkläre die Lichtreaktion.",
        userAnswer: "Mit Lichtenergie werden ATP und NADPH gebildet.",
        isCorrect: true,
        score: 100,
        explanation: "Vollständig beantwortet.",
        idealAnswer: "Interne Musterlösung",
        misunderstanding: "Kein spezifisches Missverständnis",
        timeSpentSeconds: 18,
        createdAt: now,
        updatedAt: now,
      });

      return { grantToken, sessionId };
    });

    const snapshot = await t.query(api.study.getSessionSnapshot, {
      grantToken,
      sessionId,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.session).toMatchObject({
      _id: sessionId,
      stage: "quiz",
      focusTopics: ["Photosynthese"],
      sourceTopics: ["Photosynthese", "Zellatmung"],
      analysis: {
        overallReadiness: 78,
      },
    });
    expect(snapshot?.session).not.toHaveProperty("title");
    expect(snapshot?.session).not.toHaveProperty("sourceSummary");
    expect(snapshot?.session.quizQuestions[0]).toEqual({
      id: "frage-1",
      topic: "Photosynthese",
      prompt: "Erkläre die Lichtreaktion.",
    });
    expect(snapshot?.documents[0]).toEqual({
      _id: snapshot?.documents[0]?._id,
      fileName: "skript.pdf",
      fileType: "application/pdf",
      fileSizeBytes: 1_024,
      extractionStatus: "ready",
    });
    expect(snapshot?.documents[0]).not.toHaveProperty("storageId");
    expect(snapshot?.documents[0]).not.toHaveProperty("extractedText");
    expect(snapshot?.answeredQuestionIds).toEqual(["frage-1"]);
    expect(snapshot?.stats).toEqual({
      totalQuestions: 1,
      answeredQuestions: 1,
      readyDocuments: 1,
    });
  });

  it("überspringt unveränderte focusTopics und schreibt bei einer Themenänderung", async () => {
    const t = createTestHarness();
    const initialUpdatedAt = Date.now() - 5_000;
    const { grantToken, sessionId } = await createOwnedSession(t, {
      focusTopics: ["Photosynthese"],
      updatedAt: initialUpdatedAt,
    });

    await t.mutation(api.study.setFocusTopics, {
      grantToken,
      sessionId,
      focusTopics: ["Photosynthese"],
    });

    const unchangedSession = await t.run(async (ctx) =>
      ctx.db.get("studySessions", sessionId),
    );
    expect(unchangedSession?.updatedAt).toBe(initialUpdatedAt);
    expect(unchangedSession?.focusTopics).toEqual(["Photosynthese"]);

    await t.mutation(api.study.setFocusTopics, {
      grantToken,
      sessionId,
      focusTopics: ["Photosynthese", "Zellatmung"],
    });

    const changedSession = await t.run(async (ctx) =>
      ctx.db.get("studySessions", sessionId),
    );
    expect(changedSession?.updatedAt).toBeGreaterThan(initialUpdatedAt);
    expect(changedSession?.focusTopics).toEqual([
      "Photosynthese",
      "Zellatmung",
    ]);
  });

  it("überspringt unveränderte Extraktionsergebnisse und speichert einen Text-Delta", async () => {
    const t = createTestHarness();
    const initialUpdatedAt = Date.now() - 5_000;
    const { sessionId } = await createOwnedSession(t, {
      updatedAt: initialUpdatedAt,
    });

    const documentId = await t.run(async (ctx) =>
      ctx.db.insert("sessionDocuments", {
        sessionId,
        storageId: "storage-1",
        storageProvider: "convex",
        fileName: "skript.pdf",
        fileType: "application/pdf",
        fileSizeBytes: 1_024,
        extractionStatus: "ready",
        extractedText: "Ursprungstext",
        createdAt: initialUpdatedAt - 100,
        updatedAt: initialUpdatedAt,
      }),
    );

    await t.mutation(internal.study.setDocumentExtractionResult, {
      documentId,
      extractionStatus: "ready",
      extractedText: "Ursprungstext",
    });

    const unchangedDocument = await t.run(async (ctx) =>
      ctx.db.get("sessionDocuments", documentId),
    );
    expect(unchangedDocument?.updatedAt).toBe(initialUpdatedAt);
    expect(unchangedDocument?.extractedText).toBe("Ursprungstext");

    await t.mutation(internal.study.setDocumentExtractionResult, {
      documentId,
      extractionStatus: "ready",
      extractedText: "Aktualisierter Text",
    });

    const changedDocument = await t.run(async (ctx) =>
      ctx.db.get("sessionDocuments", documentId),
    );
    expect(changedDocument?.updatedAt).toBeGreaterThan(initialUpdatedAt);
    expect(changedDocument?.extractedText).toBe("Aktualisierter Text");
  });

  it("überspringt identische Quizgenerierung und erhöht bei neuen Fragen die Runde", async () => {
    const t = createTestHarness();
    const initialUpdatedAt = Date.now() - 5_000;
    const existingQuestion = buildQuizQuestion();
    const { sessionId } = await createOwnedSession(t, {
      stage: "quiz",
      round: 2,
      focusTopics: ["Photosynthese"],
      sourceSummary: "Bestehende Zusammenfassung",
      sourceTopics: ["Photosynthese"],
      quizQuestions: [existingQuestion],
      updatedAt: initialUpdatedAt,
    });

    await t.mutation(internal.study.storeGeneratedQuiz, {
      sessionId,
      sourceSummary: "Bestehende Zusammenfassung",
      sourceTopics: ["Photosynthese"],
      quizQuestions: [existingQuestion],
      incrementRound: true,
      currentFocusTopic: "Photosynthese",
    });

    const unchangedSession = await t.run(async (ctx) =>
      ctx.db.get("studySessions", sessionId),
    );
    expect(unchangedSession?.updatedAt).toBe(initialUpdatedAt);
    expect(unchangedSession?.round).toBe(2);
    expect(unchangedSession?.quizQuestions).toHaveLength(1);

    await t.mutation(internal.study.storeGeneratedQuiz, {
      sessionId,
      sourceSummary: "Bestehende Zusammenfassung",
      sourceTopics: ["Photosynthese", "Zellatmung"],
      quizQuestions: [
        existingQuestion,
        buildQuizQuestion({
          id: "frage-2",
          topic: "Zellatmung",
          prompt: "Erkläre die Atmungskette.",
        }),
      ],
      incrementRound: true,
      currentFocusTopic: "Photosynthese",
    });

    const changedSession = await t.run(async (ctx) =>
      ctx.db.get("studySessions", sessionId),
    );
    expect(changedSession?.updatedAt).toBeGreaterThan(initialUpdatedAt);
    expect(changedSession?.stage).toBe("quiz");
    expect(changedSession?.round).toBe(3);
    expect(changedSession?.sourceTopics).toEqual([
      "Photosynthese",
      "Zellatmung",
    ]);
    expect(changedSession?.quizQuestions).toHaveLength(2);
  });

  it("überspringt identische Quizantworten und speichert eine einzelne Feldänderung", async () => {
    const t = createTestHarness();
    const initialUpdatedAt = Date.now() - 5_000;
    const { sessionId } = await createOwnedSession(t, {
      round: 2,
      updatedAt: initialUpdatedAt,
    });

    const responseId = await t.run(async (ctx) =>
      ctx.db.insert("quizResponses", {
        sessionId,
        round: 2,
        questionId: "frage-1",
        topic: "Photosynthese",
        prompt: "Erkläre die Lichtreaktion.",
        userAnswer: "ATP und NADPH entstehen.",
        isCorrect: true,
        score: 90,
        explanation: "Fast vollständig.",
        idealAnswer: "ATP und NADPH entstehen.",
        misunderstanding: "Kein spezifisches Missverständnis",
        timeSpentSeconds: 20,
        createdAt: initialUpdatedAt - 100,
        updatedAt: initialUpdatedAt,
      }),
    );

    await t.mutation(internal.study.storeQuizResponse, {
      sessionId,
      round: 2,
      questionId: "frage-1",
      topic: "Photosynthese",
      prompt: "Erkläre die Lichtreaktion.",
      userAnswer: "ATP und NADPH entstehen.",
      isCorrect: true,
      score: 90,
      explanation: "Fast vollständig.",
      idealAnswer: "ATP und NADPH entstehen.",
      misunderstanding: "Kein spezifisches Missverständnis",
      timeSpentSeconds: 20,
    });

    const unchangedResponse = await t.run(async (ctx) =>
      ctx.db.get("quizResponses", responseId),
    );
    expect(unchangedResponse?.updatedAt).toBe(initialUpdatedAt);
    expect(unchangedResponse?.score).toBe(90);

    await t.mutation(internal.study.storeQuizResponse, {
      sessionId,
      round: 2,
      questionId: "frage-1",
      topic: "Photosynthese",
      prompt: "Erkläre die Lichtreaktion.",
      userAnswer: "ATP, NADPH und Sauerstoff entstehen.",
      isCorrect: true,
      score: 100,
      explanation: "Jetzt vollständig.",
      idealAnswer: "ATP und NADPH entstehen.",
      misunderstanding: "Kein spezifisches Missverständnis",
      timeSpentSeconds: 20,
    });

    const changedResponse = await t.run(async (ctx) =>
      ctx.db.get("quizResponses", responseId),
    );
    expect(changedResponse?.updatedAt).toBeGreaterThan(initialUpdatedAt);
    expect(changedResponse?.score).toBe(100);
    expect(changedResponse?.userAnswer).toBe(
      "ATP, NADPH und Sauerstoff entstehen.",
    );
  });

  it("überspringt identische Analysen und speichert einen kleinen Analyse-Delta", async () => {
    const t = createTestHarness();
    const initialUpdatedAt = Date.now() - 5_000;
    const analysis = buildAnalysis();
    const { sessionId } = await createOwnedSession(t, {
      stage: "analysis",
      analysis,
      updatedAt: initialUpdatedAt,
    });

    await t.mutation(internal.study.storeSessionAnalysis, {
      sessionId,
      analysis,
    });

    const unchangedSession = await t.run(async (ctx) =>
      ctx.db.get("studySessions", sessionId),
    );
    expect(unchangedSession?.updatedAt).toBe(initialUpdatedAt);
    expect(unchangedSession?.analysis?.recommendedNextStep).toBe(
      analysis.recommendedNextStep,
    );

    const updatedAnalysis = buildAnalysis({
      recommendedNextStep: "Die ATP-Synthase als Nächstes wiederholen.",
    });

    await t.mutation(internal.study.storeSessionAnalysis, {
      sessionId,
      analysis: updatedAnalysis,
    });

    const changedSession = await t.run(async (ctx) =>
      ctx.db.get("studySessions", sessionId),
    );
    expect(changedSession?.updatedAt).toBeGreaterThan(initialUpdatedAt);
    expect(changedSession?.stage).toBe("analysis");
    expect(changedSession?.analysis?.recommendedNextStep).toBe(
      "Die ATP-Synthase als Nächstes wiederholen.",
    );
  });
});
