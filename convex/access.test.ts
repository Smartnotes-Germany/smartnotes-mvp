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

const signIn = async (
  t: TestHarness,
  identity: { subject: string; email?: string; name?: string },
) => {
  const asUser = t.withIdentity(identity);
  await asUser.mutation(api.users.store, {});
  return asUser;
};

type SignedInUser = Awaited<ReturnType<typeof signIn>>;

const redeemCode = async (asUser: SignedInUser, code: string) =>
  asUser.mutation(internal.access.redeemAccessCodeTransaction, { code });

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

  it("schaltet ein Konto mit einem Code frei und nutzt die E-Mail als analyticsDistinctId", async () => {
    const t = createTestHarness();
    await insertAccessCode(t, {
      code: "email-code-1",
      identityLabel: "Max Mustermann",
      note: "LK Biologie",
    });
    const asUser = await signIn(t, {
      subject: "user_max",
      email: " Max@Schule.DE ",
      name: "Max Mustermann",
    });

    expect(await asUser.query(api.users.viewer, {})).toMatchObject({
      activated: false,
    });

    const redeemed = await redeemCode(asUser, "email-code-1");

    expect(redeemed).toMatchObject({
      ok: true,
      identityQuality: "email",
      identityEmail: "max@schule.de",
      identityLabel: "Max Mustermann",
      analyticsDistinctId: "smartnotes-user:email:max@schule.de",
      note: "LK Biologie",
    });
    expect(await asUser.query(api.users.viewer, {})).toMatchObject({
      activated: true,
      analyticsDistinctId: "smartnotes-user:email:max@schule.de",
    });
  });

  it("lässt das Konto bei einem unbekannten Code gesperrt", async () => {
    const t = createTestHarness();
    await insertAccessCode(t, { code: "echter-code" });
    const asUser = await signIn(t, { subject: "user_unknown" });

    const redeemed = await redeemCode(asUser, "falscher-code");

    expect(redeemed).toMatchObject({ ok: false, reason: "unknown_code" });
    expect(await asUser.query(api.users.viewer, {})).toMatchObject({
      activated: false,
    });
  });

  it("löst jeden Code nur für ein Konto ein", async () => {
    const t = createTestHarness();
    await insertAccessCode(t, { code: "einmal-code" });
    const first = await signIn(t, { subject: "user_first" });
    const second = await signIn(t, { subject: "user_second" });

    expect(await redeemCode(first, "einmal-code")).toMatchObject({ ok: true });
    expect(await redeemCode(second, "einmal-code")).toMatchObject({
      ok: false,
      reason: "already_used",
    });
  });

  it("verwendet ohne E-Mail eine kontobasierte analyticsDistinctId", async () => {
    const t = createTestHarness();
    await insertAccessCode(t, { code: "ohne-email" });
    const asUser = await signIn(t, { subject: "user_no_email" });

    const redeemed = await redeemCode(asUser, "ohne-email");

    expect(redeemed.identityQuality).toBe("app_only");
    expect(redeemed.analyticsDistinctId).toBe(
      `smartnotes-user:user:${redeemed.analyticsUserId}`,
    );
  });

  it("verbraucht keinen weiteren Code, wenn das Konto schon freigeschaltet ist", async () => {
    const t = createTestHarness();
    await insertAccessCode(t, { code: "erster-code" });
    await insertAccessCode(t, { code: "zweiter-code" });
    const asUser = await signIn(t, { subject: "user_twice" });

    await redeemCode(asUser, "erster-code");
    expect(await redeemCode(asUser, "zweiter-code")).toMatchObject({
      ok: true,
    });

    const secondCode = await t.run(async (ctx) =>
      ctx.db
        .query("accessCodes")
        .withIndex("by_normalizedCode", (q) =>
          q.eq("normalizedCode", normalizeAccessCode("zweiter-code")),
        )
        .unique(),
    );
    expect(secondCode?.consumedAt).toBeUndefined();
  });

  it("prüft Codes vor der Registrierung, ohne sie zu verbrauchen", async () => {
    const t = createTestHarness();
    await insertAccessCode(t, { code: "pruef-code" });

    expect(
      await t.query(api.access.checkAccessCode, { code: " pruef-code " }),
    ).toEqual({ status: "valid" });
    expect(
      await t.query(api.access.checkAccessCode, { code: "falscher-code" }),
    ).toEqual({ status: "unknown_code" });
    expect(await t.query(api.access.checkAccessCode, { code: "  " })).toEqual({
      status: "unknown_code",
    });

    const asUser = await signIn(t, { subject: "user_check" });
    expect(await redeemCode(asUser, "pruef-code")).toMatchObject({ ok: true });
    expect(
      await t.query(api.access.checkAccessCode, { code: "pruef-code" }),
    ).toEqual({ status: "already_used" });
  });

  it("löst ohne Anmeldung keinen Code ein", async () => {
    const t = createTestHarness();
    await insertAccessCode(t, { code: "anonym-code" });

    await expect(
      t.mutation(internal.access.redeemAccessCodeTransaction, {
        code: "anonym-code",
      }),
    ).rejects.toThrowError("Bitte melde dich an.");
  });
});
