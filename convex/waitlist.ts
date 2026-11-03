import { v } from "convex/values";
import { incrementCampaignStat, normalizeCampaignValue } from "./campaigns";
import { internalMutation } from "./errorTracking";
import { professionValidator } from "./leadValidators";
import { RATE_LIMIT_WINDOW_MS, consumeRateLimit } from "./rateLimit";

/** Bestätigungslinks gelten 48 Stunden. */
const CONFIRMATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 48;
/** Frühestens nach 10 Minuten wird für dieselbe Adresse ein neuer Link ausgestellt. */
const CONFIRMATION_REISSUE_COOLDOWN_MS = 1000 * 60 * 10;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_CLEANUP_BATCH_SIZE = 200;

const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export const normalizeWaitlistEmail = (email: string) =>
  email.trim().toLowerCase();

export const isValidWaitlistEmail = (email: string) =>
  email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email);

/**
 * Trägt eine E-Mail-Adresse als unbestätigt ein oder stellt für einen offenen
 * Eintrag einen neuen Bestätigungslink aus. Der Aufrufer erzeugt den Token
 * und übergibt nur seinen Hash.
 */
export const signUp = internalMutation({
  args: {
    email: v.string(),
    consentTextVersion: v.string(),
    rateLimitKey: v.string(),
    confirmationTokenHash: v.string(),
    profession: v.optional(professionValidator),
    source: v.optional(v.string()), // utm_source oder Referrer, sonst "direkt".
    campaign: v.optional(v.string()), // utm_campaign, falls vorhanden.
  },
  handler: async (ctx, args) => {
    const email = normalizeWaitlistEmail(args.email);
    if (!isValidWaitlistEmail(email)) {
      throw new Error("Ungültige E-Mail-Adresse.");
    }
    if (!SHA256_HEX_PATTERN.test(args.confirmationTokenHash)) {
      throw new Error("Ungültiger Token-Hash.");
    }

    const now = Date.now();

    if (
      !(await consumeRateLimit(ctx, args.rateLimitKey, RATE_LIMIT_MAX_REQUESTS))
    ) {
      return { status: "rate_limited" as const, sendConfirmation: false };
    }

    const existing = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing?.status === "confirmed") {
      return { status: "already_confirmed" as const, sendConfirmation: false };
    }

    if (
      existing?.confirmationIssuedAt !== undefined &&
      now - existing.confirmationIssuedAt < CONFIRMATION_REISSUE_COOLDOWN_MS
    ) {
      return { status: "pending" as const, sendConfirmation: false };
    }

    const confirmationFields = {
      consentTextVersion: args.consentTextVersion,
      consentGivenAt: now,
      confirmationTokenHash: args.confirmationTokenHash,
      confirmationTokenExpiresAt: now + CONFIRMATION_TOKEN_TTL_MS,
      confirmationIssuedAt: now,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch("waitlistEntries", existing._id, {
        ...confirmationFields,
        profession: args.profession ?? existing.profession,
      });
    } else {
      // Die Quelle gilt für den ersten Eintrag, spätere Versuche überschreiben sie nicht.
      const attribution = {
        source: normalizeCampaignValue(args.source),
        campaign: normalizeCampaignValue(args.campaign),
      };
      await ctx.db.insert("waitlistEntries", {
        email,
        status: "pending",
        profession: args.profession,
        ...attribution,
        createdAt: now,
        ...confirmationFields,
      });
      await incrementCampaignStat(ctx, attribution, "signups");
    }

    return { status: "pending" as const, sendConfirmation: true };
  },
});

/** Bestätigt einen Eintrag über den Hash des Tokens aus dem Bestätigungslink. */
export const confirm = internalMutation({
  args: {
    confirmationTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    if (!SHA256_HEX_PATTERN.test(args.confirmationTokenHash)) {
      return { status: "invalid" as const };
    }

    const entry = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_confirmationTokenHash", (q) =>
        q.eq("confirmationTokenHash", args.confirmationTokenHash),
      )
      .unique();

    const now = Date.now();
    if (
      !entry ||
      entry.confirmationTokenExpiresAt === undefined ||
      entry.confirmationTokenExpiresAt < now
    ) {
      return { status: "invalid" as const };
    }

    // Der Token ist einmalig: Nach der Bestätigung wird er entfernt.
    await ctx.db.patch("waitlistEntries", entry._id, {
      status: "confirmed",
      confirmedAt: now,
      confirmationTokenHash: undefined,
      confirmationTokenExpiresAt: undefined,
      updatedAt: now,
    });
    await incrementCampaignStat(ctx, entry, "confirmations");

    return { status: "confirmed" as const };
  },
});

/** Löscht abgelaufene Rate-Limit-Zähler. */
export const cleanupRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("waitlistRateLimits")
      .withIndex("by_windowStartedAt", (q) =>
        q.lt("windowStartedAt", Date.now() - RATE_LIMIT_WINDOW_MS),
      )
      .take(RATE_LIMIT_CLEANUP_BATCH_SIZE);

    for (const rateLimit of expired) {
      await ctx.db.delete("waitlistRateLimits", rateLimit._id);
    }

    return { deleted: expired.length };
  },
});
