import { v } from "convex/values";
import {
  DIRECT_SOURCE,
  incrementCampaignStat,
  normalizeCampaignValue,
} from "./campaigns";
import { internalMutation } from "./errorTracking";
import { apprenticeCountValidator } from "./leadValidators";
import { consumeRateLimit } from "./rateLimit";
import { isValidWaitlistEmail, normalizeWaitlistEmail } from "./waitlist";

const RATE_LIMIT_MAX_REQUESTS = 5;
const MAX_COMPANY_NAME_LENGTH = 120;
const MAX_PROFESSIONS_LENGTH = 300;

const normalizeText = (text: string) => text.trim().replace(/\s+/g, " ");

export const normalizeCompanyName = normalizeText;

export const isValidCompanyName = (companyName: string) =>
  companyName.length >= 2 && companyName.length <= MAX_COMPANY_NAME_LENGTH;

export const isValidProfessions = (professions: string) =>
  normalizeText(professions).length <= MAX_PROFESSIONS_LENGTH;

/**
 * Speichert die Anfrage eines Ausbildungsbetriebs vom Formular auf
 * stackprep.de. Schickt derselbe Betrieb das Formular noch einmal, wird seine
 * Anfrage aktualisiert statt doppelt gezählt.
 */
export const submit = internalMutation({
  args: {
    companyName: v.string(),
    email: v.string(),
    apprenticeCount: apprenticeCountValidator,
    professions: v.optional(v.string()),
    consentTextVersion: v.string(),
    rateLimitKey: v.string(),
    source: v.optional(v.string()),
    campaign: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyName = normalizeCompanyName(args.companyName);
    const email = normalizeWaitlistEmail(args.email);
    if (!isValidCompanyName(companyName)) {
      throw new Error("Ungültiger Firmenname.");
    }
    if (!isValidWaitlistEmail(email)) {
      throw new Error("Ungültige E-Mail-Adresse.");
    }
    if (
      args.professions !== undefined &&
      !isValidProfessions(args.professions)
    ) {
      throw new Error("Die Angabe der Berufe ist zu lang.");
    }

    if (
      !(await consumeRateLimit(
        ctx,
        `company:${args.rateLimitKey}`,
        RATE_LIMIT_MAX_REQUESTS,
      ))
    ) {
      return { status: "rate_limited" as const };
    }

    const now = Date.now();
    const inquiryFields = {
      companyName,
      apprenticeCount: args.apprenticeCount,
      professions: args.professions
        ? normalizeText(args.professions) || undefined
        : undefined,
      consentTextVersion: args.consentTextVersion,
      consentGivenAt: now,
      updatedAt: now,
    };

    const existing = await ctx.db
      .query("companyInquiries")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      await ctx.db.patch("companyInquiries", existing._id, inquiryFields);
      return { status: "received" as const };
    }

    const attribution = {
      source: normalizeCampaignValue(args.source),
      campaign: normalizeCampaignValue(args.campaign),
    };
    await ctx.db.insert("companyInquiries", {
      email,
      source: attribution.source ?? DIRECT_SOURCE,
      campaign: attribution.campaign,
      createdAt: now,
      ...inquiryFields,
    });
    await incrementCampaignStat(ctx, attribution, "companyInquiries");

    return { status: "received" as const };
  },
});
