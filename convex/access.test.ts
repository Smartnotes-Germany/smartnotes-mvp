import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { normalizeAccessCode } from "./access";
import { modules } from "./test.setup";

const createTestHarness = () => convexTest(schema, modules);

type TestHarness = ReturnType<typeof createTestHarness>;

const insertAccessCode = async (
  t: TestHarness,
  args: {
    code: string;
    identityLabel?: string;
    identityEmail?: string;
    note?: string;
  },
) => {
  await t.run(async (ctx) => {
    await ctx.db.insert("accessCodes", {
      code: args.code,
      normalizedCode: normalizeAccessCode(args.code),
      createdAt: Date.now(),
      ...(args.identityLabel ? { identityLabel: args.identityLabel } : {}),
      ...(args.identityEmail ? { identityEmail: args.identityEmail } : {}),
      ...(args.note ? { note: args.note } : {}),
    });
  });
};

const redeemCode = async (t: TestHarness, code: string) => {
  const result = await t.mutation(internal.access.redeemAccessCodeTransaction, {
    code,
  });

  if (!result.ok) {
    throw new Error(`Redeem fehlgeschlagen: ${result.reason}`);
  }

  return result;
};

describe("convex/access", () => {
  beforeEach(() => {
    process.env.ACCESS_CODE_ADMIN_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.ACCESS_CODE_ADMIN_SECRET;
  });

  it("lehnt Magic Links ohne Buchstaben oder Zahlen im Label ab", async () => {
    const t = createTestHarness();

    await expect(
      t.mutation(api.admin.generateMagicLink, {
        adminSecret: "test-secret",
        identityLabel: "!!!",
      }),
    ).rejects.toThrowError(
      "Bitte gib eine Nutzerkennung mit mindestens einem Buchstaben oder einer Zahl an.",
    );
  });

  it("liefert mit E-Mail eine stabile analyticsDistinctId und gibt sie über validateGrant wieder aus", async () => {
    const t = createTestHarness();

    await insertAccessCode(t, {
      code: "email-code-1",
      identityLabel: "Max Mustermann",
      identityEmail: " Max@Schule.DE ",
      note: "LK Biologie",
    });

    const redeemed = await redeemCode(t, "email-code-1");
    expect(redeemed.identityQuality).toBe("email");
    expect(redeemed.analyticsDistinctId).toBe(
      "smartnotes-user:email:max@schule.de",
    );

    const grantStatus = await t.query(api.access.validateGrant, {
      grantToken: redeemed.grantToken,
    });

    expect(grantStatus).toMatchObject({
      valid: true,
      identityLabel: "Max Mustermann",
      identityEmail: "max@schule.de",
      identityQuality: "email",
      analyticsGrantId: redeemed.analyticsGrantId,
      analyticsDistinctId: redeemed.analyticsDistinctId,
      note: "LK Biologie",
    });
  });

  it("führt verschiedene Schreibweisen derselben E-Mail auf dieselbe analyticsDistinctId", async () => {
    const t = createTestHarness();

    await insertAccessCode(t, {
      code: "email-code-2a",
      identityLabel: "Max Mustermann",
      identityEmail: "Max@Schule.DE",
    });
    await insertAccessCode(t, {
      code: "email-code-2b",
      identityLabel: "Max M.",
      identityEmail: "max@schule.de",
    });

    const first = await redeemCode(t, "email-code-2a");
    const second = await redeemCode(t, "email-code-2b");

    expect(first.analyticsDistinctId).toBe(second.analyticsDistinctId);
    expect(first.analyticsDistinctId).toBe(
      "smartnotes-user:email:max@schule.de",
    );
  });

  it("verwendet ohne E-Mail eine grantbasierte analyticsDistinctId", async () => {
    const t = createTestHarness();

    await insertAccessCode(t, {
      code: "grant-code-1",
      identityLabel: "Max Mustermann",
    });

    const redeemed = await redeemCode(t, "grant-code-1");

    expect(redeemed.identityQuality).toBe("app_only");
    expect(redeemed.analyticsDistinctId).toBe(
      `smartnotes-user:grant:${redeemed.analyticsGrantId}`,
    );
  });

  it("löst alte Zugangscodes ohne Nutzerkennung mit einem Fallback-Label ein", async () => {
    const t = createTestHarness();

    await insertAccessCode(t, {
      code: "legacy-code-1",
      note: "Altbestand ohne Label",
    });

    const redeemed = await redeemCode(t, "legacy-code-1");

    expect(redeemed.note).toBe("Altbestand ohne Label");
    expect(redeemed.identityQuality).toBe("app_only");
    expect(redeemed.identityLabel).toMatch(/^Unbekannte Nutzerkennung \(.+\)$/);
    expect(redeemed.identityLabel).not.toBe(redeemed.note);

    const grantStatus = await t.query(api.access.validateGrant, {
      grantToken: redeemed.grantToken,
    });

    expect(grantStatus).toMatchObject({
      valid: true,
      note: "Altbestand ohne Label",
      identityQuality: "app_only",
    });
    expect(grantStatus.identityLabel).toBe(redeemed.identityLabel);
  });

  it("erzeugt ohne E-Mail pro Grant unterschiedliche analyticsDistinctIds, auch bei gleichem oder ähnlichem Label", async () => {
    const t = createTestHarness();

    await insertAccessCode(t, {
      code: "grant-code-2a",
      identityLabel: "Max Mustermann",
    });
    await insertAccessCode(t, {
      code: "grant-code-2b",
      identityLabel: "Max Mustermann",
    });
    await insertAccessCode(t, {
      code: "grant-code-2c",
      identityLabel: "Max M.",
    });

    const first = await redeemCode(t, "grant-code-2a");
    const second = await redeemCode(t, "grant-code-2b");
    const third = await redeemCode(t, "grant-code-2c");

    expect(first.analyticsDistinctId).not.toBe(second.analyticsDistinctId);
    expect(first.analyticsDistinctId).not.toBe(third.analyticsDistinctId);
    expect(second.analyticsDistinctId).not.toBe(third.analyticsDistinctId);
  });
});
