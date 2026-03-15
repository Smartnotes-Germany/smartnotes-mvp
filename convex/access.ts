import type { MutationCtx } from "./errorTracking";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { mutation, query } from "./errorTracking";
import { readRequiredEnv } from "./env";

/** Constants for access management */
const DEMO_ACCESS_CODE = "SMARTNOTES-DEMO-2026";
const ACCESS_GRANT_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

/**
 * Helper to generate a random token/UUID-like string.
 */
const generateToken = () => {
  const maybeCrypto = globalThis as {
    crypto?: {
      randomUUID?: () => string;
    };
  };

  const randomUuid = maybeCrypto.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  return (
    Math.random().toString(36).substring(2) +
    Math.random().toString(36).substring(2)
  );
};

/** Normalizes user-entered codes for consistent lookups */
const normalizeCode = (rawCode: string) =>
  rawCode.trim().replace(/\s+/g, "-").toUpperCase();

const findAccessCode = async (
  ctx: MutationCtx,
  normalizedCode: string,
  now: number,
) => {
  let accessCode = await ctx.db
    .query("accessCodes")
    .withIndex("by_normalizedCode", (q) =>
      q.eq("normalizedCode", normalizedCode),
    )
    .first();

  if (!accessCode) {
    const existingCode = await ctx.db.query("accessCodes").first();
    if (!existingCode && normalizedCode === DEMO_ACCESS_CODE) {
      const seededId = await ctx.db.insert("accessCodes", {
        code: DEMO_ACCESS_CODE,
        normalizedCode: DEMO_ACCESS_CODE,
        createdAt: now,
        note: "Auto-seeded demo code for local development",
      });
      accessCode = await ctx.db.get(seededId);
    }
  }

  return accessCode;
};

const redeemStoredAccessCode = async (
  ctx: MutationCtx,
  accessCode: Doc<"accessCodes">,
  now: number,
) => {
  if (accessCode.consumedAt) {
    throw new Error("Dieser Zugangscode wurde bereits verwendet.");
  }

  const grantToken = generateToken();
  const expiresAt = now + ACCESS_GRANT_TTL_MS;

  const grantId = await ctx.db.insert("accessGrants", {
    token: grantToken,
    createdAt: now,
  });

  await ctx.db.patch(accessCode._id, {
    consumedAt: now,
    consumedByGrantId: grantId,
  });

  return {
    grantToken,
    expiresAt,
  };
};

/**
 * Redeems a specific access code to create an access grant.
 */
export const redeemAccessCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedCode = normalizeCode(args.code);
    const accessCode = await findAccessCode(ctx, normalizedCode, now);

    if (!accessCode) {
      throw new Error("Zugangscode wurde nicht erkannt.");
    }

    return redeemStoredAccessCode(ctx, accessCode, now);
  },
});

/**
 * Consumes a magic link using the same redeem flow as manual code entry so
 * access-code metadata remains available for admin workflows.
 */
export const consumeMagicLink = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedCode = normalizeCode(args.code);
    const accessCode = await findAccessCode(ctx, normalizedCode, now);

    if (!accessCode) {
      throw new Error("Der Link ist ungültig oder abgelaufen.");
    }

    return redeemStoredAccessCode(ctx, accessCode, now);
  },
});

/**
 * Validates a grant token.
 */
export const validateGrant = query({
  args: {
    grantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const grant = await ctx.db
      .query("accessGrants")
      .withIndex("by_token", (q) => q.eq("token", args.grantToken))
      .first();

    if (!grant) {
      return { valid: false, reason: "not_found" as const };
    }

    if (grant.revokedAt) {
      return { valid: false, reason: "revoked" as const };
    }

    return {
      valid: true,
    };
  },
});

/**
 * Bulk creation of access codes by an admin.
 */
export const createAccessCodes = mutation({
  args: {
    adminSecret: v.string(),
    codes: v.array(v.string()),
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

    for (const code of args.codes) {
      const normalizedCode = normalizeCode(code);
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
        ...(args.note ? { note: args.note } : {}),
      });
      inserted += 1;
    }

    return { inserted };
  },
});
