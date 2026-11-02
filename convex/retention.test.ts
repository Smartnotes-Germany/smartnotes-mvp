import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const createTestHarness = () => convexTest(schema, modules);

const seedDocument = async (
  t: ReturnType<typeof createTestHarness>,
  options?: {
    storageState?: "orphaned";
    updatedAt?: number;
  },
) => {
  const now = Date.now();

  return t.run(async (ctx) => {
    const grantId = await ctx.db.insert("accessGrants", {
      token: `grant-${now}-${Math.random()}`,
      createdAt: now,
    });
    const sessionId = await ctx.db.insert("studySessions", {
      grantId,
      title: "Sitzung",
      stage: "upload",
      round: 1,
      sourceTopics: [],
      quizQuestions: [],
      createdAt: now,
      updatedAt: now,
    });

    return ctx.db.insert("sessionDocuments", {
      sessionId,
      storageId: "nicht-registrierte-datei",
      storageProvider: "convex",
      fileName: "[entfernt]",
      fileType: "application/pdf",
      fileSizeBytes: 1_024,
      extractionStatus: "ready",
      storageState: options?.storageState,
      createdAt: now - 10_000,
      updatedAt: options?.updatedAt ?? now - 5_000,
    });
  });
};

describe("convex/retention Orphan-Cleanup", () => {
  it("behält verwaiste Dokumente, wenn die Datei nicht gelöscht werden kann", async () => {
    const t = createTestHarness();
    const documentId = await seedDocument(t, { storageState: "orphaned" });

    const result = await t.mutation(
      internal.retention.cleanupOrphanedDocuments,
      { batchSize: 10 },
    );

    expect(result).toEqual({
      deletedDocuments: 0,
      failedDocuments: 1,
      done: true,
    });

    const document = await t.run(async (ctx) =>
      ctx.db.get("sessionDocuments", documentId),
    );

    expect(document?.storageState).toBe("orphaned");
    expect(document?.updatedAt).toBeGreaterThan(Date.now() - 1_000);
  });

  it("ignoriert Dokumente, die nicht als verwaist markiert sind", async () => {
    const t = createTestHarness();
    const documentId = await seedDocument(t);

    const result = await t.mutation(
      internal.retention.cleanupOrphanedDocuments,
      { batchSize: 10 },
    );

    expect(result).toEqual({
      deletedDocuments: 0,
      failedDocuments: 0,
      done: true,
    });

    const document = await t.run(async (ctx) =>
      ctx.db.get("sessionDocuments", documentId),
    );

    expect(document).not.toBeNull();
  });
});
