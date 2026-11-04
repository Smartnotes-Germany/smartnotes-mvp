import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const createUser = async (
  t: ReturnType<typeof convexTest>,
  { activated }: { activated: boolean },
) => {
  const subject = `user_${Math.random().toString(36).slice(2)}`;
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("users", {
      tokenIdentifier: `https://convex.test|${subject}`,
      ...(activated ? { activatedAt: now } : {}),
      createdAt: now,
      updatedAt: now,
    });
  });
  return t.withIdentity({ subject });
};

describe("convex/users onboarding", () => {
  it("speichert Unternehmen und Schulproblem einmalig", async () => {
    const t = convexTest(schema, modules);
    const asUser = await createUser(t, { activated: true });

    expect(await asUser.query(api.users.viewer, {})).toMatchObject({
      activated: true,
      onboarded: false,
    });

    await asUser.mutation(api.users.completeOnboarding, {
      companyName: "  Muster GmbH ",
      schoolChallenge: " Subnetting ",
    });

    expect(await asUser.query(api.users.viewer, {})).toMatchObject({
      onboarded: true,
    });
    const stored = await t.run(async (ctx) => ctx.db.query("users").first());
    expect(stored).toMatchObject({
      companyName: "Muster GmbH",
      schoolChallenge: "Subnetting",
    });
  });

  it("lässt die Schulfrage weg, verlangt aber das Unternehmen", async () => {
    const t = convexTest(schema, modules);
    const asUser = await createUser(t, { activated: true });

    await expect(
      asUser.mutation(api.users.completeOnboarding, {
        companyName: " ",
      }),
    ).rejects.toThrowError("Bitte gib dein Unternehmen an.");

    await asUser.mutation(api.users.completeOnboarding, {
      companyName: "Muster GmbH",
      schoolChallenge: "  ",
    });
    const stored = await t.run(async (ctx) => ctx.db.query("users").first());
    expect(stored?.onboardingCompletedAt).toBeDefined();
    expect(stored?.schoolChallenge).toBeUndefined();
  });

  it("nimmt Angaben nur von freigeschalteten Konten an", async () => {
    const t = convexTest(schema, modules);
    const asUser = await createUser(t, { activated: false });

    await expect(
      asUser.mutation(api.users.completeOnboarding, {
        companyName: "Muster GmbH",
      }),
    ).rejects.toThrowError("Dein Konto ist noch nicht freigeschaltet.");
  });
});
