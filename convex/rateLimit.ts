import type { MutationCtx } from "./errorTracking";

/** Alle Formulare von stackprep.de zählen in Fenstern von 10 Minuten. */
export const RATE_LIMIT_WINDOW_MS = 1000 * 60 * 10;

/**
 * Zählt eine Anfrage für den Schlüssel (meist eine gehashte IP) und sagt, ob
 * sie im aktuellen Fenster noch erlaubt ist. Die Zähler liegen in
 * waitlistRateLimits und werden vom Cron aufgeräumt.
 */
export const consumeRateLimit = async (
  ctx: MutationCtx,
  key: string,
  maxRequests: number,
) => {
  const now = Date.now();
  const rateLimit = await ctx.db
    .query("waitlistRateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!rateLimit) {
    await ctx.db.insert("waitlistRateLimits", {
      key,
      windowStartedAt: now,
      count: 1,
    });
    return true;
  }

  if (now - rateLimit.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    await ctx.db.patch("waitlistRateLimits", rateLimit._id, {
      windowStartedAt: now,
      count: 1,
    });
    return true;
  }

  if (rateLimit.count >= maxRequests) {
    return false;
  }

  await ctx.db.patch("waitlistRateLimits", rateLimit._id, {
    count: rateLimit.count + 1,
  });
  return true;
};
