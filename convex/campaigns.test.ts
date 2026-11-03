import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const ADMIN_SECRET = "test-admin-secret";

const createTestHarness = () => convexTest(schema, modules);

const tokenHash = (character: string) => character.repeat(64);

const readStats = (t: ReturnType<typeof createTestHarness>) =>
  t.run((ctx) => ctx.db.query("campaignDailyStats").collect());

describe("convex/campaigns", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ordnet Anmeldung und Bestätigung der Quelle zu", async () => {
    const t = createTestHarness();

    await t.mutation(internal.waitlist.signUp, {
      email: "azubi@example.de",
      consentTextVersion: "2026-11-03",
      rateLimitKey: "ip-a",
      confirmationTokenHash: tokenHash("a"),
      profession: "kits",
      source: " LinkedIn ",
      campaign: "launch-2026-11",
    });
    await t.mutation(internal.waitlist.confirm, {
      confirmationTokenHash: tokenHash("a"),
    });

    const entries = await t.run((ctx) =>
      ctx.db.query("waitlistEntries").collect(),
    );
    expect(entries[0]).toMatchObject({
      profession: "kits",
      source: "linkedin",
      campaign: "launch-2026-11",
    });
    expect(await readStats(t)).toMatchObject([
      {
        source: "linkedin",
        campaign: "launch-2026-11",
        visits: 0,
        signups: 1,
        confirmations: 1,
        companyInquiries: 0,
      },
    ]);
  });

  it("zählt Anmeldungen ohne gültige Quelle als direkt", async () => {
    const t = createTestHarness();

    await t.mutation(internal.waitlist.signUp, {
      email: "azubi@example.de",
      consentTextVersion: "2026-11-03",
      rateLimitKey: "ip-a",
      confirmationTokenHash: tokenHash("a"),
      source: "<script>",
    });

    expect(await readStats(t)).toMatchObject([
      { source: "direkt", campaign: "", signups: 1 },
    ]);
  });

  it("zählt Besuche nur mit Quelle und begrenzt sie pro IP", async () => {
    const t = createTestHarness();

    await expect(
      t.mutation(internal.campaigns.recordVisit, {
        source: "",
        rateLimitKey: "ip-a",
      }),
    ).resolves.toEqual({ status: "ignored" });

    for (let index = 0; index < 30; index += 1) {
      await t.mutation(internal.campaigns.recordVisit, {
        source: "linkedin",
        rateLimitKey: "ip-a",
      });
    }
    await expect(
      t.mutation(internal.campaigns.recordVisit, {
        source: "linkedin",
        rateLimitKey: "ip-a",
      }),
    ).resolves.toEqual({ status: "rate_limited" });

    expect(await readStats(t)).toMatchObject([
      { source: "linkedin", visits: 30 },
    ]);
  });

  it("speichert Betriebsanfragen einmal pro Adresse", async () => {
    const t = createTestHarness();
    const inquiry = {
      companyName: "  Muster   IT GmbH ",
      email: "Ausbildung@Muster-IT.de",
      apprenticeCount: "6-20" as const,
      professions: "  FI AE,   ITSE ",
      consentTextVersion: "2026-11-03",
      rateLimitKey: "ip-a",
      source: "linkedin",
    };

    await expect(
      t.mutation(internal.companyInquiries.submit, inquiry),
    ).resolves.toEqual({ status: "received" });
    await t.mutation(internal.companyInquiries.submit, {
      ...inquiry,
      apprenticeCount: "21-50",
    });

    const inquiries = await t.run((ctx) =>
      ctx.db.query("companyInquiries").collect(),
    );
    expect(inquiries).toHaveLength(1);
    expect(inquiries[0]).toMatchObject({
      companyName: "Muster IT GmbH",
      email: "ausbildung@muster-it.de",
      apprenticeCount: "21-50",
      professions: "FI AE, ITSE",
      source: "linkedin",
    });
    expect(await readStats(t)).toMatchObject([
      { source: "linkedin", companyInquiries: 1 },
    ]);
  });

  it("zeigt die Auswertung nur mit Admin-Secret", async () => {
    vi.stubEnv("ACCESS_CODE_ADMIN_SECRET", ADMIN_SECRET);
    const t = createTestHarness();

    await t.mutation(internal.waitlist.signUp, {
      email: "azubi@example.de",
      consentTextVersion: "2026-11-03",
      rateLimitKey: "ip-a",
      confirmationTokenHash: tokenHash("a"),
      profession: "fi_si",
      source: "linkedin",
    });
    await t.mutation(internal.campaigns.recordVisit, {
      source: "linkedin",
      rateLimitKey: "ip-a",
    });

    await expect(
      t.query(api.campaigns.overview, { adminSecret: "falsch" }),
    ).rejects.toThrow();

    const overview = await t.query(api.campaigns.overview, {
      adminSecret: ADMIN_SECRET,
    });
    expect(overview.bySource).toMatchObject([
      { source: "linkedin", campaign: "", visits: 1, signups: 1 },
    ]);
    expect(overview.professions).toEqual([{ profession: "fi_si", count: 1 }]);
  });
});
