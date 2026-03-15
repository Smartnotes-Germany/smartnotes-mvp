import type { MutationCtx } from "./errorTracking";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { mutation, query } from "./errorTracking";
import { readRequiredEnv } from "./env";
import {
  buildIdentityKey,
  buildPostHogDistinctId,
  normalizeIdentityEmail,
  normalizeIdentityLabel,
} from "../shared/identity";
import { captureEvent } from "./posthog";

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

const getAccessCodeIdentity = (
  accessCode: Doc<"accessCodes">,
): {
  identityKey: string;
  identityLabel: string;
  identityEmail?: string;
  note?: string;
} => {
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
    throw new Error(
      "Dieser Zugangscode ist keiner identifizierten Person zugeordnet.",
    );
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
  };
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
    throw new Error("Dieser Zugangscode wurde bereits verwendet.");
  }

  const identity = getAccessCodeIdentity(accessCode);
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
    grantToken,
    expiresAt,
    ...identity,
  };
};

/**
 * Redeems a specific access code to create an access grant.
 */
export const redeemAccessCode = mutation({
  args: {
    code: v.string(),
    source: v.optional(
      v.union(v.literal("manual_code"), v.literal("magic_link")),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedCode = normalizeCode(args.code);
    const source = args.source ?? "manual_code";
    const accessCode = await findAccessCode(ctx, normalizedCode, now);

    if (!accessCode) {
      await captureEvent({
        event: "auth_code_redeem_failed",
        distinctId: "smartnotes-anonymous-auth",
        properties: {
          status: "failed",
          source,
          failureReason: "unknown_code",
          normalizedCode,
          attribution: "anonymous_client_or_server",
        },
      });
      throw new Error("Zugangscode wurde nicht erkannt.");
    }

    try {
      const result = await redeemStoredAccessCode(ctx, accessCode, now);

      await captureEvent({
        event: "auth_code_redeem_succeeded",
        distinctId: buildPostHogDistinctId(result.identityKey),
        properties: {
          status: "succeeded",
          source,
          attribution: "identified_server",
          identityKey: result.identityKey,
        },
        personProperties: {
          identityKey: result.identityKey,
          identityLabel: result.identityLabel,
          ...(result.identityEmail
            ? { identityEmail: result.identityEmail }
            : {}),
          ...(result.note ? { note: result.note } : {}),
        },
      });

      return result;
    } catch (error) {
      if (accessCode.consumedAt) {
        const identity = getAccessCodeIdentity(accessCode);
        await captureEvent({
          event: "auth_code_redeem_failed",
          distinctId: buildPostHogDistinctId(identity.identityKey),
          properties: {
            status: "failed",
            source,
            failureReason: "already_used",
            normalizedCode,
            attribution: "identified_server",
            identityKey: identity.identityKey,
          },
          personProperties: {
            identityKey: identity.identityKey,
            identityLabel: identity.identityLabel,
            ...(identity.identityEmail
              ? { identityEmail: identity.identityEmail }
              : {}),
            ...(identity.note ? { note: identity.note } : {}),
          },
        });
      }

      throw error;
    }
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
