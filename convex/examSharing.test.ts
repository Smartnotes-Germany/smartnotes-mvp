import { convexTest } from "convex-test";
import { register } from "@gilhrpenner/convex-files-control/test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";
import { modules } from "./test.setup";

const createTestHarness = () => {
  const t = convexTest(schema, modules);
  register(t, "convexFilesControl");
  return t;
};

const insertUser = (ctx: MutationCtx, subject: string) => {
  const now = Date.now();
  return ctx.db.insert("users", {
    tokenIdentifier: `https://convex.test|${subject}`,
    activatedAt: now,
    createdAt: now,
    updatedAt: now,
  });
};

const createSharedSetup = async () => {
  const t = createTestHarness();
  const sessionId = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await insertUser(ctx, "user_besitzer");
    await insertUser(ctx, "user_empfaenger");
    const id = await ctx.db.insert("studySessions", {
      userId: ownerId,
      title: "Wirtschaftskunde",
      examDate: "2026-11-09",
      stage: "analysis",
      round: 2,
      focusTopics: ["Leasing"],
      sourceTopics: ["Leasing", "Bilanzierung"],
      quizQuestions: [
        {
          id: "frage-1",
          topic: "Leasing",
          prompt: "Was ist Leasing?",
          idealAnswer: "Mieten statt kaufen.",
          explanationHint: "Vergleiche mit Kredit.",
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("sessionDocuments", {
      sessionId: id,
      storageId: "datei-1",
      storageProvider: "convex",
      fileName: "skript.pdf",
      fileType: "application/pdf",
      fileSizeBytes: 1_000,
      extractionStatus: "ready",
      extractedText: "Leasing ist ...",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("quizResponses", {
      sessionId: id,
      round: 2,
      questionId: "frage-1",
      topic: "Leasing",
      prompt: "Was ist Leasing?",
      userAnswer: "Mieten",
      isCorrect: true,
      score: 80,
      explanation: "Gut",
      idealAnswer: "Mieten statt kaufen.",
      timeSpentSeconds: 10,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  });

  return {
    t,
    sessionId,
    owner: t.withIdentity({ subject: "user_besitzer" }),
    recipient: t.withIdentity({ subject: "user_empfaenger" }),
  };
};

describe("convex/study Teilen und Löschen", () => {
  it("legt über den Link eine eigene Kopie ohne Fortschritt an", async () => {
    const { sessionId, owner, recipient } = await createSharedSetup();

    const token = await owner.mutation(api.study.createShareLink, {
      sessionId,
    });
    expect(await owner.mutation(api.study.createShareLink, { sessionId })).toBe(
      token,
    );

    expect(
      await recipient.query(api.study.getSharedExam, { token }),
    ).toMatchObject({
      title: "Wirtschaftskunde",
      examDate: "2026-11-09",
      documentCount: 1,
      topicCount: 2,
      isOwner: false,
    });

    const copyId = await recipient.mutation(api.study.importSharedExam, {
      token,
    });
    expect(
      await recipient.mutation(api.study.importSharedExam, { token }),
    ).toBe(copyId);
    expect(await owner.mutation(api.study.importSharedExam, { token })).toBe(
      sessionId,
    );

    const snapshot = await recipient.query(api.study.getSessionSnapshot, {
      sessionId: copyId,
    });
    expect(snapshot?.session).toMatchObject({
      title: "Wirtschaftskunde",
      stage: "quiz",
      sourceTopics: ["Leasing", "Bilanzierung"],
    });
    expect(snapshot?.session).not.toHaveProperty("focusTopics");
    expect(snapshot?.session).not.toHaveProperty("analysis");
    expect(snapshot?.documents.map((document) => document.fileName)).toEqual([
      "skript.pdf",
    ]);
    expect(snapshot?.answeredQuestionIds).toEqual([]);
    expect(
      await recipient.query(api.study.getSharedExam, { token }),
    ).toMatchObject({ ownSessionId: copyId });
  });

  it("löscht nur im eigenen Konto und lässt Kopien samt Datei bestehen", async () => {
    const { t, sessionId, owner, recipient } = await createSharedSetup();
    const token = await owner.mutation(api.study.createShareLink, {
      sessionId,
    });
    const copyId = await recipient.mutation(api.study.importSharedExam, {
      token,
    });

    await expect(
      recipient.mutation(api.study.deleteSession, { sessionId }),
    ).rejects.toThrowError("Du darfst auf diese Sitzung nicht zugreifen.");

    await owner.mutation(api.study.deleteSession, { sessionId });

    expect(await owner.query(api.study.listSessions, {})).toEqual([]);
    const remaining = await t.run(async (ctx) => ({
      documents: await ctx.db.query("sessionDocuments").collect(),
      responses: await ctx.db.query("quizResponses").collect(),
      shares: await ctx.db.query("examShares").collect(),
    }));
    expect(remaining.documents).toHaveLength(1);
    expect(remaining.documents[0]).toMatchObject({
      sessionId: copyId,
      storageId: "datei-1",
    });
    expect(remaining.documents[0]?.storageState).toBeUndefined();
    expect(remaining.responses).toEqual([]);
    expect(remaining.shares).toEqual([]);
    expect(
      (await recipient.query(api.study.listSessions, {})).map(
        (exam) => exam._id,
      ),
    ).toEqual([copyId]);
    await expect(
      recipient.mutation(api.study.importSharedExam, { token }),
    ).rejects.toThrowError(
      "Dieser Link ist ungültig oder die Prüfung wurde gelöscht.",
    );
  });
});
