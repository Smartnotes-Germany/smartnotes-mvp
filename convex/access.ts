import type { MutationCtx } from "./errorTracking";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./errorTracking";
import { readRequiredEnv } from "./env";
import {
  assertMeaningfulIdentityLabel,
  buildAnalyticsDistinctId,
  hasMeaningfulIdentityLabel,
  normalizeIdentityEmail,
  normalizeIdentityLabel,
} from "../shared/identity";
import {
  getIdentityQuality,
  type PostHogIdentityQuality,
} from "../shared/posthogRuntime";

/** Constants for access management */
const DEMO_ACCESS_CODE = "SMARTNOTES-DEMO-2026";
const ACCESS_GRANT_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const LEGACY_ACCESS_CODE_IDENTITY_LABEL = "Unbekannte Nutzerkennung";
export const redeemSourceValidator = v.union(
  v.literal("manual_code"),
  v.literal("magic_link"),
);

type AccessIdentity = {
  identityLabel: string;
  identityQuality: Exclude<PostHogIdentityQuality, "anonymous">;
  analyticsDistinctId?: string;
  analyticsGrantId?: Id<"accessGrants">;
  identityEmail?: string;
  note?: string;
};

type ResolvedAccessIdentity = AccessIdentity & {
  analyticsDistinctId: string;
  analyticsGrantId: Id<"accessGrants">;
};

type RedeemFailureReason = "unknown_code" | "already_used";

export type RedeemAccessCodeTransactionResult =
  | ({
      ok: true;
      normalizedCode: string;
      grantToken: string;
      expiresAt: number;
    } & ResolvedAccessIdentity)
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

const buildLegacyIdentityFromAccessCodeId = (accessCodeId: Id<"accessCodes">) =>
  `${LEGACY_ACCESS_CODE_IDENTITY_LABEL} (${accessCodeId})`;

const getAccessCodeIdentity = (accessCode: Doc<"accessCodes">) => {
  const normalizedIdentityLabel = accessCode.identityLabel
    ? normalizeIdentityLabel(accessCode.identityLabel)
    : "";
  const identityEmail = accessCode.identityEmail
    ? normalizeIdentityEmail(accessCode.identityEmail)
    : undefined;
  const note = accessCode.note?.trim();

  const fallbackIdentityLabel = accessCode._id
    ? buildLegacyIdentityFromAccessCodeId(accessCode._id)
    : LEGACY_ACCESS_CODE_IDENTITY_LABEL;
  const identityLabel =
    normalizedIdentityLabel &&
    hasMeaningfulIdentityLabel(normalizedIdentityLabel)
      ? normalizedIdentityLabel
      : fallbackIdentityLabel;

  const identityQuality = getIdentityQuality({
    identityEmail,
  });
  const analyticsGrantId = accessCode.consumedByGrantId;
  const analyticsDistinctId = analyticsGrantId
    ? buildAnalyticsDistinctId({
        grantId: analyticsGrantId,
        identityEmail,
      })
    : undefined;

  return {
    identityLabel,
    identityQuality,
    ...(analyticsDistinctId ? { analyticsDistinctId } : {}),
    ...(analyticsGrantId ? { analyticsGrantId } : {}),
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
        identityLabel: "Lokale Demo",
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
      ...getAccessCodeIdentity(accessCode),
    } satisfies RedeemAccessCodeTransactionResult;
  }

  const identity = getAccessCodeIdentity(accessCode);
  const grantToken = generateToken();
  const expiresAt = now + ACCESS_GRANT_TTL_MS;

  const grantId = await ctx.db.insert("accessGrants", {
    token: grantToken,
    createdAt: now,
    identityLabel: identity.identityLabel,
    ...(identity.identityEmail
      ? { identityEmail: identity.identityEmail }
      : {}),
    ...(identity.note ? { note: identity.note } : {}),
  });

  await ctx.db.patch(accessCode._id, {
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
    analyticsDistinctId: buildAnalyticsDistinctId({
      grantId,
      identityEmail: identity.identityEmail,
    }),
    analyticsGrantId: grantId,
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

    const identityEmail = grant.identityEmail
      ? normalizeIdentityEmail(grant.identityEmail)
      : undefined;

    return {
      valid: true,
      identityLabel: grant.identityLabel,
      identityEmail,
      identityQuality: getIdentityQuality({
        identityEmail,
      }),
      analyticsDistinctId: buildAnalyticsDistinctId({
        grantId: grant._id,
        identityEmail,
      }),
      analyticsGrantId: grant._id,
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
