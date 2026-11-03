import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const createTestHarness = () => convexTest(schema, modules);

const tokenHash = (character: string) => character.repeat(64);

const signUp = (
  t: ReturnType<typeof createTestHarness>,
  overrides?: Partial<{
    email: string;
    rateLimitKey: string;
    confirmationTokenHash: string;
  }>,
) =>
  t.mutation(internal.waitlist.signUp, {
    email: "  Lisa@Example.de ",
    consentTextVersion: "2026-11-01",
    rateLimitKey: "ip-a",
    confirmationTokenHash: tokenHash("a"),
    ...overrides,
  });

describe("convex/waitlist", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("speichert neue Anmeldungen normalisiert und unbestätigt", async () => {
    const t = createTestHarness();

    await expect(signUp(t)).resolves.toEqual({
      status: "pending",
      sendConfirmation: true,
    });

    const entries = await t.run((ctx) =>
      ctx.db.query("waitlistEntries").collect(),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      email: "lisa@example.de",
      status: "pending",
      consentTextVersion: "2026-11-01",
      confirmationTokenHash: tokenHash("a"),
    });
  });

  it("stellt für dieselbe Adresse erst nach der Wartezeit einen neuen Link aus", async () => {
    vi.useFakeTimers();
    const t = createTestHarness();

    await signUp(t);
    await expect(
      signUp(t, { confirmationTokenHash: tokenHash("b") }),
    ).resolves.toEqual({ status: "pending", sendConfirmation: false });

    vi.advanceTimersByTime(1000 * 60 * 11);
    await expect(
      signUp(t, {
        rateLimitKey: "ip-b",
        confirmationTokenHash: tokenHash("c"),
      }),
    ).resolves.toEqual({ status: "pending", sendConfirmation: true });

    const entries = await t.run((ctx) =>
      ctx.db.query("waitlistEntries").collect(),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.confirmationTokenHash).toBe(tokenHash("c"));
  });

  it("begrenzt Anmeldungen pro IP", async () => {
    const t = createTestHarness();

    for (let index = 0; index < 5; index += 1) {
      await signUp(t, { email: `person${index}@example.de` });
    }

    await expect(signUp(t, { email: "zuviel@example.de" })).resolves.toEqual({
      status: "rate_limited",
      sendConfirmation: false,
    });
  });

  it("bestätigt einen Eintrag genau einmal", async () => {
    const t = createTestHarness();
    await signUp(t);

    await expect(
      t.mutation(internal.waitlist.confirm, {
        confirmationTokenHash: tokenHash("a"),
      }),
    ).resolves.toEqual({ status: "confirmed" });
    await expect(
      t.mutation(internal.waitlist.confirm, {
        confirmationTokenHash: tokenHash("a"),
      }),
    ).resolves.toEqual({ status: "invalid" });

    await expect(signUp(t, { rateLimitKey: "ip-b" })).resolves.toEqual({
      status: "already_confirmed",
      sendConfirmation: false,
    });
  });

  it("lehnt abgelaufene Bestätigungslinks ab", async () => {
    vi.useFakeTimers();
    const t = createTestHarness();
    await signUp(t);

    vi.advanceTimersByTime(1000 * 60 * 60 * 49);
    await expect(
      t.mutation(internal.waitlist.confirm, {
        confirmationTokenHash: tokenHash("a"),
      }),
    ).resolves.toEqual({ status: "invalid" });
  });

  it("räumt abgelaufene Rate-Limit-Zähler auf", async () => {
    vi.useFakeTimers();
    const t = createTestHarness();
    await signUp(t);

    vi.advanceTimersByTime(1000 * 60 * 11);
    await expect(
      t.mutation(internal.waitlist.cleanupRateLimits, {}),
    ).resolves.toEqual({ deleted: 1 });
  });
});
