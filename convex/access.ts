import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Constants for access management */
const DEMO_ACCESS_CODE = "SMARTNOTES-DEMO-2026";
const ACCESS_GRANT_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const MAGIC_LINK_TTL_MS = 1000 * 60 * 15; // 15 minutes

/**
 * Helper to generate a random token/UUID-like string.
 */
const generateToken = () => {
  try {
    // @ts-ignore
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch (e) {}
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
 * Generates a new one-time magic link.
 */
export const generateMagicLink = mutation({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.ACCESS_CODE_ADMIN_SECRET;
    if (!expectedSecret) {
      throw new Error("ACCESS_CODE_ADMIN_SECRET ist nicht konfiguriert.");
    }
    if (args.adminSecret !== expectedSecret) {
      throw new Error("Ungültiges Admin-Secret.");
    }

    const token = generateToken();
    const now = Date.now();

    await ctx.db.insert("magicLinks", {
      token,
      createdAt: now,
      expiresAt: now + MAGIC_LINK_TTL_MS,
    });

    return { token };
  },
});

/**
 * Consumes a magic link, creates an access grant, and DELETES both the magic link
 * and the involved access codes. Absolute privacy by removing all traces from the DB.
 */
export const consumeMagicLink = mutation({
  args: {
    magicToken: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const magicLink = await ctx.db
      .query("magicLinks")
      .withIndex("by_token", (q) => q.eq("token", args.magicToken))
      .first();

    // Check if link exists and is still valid
    if (
      !magicLink ||
      magicLink.consumedAt !== undefined ||
      magicLink.expiresAt < now
    ) {
      throw new Error("Der Link ist ungültig oder abgelaufen.");
    }

    // 1. Get all unused access codes
    const unusedCodes = await ctx.db.query("accessCodes").collect();

    const availableCodes = unusedCodes.filter((c) => !c.consumedAt);

    if (availableCodes.length === 0) {
      throw new Error("Keine freien Zugangscodes mehr verfügbar.");
    }

    // 2. Pick up to 3 codes for "burning"
    const shuffled = availableCodes.sort(() => 0.5 - Math.random());
    const selectedBatch = shuffled.slice(0, 3);
    const codesToReturn = selectedBatch.map((c) => c.code);

    // 3. Create the actual access grant (the session ticket)
    const grantToken = generateToken();
    const expiresAt = now + ACCESS_GRANT_TTL_MS;

    // We do NOT link the grant to any specific code ID to prevent back-tracing
    await ctx.db.insert("accessGrants", {
      token: grantToken,
      createdAt: now,
    });

    // 4. DELETE everything immediately
    // Delete the magic link itself
    await ctx.db.delete(magicLink._id);

    // Delete the selected/burned access codes
    for (const codeRecord of selectedBatch) {
      await ctx.db.delete(codeRecord._id);
    }

    // Return the session token. The 'obfuscatedCodes' are returned
    // just for front-end feedback, they no longer exist in the DB.
    return {
      grantToken,
      expiresAt,
      obfuscatedCodes: codesToReturn.sort(() => 0.5 - Math.random()),
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
      throw new Error("Ungueltiges Admin-Secret.");
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
