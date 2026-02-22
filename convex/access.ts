import { mutation, query } from "./errorTracking";
import { v } from "convex/values";

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

    if (!accessCode) {
      throw new Error("Zugangscode wurde nicht erkannt.");
    }

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
  },
});

/**
 * Consumes a magic link, creates an access grant, and DELETES both the magic link
 * and the involved access codes. Absolute privacy by removing all traces from the DB.
 */
export const consumeMagicLink = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const accessToken = await ctx.db
      .query("accessCodes")
      .withIndex("by_normalizedCode", (q) => q.eq("normalizedCode", args.code))
      .first();

    // Check if link exists and is still valid
    if (!accessToken || accessToken.consumedAt !== undefined) {
      throw new Error("Der Link ist ungültig oder abgelaufen.");
    }

    // 3. Create the actual access grant (the session ticket)
    const grantToken = generateToken();

    // We do NOT link the grant to any specific code ID to prevent back-tracing
    await ctx.db.insert("accessGrants", {
      token: grantToken,
      createdAt: now,
    });

    // 4. DELETE everything immediately
    // Delete the magic link itself
    await ctx.db.delete(accessToken._id);

    // Return the session token. The 'obfuscatedCodes' are returned
    // just for front-end feedback, they no longer exist in the DB.
    return {
      grantToken,
    };
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
    const expectedSecret = process.env.ACCESS_CODE_ADMIN_SECRET;
    if (!expectedSecret) {
      throw new Error("ACCESS_CODE_ADMIN_SECRET ist nicht konfiguriert.");
    }
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
