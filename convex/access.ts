import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEMO_ACCESS_CODE = "SMARTNOTES-DEMO-2026";
const ACCESS_GRANT_TTL_MS = 1000 * 60 * 60 * 12;

const normalizeCode = (rawCode: string) => rawCode.trim().replace(/\s+/g, "-").toUpperCase();

export const redeemAccessCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedCode = normalizeCode(args.code);

    let accessCode = await ctx.db
      .query("accessCodes")
      .withIndex("by_normalizedCode", (q) => q.eq("normalizedCode", normalizedCode))
      .first();

    if (!accessCode) {
      const existingCode = await ctx.db.query("accessCodes").first();

      // Bootstrap a single demo code so local dev is usable before an admin seeds code.
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

    const grantToken = crypto.randomUUID();
    const expiresAt = now + ACCESS_GRANT_TTL_MS;

    const grantId = await ctx.db.insert("accessGrants", {
      token: grantToken,
      accessCodeId: accessCode._id,
      createdAt: now,
      expiresAt,
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

    if (grant.expiresAt <= Date.now()) {
      return { valid: false, reason: "expired" as const };
    }

    return {
      valid: true,
      expiresAt: grant.expiresAt,
    };
  },
});

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
        .withIndex("by_normalizedCode", (q) => q.eq("normalizedCode", normalizedCode))
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
