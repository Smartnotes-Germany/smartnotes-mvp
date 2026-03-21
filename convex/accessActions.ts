"use node";

import { v } from "convex/values";
import type { ActionCtx } from "./errorTracking";
import { action } from "./errorTracking";
import { internal } from "./_generated/api";
import type { RedeemAccessCodeTransactionResult } from "./access";
import { normalizeAccessCode, redeemSourceValidator } from "./access";
import type { PostHogIdentityQuality } from "../shared/posthogRuntime";
import {
  buildPostHogEvent,
  queueAndDeliverPostHogEvents,
} from "./analyticsPosthog";

const ANONYMOUS_DISTINCT_ID = "smartnotes-anonymous-auth";

type RedeemSource = "manual_code" | "magic_link";
type UnexpectedRedeemFailure = {
  ok: false;
  reason: "unexpected_error";
  normalizedCode: string;
  analyticsDistinctId?: string;
  analyticsGrantId?: string;
  identityLabel?: string;
  identityQuality?: Exclude<PostHogIdentityQuality, "anonymous">;
  identityEmail?: string;
  note?: string;
};

type RedeemActionResult = {
  grantToken: string;
  expiresAt: number;
  analyticsDistinctId: string;
  analyticsGrantId: string;
  identityLabel: string;
  identityQuality: Exclude<PostHogIdentityQuality, "anonymous">;
  identityEmail?: string;
  note?: string;
};

const buildIdentityProperties = (result: {
  analyticsGrantId?: string;
  identityLabel?: string;
  identityQuality?: Exclude<PostHogIdentityQuality, "anonymous">;
  identityEmail?: string;
  note?: string;
}) => ({
  ...(result.analyticsGrantId
    ? { analyticsGrantId: result.analyticsGrantId }
    : {}),
  ...(result.identityLabel ? { identityLabel: result.identityLabel } : {}),
  ...(result.identityQuality
    ? { identity_quality: result.identityQuality }
    : {}),
  ...(result.identityEmail ? { identityEmail: result.identityEmail } : {}),
  ...(result.note ? { note: result.note } : {}),
});

const buildFailureMessage = (
  source: RedeemSource,
  reason: "unknown_code" | "already_used" | "missing_identity",
) => {
  if (source === "magic_link" && reason === "unknown_code") {
    return "Der Link ist ungültig oder abgelaufen.";
  }

  if (reason === "unknown_code") {
    return "Zugangscode wurde nicht erkannt.";
  }

  if (reason === "already_used") {
    return "Dieser Zugangscode wurde bereits verwendet.";
  }

  return "Dieser Zugangscode ist keiner identifizierten Person zugeordnet.";
};

const buildAccessEvent = (
  result: RedeemAccessCodeTransactionResult | UnexpectedRedeemFailure,
  source: RedeemSource,
) => {
  if (result.ok) {
    return buildPostHogEvent({
      scope: "access_redemption",
      event: "auth_code_redeem_succeeded",
      distinctId: result.analyticsDistinctId,
      properties: {
        status: "succeeded",
        source,
        attribution: "identified_server",
        identity_quality: result.identityQuality,
        analyticsGrantId: result.analyticsGrantId,
        normalizedCode: result.normalizedCode,
      },
      personProperties: buildIdentityProperties(result),
    });
  }

  const failureIdentity = buildIdentityProperties(result);
  const hasIdentity = Boolean(result.analyticsDistinctId);

  return buildPostHogEvent({
    scope: "access_redemption",
    event: "auth_code_redeem_failed",
    distinctId: result.analyticsDistinctId ?? ANONYMOUS_DISTINCT_ID,
    properties: {
      status: "failed",
      source,
      failureReason: result.reason,
      normalizedCode: result.normalizedCode,
      attribution: hasIdentity
        ? "identified_server"
        : "anonymous_client_or_server",
      ...(result.identityQuality
        ? { identity_quality: result.identityQuality }
        : {}),
      ...(result.analyticsGrantId
        ? { analyticsGrantId: result.analyticsGrantId }
        : {}),
    },
    personProperties: hasIdentity ? failureIdentity : undefined,
  });
};

const KNOWN_REDEEM_ERRORS = new Set([
  "Zugangscode wurde nicht erkannt.",
  "Dieser Zugangscode wurde bereits verwendet.",
  "Dieser Zugangscode ist keiner identifizierten Person zugeordnet.",
  "Der Link ist ungültig oder abgelaufen.",
]);

const performRedeem = async (
  ctx: ActionCtx,
  code: string,
  source: RedeemSource,
): Promise<RedeemActionResult> => {
  const normalizedCode = normalizeAccessCode(code);

  try {
    const result = await ctx.runMutation(
      internal.access.redeemAccessCodeTransaction,
      {
        code,
      },
    );

    try {
      await queueAndDeliverPostHogEvents(ctx, [
        buildAccessEvent(result, source),
      ]);
    } catch (posthogError) {
      console.warn(
        "[PostHog] Fehler beim Senden des Redeem-Events.",
        posthogError,
      );
    }

    if (!result.ok) {
      throw new Error(buildFailureMessage(source, result.reason));
    }

    return {
      grantToken: result.grantToken,
      expiresAt: result.expiresAt,
      analyticsDistinctId: result.analyticsDistinctId,
      analyticsGrantId: result.analyticsGrantId,
      identityLabel: result.identityLabel,
      identityQuality: result.identityQuality,
      identityEmail: result.identityEmail,
      note: result.note,
    };
  } catch (error) {
    if (error instanceof Error && KNOWN_REDEEM_ERRORS.has(error.message)) {
      throw error;
    }

    try {
      await queueAndDeliverPostHogEvents(ctx, [
        buildAccessEvent(
          {
            ok: false,
            reason: "unexpected_error",
            normalizedCode,
          },
          source,
        ),
      ]);
    } catch (posthogError) {
      console.warn(
        "[PostHog] Fehler beim Senden des Unexpected-Redeem-Events.",
        posthogError,
      );
    }

    throw error;
  }
};

export const redeemAccessCode = action({
  args: {
    code: v.string(),
    source: v.optional(redeemSourceValidator),
  },
  handler: async (ctx, args): Promise<RedeemActionResult> => {
    return await performRedeem(ctx, args.code, args.source ?? "manual_code");
  },
});

export const consumeMagicLink = action({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args): Promise<RedeemActionResult> => {
    return await performRedeem(ctx, args.code, "magic_link");
  },
});
