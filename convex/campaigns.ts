import { v } from "convex/values";
import { assertAdminSecret } from "./adminAuth";
import { internalMutation, query, type MutationCtx } from "./errorTracking";
import type { Profession } from "./leadValidators";
import { consumeRateLimit } from "./rateLimit";

/** Besuche zählen wir nur für Links mit Quelle, und auch dann höchstens 30 pro IP in 10 Minuten. */
const VISIT_RATE_LIMIT_MAX_REQUESTS = 30;
const OVERVIEW_DAYS = 90;
const OVERVIEW_ROW_LIMIT = 2000;
const PROFESSION_SAMPLE_SIZE = 1000;
const RECENT_COMPANY_INQUIRIES = 50;

/** Quelle für Anmeldungen ohne utm_source und ohne erkennbaren Referrer. */
export const DIRECT_SOURCE = "direkt";

const CAMPAIGN_VALUE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,39}$/;

/** Bringt utm_source und utm_campaign in eine feste Form, damit die Statistik nicht zerfasert. */
export const normalizeCampaignValue = (value: string | undefined) => {
  const normalized = value?.trim().toLowerCase();
  return normalized && CAMPAIGN_VALUE_PATTERN.test(normalized)
    ? normalized
    : undefined;
};

type CampaignCounter =
  | "visits"
  | "signups"
  | "confirmations"
  | "companyInquiries";

type Attribution = { source?: string; campaign?: string };

const dayOf = (timestamp: number) =>
  new Date(timestamp).toISOString().slice(0, 10);

/** Zählt ein Ereignis im Tageszähler der Quelle hoch, ohne dafür Anmeldungen durchzählen zu müssen. */
export const incrementCampaignStat = async (
  ctx: MutationCtx,
  attribution: Attribution,
  counter: CampaignCounter,
) => {
  const day = dayOf(Date.now());
  const source = attribution.source ?? DIRECT_SOURCE;
  const campaign = attribution.campaign ?? "";

  const existing = await ctx.db
    .query("campaignDailyStats")
    .withIndex("by_day_source_campaign", (q) =>
      q.eq("day", day).eq("source", source).eq("campaign", campaign),
    )
    .unique();

  if (existing) {
    await ctx.db.patch("campaignDailyStats", existing._id, {
      [counter]: existing[counter] + 1,
    });
    return;
  }

  const counters: Record<CampaignCounter, number> = {
    visits: 0,
    signups: 0,
    confirmations: 0,
    companyInquiries: 0,
  };
  counters[counter] = 1;
  await ctx.db.insert("campaignDailyStats", {
    day,
    source,
    campaign,
    ...counters,
  });
};

/** Zählt einen Besuch über einen Link mit Quelle, zum Beispiel aus einem LinkedIn-Post. */
export const recordVisit = internalMutation({
  args: {
    source: v.string(),
    campaign: v.optional(v.string()),
    rateLimitKey: v.string(),
  },
  handler: async (ctx, args) => {
    const source = normalizeCampaignValue(args.source);
    if (!source) {
      return { status: "ignored" as const };
    }

    const allowed = await consumeRateLimit(
      ctx,
      `visit:${args.rateLimitKey}`,
      VISIT_RATE_LIMIT_MAX_REQUESTS,
    );
    if (!allowed) {
      return { status: "rate_limited" as const };
    }

    await incrementCampaignStat(
      ctx,
      { source, campaign: normalizeCampaignValue(args.campaign) },
      "visits",
    );
    return { status: "counted" as const };
  },
});

type CampaignTotals = Record<CampaignCounter, number>;

const emptyTotals = (): CampaignTotals => ({
  visits: 0,
  signups: 0,
  confirmations: 0,
  companyInquiries: 0,
});

const addTotals = (target: CampaignTotals, row: CampaignTotals) => {
  target.visits += row.visits;
  target.signups += row.signups;
  target.confirmations += row.confirmations;
  target.companyInquiries += row.companyInquiries;
};

/** Zeigt im Admin-Dashboard, was Posts und Links an Besuchen, Anmeldungen und Betriebsanfragen bringen. */
export const overview = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const fromDay = dayOf(Date.now() - OVERVIEW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await ctx.db
      .query("campaignDailyStats")
      .withIndex("by_day_source_campaign", (q) => q.gte("day", fromDay))
      .take(OVERVIEW_ROW_LIMIT);

    const bySource = new Map<
      string,
      CampaignTotals & { source: string; campaign: string }
    >();
    const byDay = new Map<string, CampaignTotals & { day: string }>();
    for (const row of rows) {
      const sourceKey = `${row.source}\u0000${row.campaign}`;
      const sourceTotals = bySource.get(sourceKey) ?? {
        source: row.source,
        campaign: row.campaign,
        ...emptyTotals(),
      };
      addTotals(sourceTotals, row);
      bySource.set(sourceKey, sourceTotals);

      const dayTotals = byDay.get(row.day) ?? {
        day: row.day,
        ...emptyTotals(),
      };
      addTotals(dayTotals, row);
      byDay.set(row.day, dayTotals);
    }

    const professions = new Map<Profession, number>();
    const entries = await ctx.db
      .query("waitlistEntries")
      .order("desc")
      .take(PROFESSION_SAMPLE_SIZE);
    for (const entry of entries) {
      if (entry.profession) {
        professions.set(
          entry.profession,
          (professions.get(entry.profession) ?? 0) + 1,
        );
      }
    }

    const companyInquiries = await ctx.db
      .query("companyInquiries")
      .withIndex("by_createdAt")
      .order("desc")
      .take(RECENT_COMPANY_INQUIRIES);

    return {
      fromDay,
      bySource: [...bySource.values()].sort(
        (a, b) =>
          b.signups + b.companyInquiries - (a.signups + a.companyInquiries) ||
          b.visits - a.visits,
      ),
      byDay: [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day)),
      professions: [...professions.entries()]
        .map(([profession, count]) => ({ profession, count }))
        .sort((a, b) => b.count - a.count),
      professionSampleSize: entries.length,
      companyInquiries: companyInquiries.map((inquiry) => ({
        id: inquiry._id,
        companyName: inquiry.companyName,
        email: inquiry.email,
        apprenticeCount: inquiry.apprenticeCount,
        professions: inquiry.professions,
        source: inquiry.source,
        campaign: inquiry.campaign,
        createdAt: inquiry.createdAt,
      })),
    };
  },
});
