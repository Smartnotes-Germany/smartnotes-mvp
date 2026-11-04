import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const createOwnedSession = async (t: ReturnType<typeof convexTest>) => {
  const subject = `user_${Math.random().toString(36).slice(2)}`;
  const sessionId = await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: `https://convex.test|${subject}`,
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return ctx.db.insert("studySessions", {
      userId,
      title: "Studientest",
      stage: "quiz",
      round: 1,
      sourceTopics: ["Subnetting", "OSI-Modell"],
      quizQuestions: [],
      createdAt: now,
      updatedAt: now,
    });
  });

  return { sessionId, asUser: t.withIdentity({ subject }) };
};

const content = {
  sections: [
    {
      topic: "Subnetting",
      blocks: [
        {
          heading: "Was ist das?",
          text: "Ein Netz wird in Teilnetze geteilt.",
        },
        { heading: "Wichtig", text: "/24 hat 254 nutzbare Adressen." },
      ],
      visual: {
        kind: "parts" as const,
        title: "Aufbau einer IP-Adresse",
        parts: [
          { label: "Netzanteil", detail: "Bits der Maske" },
          { label: "Hostanteil", detail: "Restliche Bits" },
        ],
      },
      example: { title: "Aufgabe", text: "Teile 192.168.0.0/24 in 4 Netze." },
    },
  ],
};

describe("convex/study topic summary", () => {
  it("zeigt die fertige Zusammenfassung bis zum Überspringen", async () => {
    const t = convexTest(schema, modules);
    const { sessionId, asUser } = await createOwnedSession(t);

    await t.mutation(internal.study.startTopicSummary, {
      sessionId,
      requestId: "anfrage-1",
      focusTopics: ["Subnetting"],
    });
    let snapshot = await asUser.query(api.study.getSessionSnapshot, {
      sessionId,
    });
    expect(snapshot?.session.topicSummary).toMatchObject({
      status: "generating",
      dismissed: false,
      sections: [],
    });

    await t.mutation(internal.study.storeTopicSummary, {
      sessionId,
      requestId: "anfrage-1",
      content,
    });
    snapshot = await asUser.query(api.study.getSessionSnapshot, { sessionId });
    expect(snapshot?.session.topicSummary).toMatchObject({
      status: "ready",
      focusTopics: ["Subnetting"],
      sections: content.sections,
    });

    await asUser.mutation(api.study.dismissTopicSummary, { sessionId });
    snapshot = await asUser.query(api.study.getSessionSnapshot, { sessionId });
    expect(snapshot?.session.topicSummary?.dismissed).toBe(true);
  });

  it("verwirft Ergebnisse einer älteren Themenauswahl", async () => {
    const t = convexTest(schema, modules);
    const { sessionId, asUser } = await createOwnedSession(t);

    await t.mutation(internal.study.startTopicSummary, {
      sessionId,
      requestId: "alt",
      focusTopics: ["OSI-Modell"],
    });
    await t.mutation(internal.study.startTopicSummary, {
      sessionId,
      requestId: "neu",
      focusTopics: ["Subnetting"],
    });
    await t.mutation(internal.study.storeTopicSummary, {
      sessionId,
      requestId: "alt",
      content,
    });

    const snapshot = await asUser.query(api.study.getSessionSnapshot, {
      sessionId,
    });
    expect(snapshot?.session.topicSummary).toMatchObject({
      status: "generating",
      focusTopics: ["Subnetting"],
    });
  });

  it("zeigt den Zwischenstand, solange geschrieben wird", async () => {
    const t = convexTest(schema, modules);
    const { sessionId, asUser } = await createOwnedSession(t);
    const partial = {
      sections: [
        {
          topic: "Subnetting",
          blocks: [{ heading: "Was ist das?", text: "Ein Netz wird" }],
          example: { title: "", text: "" },
        },
      ],
    };

    await t.mutation(internal.study.startTopicSummary, {
      sessionId,
      requestId: "anfrage-1",
      focusTopics: ["Subnetting"],
    });
    await t.mutation(internal.study.updateTopicSummaryProgress, {
      sessionId,
      requestId: "anfrage-1",
      content: partial,
    });
    let snapshot = await asUser.query(api.study.getSessionSnapshot, {
      sessionId,
    });
    expect(snapshot?.session.topicSummary).toMatchObject({
      status: "generating",
      sections: partial.sections,
    });

    // Nach dem fertigen Ergebnis überschreibt ein später Zwischenstand nichts.
    await t.mutation(internal.study.storeTopicSummary, {
      sessionId,
      requestId: "anfrage-1",
      content,
    });
    await t.mutation(internal.study.updateTopicSummaryProgress, {
      sessionId,
      requestId: "anfrage-1",
      content: partial,
    });
    snapshot = await asUser.query(api.study.getSessionSnapshot, { sessionId });
    expect(snapshot?.session.topicSummary).toMatchObject({
      status: "ready",
      sections: content.sections,
    });
  });

  it("zeigt ältere Zusammenfassungen als Erklärblock ohne Skizze", async () => {
    const t = convexTest(schema, modules);
    const { sessionId, asUser } = await createOwnedSession(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.patch("studySessions", sessionId, {
        topicSummary: {
          requestId: "alt",
          status: "ready",
          focusTopics: ["Subnetting"],
          dismissed: false,
          intro: "Alte Einleitung",
          sections: [
            {
              topic: "Subnetting",
              explanation: "Langer alter Text.",
              keyPoints: ["Alter Merksatz"],
              example: { title: "Aufgabe", text: "Rechne." },
              figure: {
                kind: "diagram",
                svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                caption: "Alte Skizze",
              },
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      });
    });

    const snapshot = await asUser.query(api.study.getSessionSnapshot, {
      sessionId,
    });
    expect(snapshot?.session.topicSummary?.sections).toEqual([
      {
        topic: "Subnetting",
        blocks: [{ heading: "Kurz erklärt", text: "Langer alter Text." }],
        example: { title: "Aufgabe", text: "Rechne." },
      },
    ]);
  });

  it("merkt sich, wenn die Erstellung fehlgeschlagen ist", async () => {
    const t = convexTest(schema, modules);
    const { sessionId, asUser } = await createOwnedSession(t);

    await t.mutation(internal.study.startTopicSummary, {
      sessionId,
      requestId: "anfrage-1",
      focusTopics: ["Subnetting"],
    });
    await t.mutation(internal.study.storeTopicSummary, {
      sessionId,
      requestId: "anfrage-1",
      error: "Die Zusammenfassung konnte nicht erstellt werden.",
    });

    const snapshot = await asUser.query(api.study.getSessionSnapshot, {
      sessionId,
    });
    expect(snapshot?.session.topicSummary).toMatchObject({
      status: "failed",
      error: "Die Zusammenfassung konnte nicht erstellt werden.",
    });
  });

  it("lässt nur das eigene Konto die Zusammenfassung überspringen", async () => {
    const t = convexTest(schema, modules);
    const { sessionId } = await createOwnedSession(t);
    const other = await createOwnedSession(t);

    await expect(
      other.asUser.mutation(api.study.dismissTopicSummary, { sessionId }),
    ).rejects.toThrowError("Du darfst auf diese Sitzung nicht zugreifen.");
  });
});
