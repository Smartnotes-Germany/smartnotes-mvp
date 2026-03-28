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
});
