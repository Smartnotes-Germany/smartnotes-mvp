import type { MutationCtx, QueryCtx } from "./errorTracking";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./errorTracking";
import { readRequiredEnv } from "./env";
import {
  assertMeaningfulIdentityLabel,
  normalizeIdentityEmail,
} from "../shared/identity";
import { buildUserAnalyticsIdentity, getCurrentUser } from "./users";

/** Constants for access management */
const DEMO_ACCESS_CODE = "SMARTNOTES-DEMO-2026";
export const redeemSourceValidator = v.union(
  v.literal("manual_code"),
  v.literal("magic_link"),
);

type RedeemIdentity = ReturnType<typeof buildUserAnalyticsIdentity> & {
  note?: string;
};

type RedeemFailureReason = "unknown_code" | "already_used";

export type RedeemAccessCodeTransactionResult =
  | ({
      ok: true;
      normalizedCode: string;
    } & RedeemIdentity)
  | ({
      ok: false;
      normalizedCode: string;
      reason: RedeemFailureReason;
    } & RedeemIdentity);

/** Normalizes user-entered codes for consistent lookups */
export const normalizeAccessCode = (rawCode: string) =>
  rawCode.trim().replace(/\s+/g, "-").toUpperCase();

const lookupAccessCode = (ctx: QueryCtx, normalizedCode: string) =>
  ctx.db
    .query("accessCodes")
    .withIndex("by_normalizedCode", (q) =>
      q.eq("normalizedCode", normalizedCode),
    )
    .first();

const findAccessCode = async (
  ctx: MutationCtx,
  normalizedCode: string,
  now: number,
) => {
  let accessCode = await lookupAccessCode(ctx, normalizedCode);

  if (!accessCode) {
    const existingCode = await ctx.db.query("accessCodes").first();
    if (!existingCode && normalizedCode === DEMO_ACCESS_CODE) {
      const seededId = await ctx.db.insert("accessCodes", {
        code: DEMO_ACCESS_CODE,
        normalizedCode: DEMO_ACCESS_CODE,
        createdAt: now,
        identityLabel: "Lokale Demo",
        note: "Auto-seeded demo code for local development",
      });
      accessCode = await ctx.db.get("accessCodes", seededId);
    }
  }

  return accessCode;
};

/**
 * Prüft einen Zugangscode vor der Registrierung, ohne ihn zu verbrauchen.
 * Eingelöst wird er erst nach dem Anlegen des Kontos.
 */
export const checkAccessCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedCode = normalizeAccessCode(args.code);
    if (!normalizedCode) {
      return { status: "unknown_code" as const };
    }

    const accessCode = await lookupAccessCode(ctx, normalizedCode);
    if (!accessCode) {
      // Der Demo-Code entsteht erst beim Einlösen, solange es keine Codes gibt.
      const isSeedableDemoCode =
        normalizedCode === DEMO_ACCESS_CODE &&
        !(await ctx.db.query("accessCodes").first());
      return {
        status: isSeedableDemoCode
          ? ("valid" as const)
          : ("unknown_code" as const),
      };
    }

    return {
      status: accessCode.consumedAt
        ? ("already_used" as const)
        : ("valid" as const),
    };
  },
});

/**
 * Schaltet das angemeldete Konto mit einem Zugangscode frei. Jeder Code
 * funktioniert genau einmal; ein bereits freigeschaltetes Konto braucht keinen.
 */
export const redeemAccessCodeTransaction = internalMutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("Bitte melde dich an.");
    }

    const now = Date.now();
    const normalizedCode = normalizeAccessCode(args.code);
    const identity = buildUserAnalyticsIdentity(user);

    if (user.activatedAt) {
      return {
        ok: true,
        normalizedCode,
        ...identity,
      } satisfies RedeemAccessCodeTransactionResult;
    }

    const accessCode = await findAccessCode(ctx, normalizedCode, now);
    if (!accessCode) {
      return {
        ok: false,
        reason: "unknown_code",
        normalizedCode,
        ...identity,
      } satisfies RedeemAccessCodeTransactionResult;
    }

    if (accessCode.consumedAt) {
      return {
        ok: false,
        reason: "already_used",
        normalizedCode: accessCode.normalizedCode,
        ...identity,
      } satisfies RedeemAccessCodeTransactionResult;
    }

    await ctx.db.patch("accessCodes", accessCode._id, {
      consumedAt: now,
      consumedByUserId: user._id,
    });
    await ctx.db.patch("users", user._id, {
      accessCodeId: accessCode._id,
      activatedAt: now,
      updatedAt: now,
    });

    const note = accessCode.note?.trim();
    return {
      ok: true,
      normalizedCode: accessCode.normalizedCode,
      ...identity,
      ...(note ? { note } : {}),
    } satisfies RedeemAccessCodeTransactionResult;
  },
});

/**
 * Bulk creation of access codes by an admin.
 */
export const createAccessCodes = mutation({
  args: {
    adminSecret: v.string(),
    codes: v.array(v.string()),
    identityLabel: v.string(),
    identityEmail: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expectedSecret = readRequiredEnv(
      "ACCESS_CODE_ADMIN_SECRET",
      "ACCESS_CODE_ADMIN_SECRET ist nicht konfiguriert.",
    );
    if (args.adminSecret !== expectedSecret) {
      throw new Error("Ungültiges Admin-Secret.");
    }

    const now = Date.now();
    let inserted = 0;
    const identityLabel = assertMeaningfulIdentityLabel(args.identityLabel);
    const identityEmail = args.identityEmail
      ? normalizeIdentityEmail(args.identityEmail)
      : undefined;
    const note = args.note?.trim();

    for (const code of args.codes) {
      const normalizedCode = normalizeAccessCode(code);
      if (!normalizedCode) {
        continue;
      }

      const existing = await ctx.db
        .query("accessCodes")
        .withIndex("by_normalizedCode", (q) =>
          q.eq("normalizedCode", normalizedCode),
        )
        .first();

      if (existing) {
        continue;
      }

      await ctx.db.insert("accessCodes", {
        code,
        normalizedCode,
        createdAt: now,
        identityLabel,
        ...(identityEmail ? { identityEmail } : {}),
        ...(note ? { note } : {}),
      });
      inserted += 1;
    }

    return { inserted };
  },
});
