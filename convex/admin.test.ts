import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { normalizeAccessCode } from "./access";
import { modules } from "./test.setup";

const createTestHarness = () => convexTest(schema, modules);

describe("convex/admin", () => {
  beforeEach(() => {
    process.env.ACCESS_CODE_ADMIN_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.ACCESS_CODE_ADMIN_SECRET;
  });

  it("löscht per sessionId nur die angegebene Sitzung und widerruft den Grant nicht", async () => {
    const t = createTestHarness();
    const code = "admin-delete-session";

    await t.run(async (ctx) => {
      await ctx.db.insert("accessCodes", {
        code,
        normalizedCode: normalizeAccessCode(code),
        createdAt: Date.now(),
        identityLabel: "Max Mustermann",
      });
    });

    const redeemed = await t.mutation(
      internal.access.redeemAccessCodeTransaction,
      {
        code,
      },
    );

    if (!redeemed.ok) {
      throw new Error(`Redeem fehlgeschlagen: ${redeemed.reason}`);
    }

    const firstSessionId = await t.mutation(api.study.startSession, {
      grantToken: redeemed.grantToken,
      title: "Sitzung 1",
    });
    const secondSessionId = await t.mutation(api.study.startSession, {
      grantToken: redeemed.grantToken,
      title: "Sitzung 2",
    });

    const deletionResult = await t.mutation(api.admin.deleteData, {
      adminSecret: "test-secret",
      sessionId: firstSessionId,
    });

    expect(deletionResult).toMatchObject({
      deletedSessions: 1,
      revokedGrant: false,
    });

    const grantStatus = await t.query(api.access.validateGrant, {
      grantToken: redeemed.grantToken,
    });
    expect(grantStatus).toMatchObject({
      valid: true,
    });

    const latestSessionId = await t.query(api.study.getLatestSessionId, {
      grantToken: redeemed.grantToken,
    });
    expect(latestSessionId).toBe(secondSessionId);

    const deletedSession = await t.run(async (ctx) =>
      ctx.db.get(firstSessionId),
    );
    const remainingSession = await t.run(async (ctx) =>
      ctx.db.get(secondSessionId),
    );

    expect(deletedSession).toBeNull();
    expect(remainingSession?._id).toBe(secondSessionId);
  });

  it("backfillt Legacy-Grants mit Fallback-Label sowie optionaler E-Mail und Notiz aus dem Zugangscode", async () => {
    const t = createTestHarness();
    const code = "grant-backfill-legacy";
    const now = Date.now();

    const { grantId } = await t.run(async (ctx) => {
      await ctx.db.insert("accessCodes", {
        code,
        normalizedCode: normalizeAccessCode(code),
        createdAt: now - 100,
        consumedAt: now,
        identityLabel: "  Jakob Rössner  ",
        identityEmail: " Jakob.Roessner@Outlook.de ",
        note: " Legacy-Hinweis ",
        consumedByGrantId: await ctx.db.insert("accessGrants", {
          token: "legacy-grant-token",
          createdAt: now,
        }),
      });

      const grant = await ctx.db
        .query("accessGrants")
        .withIndex("by_token", (q) => q.eq("token", "legacy-grant-token"))
        .first();

      if (!grant) {
        throw new Error("Grant wurde nicht gefunden.");
      }

      return { grantId: grant._id };
    });

    const result = await t.mutation(api.admin.backfillGrantAnalyticsIdentity, {
      adminSecret: "test-secret",
      dryRun: false,
      paginationOpts: {
        cursor: null,
        numItems: 10,
      },
    });

    expect(result).toMatchObject({
      scanned: 1,
      updated: 1,
      labelsBackfilled: 1,
      emailsBackfilled: 1,
      notesBackfilled: 1,
      skipped: 0,
      isDone: true,
    });
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]).toMatchObject({
      grantId,
      before: {},
      after: {
        identityLabel: "Jakob Rössner",
        identityEmail: "jakob.roessner@outlook.de",
        note: "Legacy-Hinweis",
      },
    });

    const patchedGrant = await t.run(async (ctx) => ctx.db.get(grantId));

    expect(patchedGrant).toMatchObject({
      identityLabel: "Jakob Rössner",
      identityEmail: "jakob.roessner@outlook.de",
      note: "Legacy-Hinweis",
    });
  });

  it("verwendet im Dry-Run ein deterministisches Fallback-Label ohne den Grant zu ändern", async () => {
    const t = createTestHarness();
    const now = Date.now();

    const grantId = await t.run(async (ctx) =>
      ctx.db.insert("accessGrants", {
        token: "legacy-dry-run-token",
        createdAt: now,
      }),
    );

    const result = await t.mutation(api.admin.backfillGrantAnalyticsIdentity, {
      adminSecret: "test-secret",
      dryRun: true,
      paginationOpts: {
        cursor: null,
        numItems: 10,
      },
    });

    expect(result).toMatchObject({
      scanned: 1,
      updated: 1,
      labelsBackfilled: 1,
      emailsBackfilled: 0,
      notesBackfilled: 0,
      skipped: 0,
      isDone: true,
    });
    expect(result.samples[0]).toMatchObject({
      grantId,
      after: {
        identityLabel: `Unbekannte Nutzerkennung (${grantId})`,
      },
    });

    const unchangedGrant = await t.run(async (ctx) => ctx.db.get(grantId));

    expect(unchangedGrant?.token).toBe("legacy-dry-run-token");
    expect(unchangedGrant).not.toHaveProperty("identityLabel");
    expect(unchangedGrant).not.toHaveProperty("identityEmail");
    expect(unchangedGrant).not.toHaveProperty("note");
  });
});
