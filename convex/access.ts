import type { MutationCtx } from "./errorTracking";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./errorTracking";
import { readRequiredEnv } from "./env";
import {
  buildIdentityKey,
  normalizeIdentityEmail,
  normalizeIdentityLabel,
} from "../shared/identity";

/** Constants for access management */
const DEMO_ACCESS_CODE = "SMARTNOTES-DEMO-2026";
const ACCESS_GRANT_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
export const redeemSourceValidator = v.union(
  v.literal("manual_code"),
  v.literal("magic_link"),
);

type AccessIdentity = {
  identityKey: string;
  identityLabel: string;
  identityEmail?: string;
  note?: string;
};

type RedeemFailureReason = "unknown_code" | "already_used" | "missing_identity";

export type RedeemAccessCodeTransactionResult =
  | ({
      ok: true;
      normalizedCode: string;
      grantToken: string;
      expiresAt: number;
    } & AccessIdentity)
  | ({
      ok: false;
      normalizedCode: string;
      reason: RedeemFailureReason;
    } & Partial<AccessIdentity>);

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
export const normalizeAccessCode = (rawCode: string) =>
  rawCode.trim().replace(/\s+/g, "-").toUpperCase();

const getAccessCodeIdentity = (accessCode: Doc<"accessCodes">) => {
  const identityLabel = accessCode.identityLabel
    ? normalizeIdentityLabel(accessCode.identityLabel)
    : accessCode.note
      ? normalizeIdentityLabel(accessCode.note)
      : "";
  const identityEmail = accessCode.identityEmail
    ? normalizeIdentityEmail(accessCode.identityEmail)
    : undefined;
  const note = accessCode.note?.trim();

  if (!identityLabel) {
    return null;
  }

  const identityKey =
    accessCode.identityKey ||
    buildIdentityKey({
      identityLabel,
      identityEmail,
    });

  return {
    identityKey,
    identityLabel,
    ...(identityEmail ? { identityEmail } : {}),
    ...(note ? { note } : {}),
  } satisfies AccessIdentity;
};

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
    return {
      ok: false,
      reason: "already_used",
      normalizedCode: accessCode.normalizedCode,
      ...(getAccessCodeIdentity(accessCode) ?? {}),
    } satisfies RedeemAccessCodeTransactionResult;
  }

  const identity = getAccessCodeIdentity(accessCode);
  if (!identity) {
    return {
      ok: false,
      reason: "missing_identity",
      normalizedCode: accessCode.normalizedCode,
    } satisfies RedeemAccessCodeTransactionResult;
  }

  const grantToken = generateToken();
  const expiresAt = now + ACCESS_GRANT_TTL_MS;

  const grantId = await ctx.db.insert("accessGrants", {
    token: grantToken,
    createdAt: now,
    ...identity,
  });

  await ctx.db.patch(accessCode._id, {
    identityKey: identity.identityKey,
    identityLabel: identity.identityLabel,
    ...(identity.identityEmail
      ? { identityEmail: identity.identityEmail }
      : {}),
    ...(identity.note ? { note: identity.note } : {}),
    consumedAt: now,
    consumedByGrantId: grantId,
  });

  return {
    ok: true,
    normalizedCode: accessCode.normalizedCode,
    grantToken,
    expiresAt,
    ...identity,
  } satisfies RedeemAccessCodeTransactionResult;
};

/**
 * Executes the DB transaction for redeeming an access code without side effects.
 */
export const redeemAccessCodeTransaction = internalMutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedCode = normalizeAccessCode(args.code);
    const accessCode = await findAccessCode(ctx, normalizedCode, now);

    if (!accessCode) {
      return {
        ok: false,
        reason: "unknown_code",
        normalizedCode,
      } satisfies RedeemAccessCodeTransactionResult;
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
      identityKey: grant.identityKey,
      identityLabel: grant.identityLabel,
      identityEmail: grant.identityEmail,
      note: grant.note,
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
    identityLabel: v.optional(v.string()),
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
    const identityLabel = args.identityLabel
      ? normalizeIdentityLabel(args.identityLabel)
      : undefined;
    const identityEmail = args.identityEmail
      ? normalizeIdentityEmail(args.identityEmail)
      : undefined;
    const identityKey = identityLabel
      ? buildIdentityKey({
          identityLabel,
          identityEmail,
        })
      : undefined;

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
        ...(identityKey ? { identityKey } : {}),
        ...(identityLabel ? { identityLabel } : {}),
        ...(identityEmail ? { identityEmail } : {}),
        ...(args.note ? { note: args.note } : {}),
      });
      inserted += 1;
    }

    return { inserted };
  },
});
