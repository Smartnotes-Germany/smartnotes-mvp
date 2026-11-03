import { cronJobs, makeFunctionReference } from "convex/server";

const runDailyRetentionRef = makeFunctionReference<
  "action",
  Record<string, never>,
  {
    redactedDocuments: number;
    redactedResponses: number;
    deletedAnalyticsEvents: number;
    deletedPostHogOutboxEvents: number;
    deletedManagedFiles: number;
    deletedOrphanedDocuments: number;
    batches: number;
  }
>("retention:runDailyRetention");

const processPostHogOutboxRef = makeFunctionReference<
  "action",
  { limit?: number },
  { processed: number }
>("analyticsPosthog:processPostHogOutbox");

const cleanupWaitlistRateLimitsRef = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { deleted: number }
>("waitlist:cleanupRateLimits");

const crons = cronJobs();

crons.daily(
  "balanced-mode-retention-cleanup",
  {
    hourUTC: 2,
    minuteUTC: 20,
  },
  runDailyRetentionRef,
  {},
);

crons.interval(
  "posthog-outbox-delivery",
  {
    minutes: 1,
  },
  processPostHogOutboxRef,
  {
    limit: 50,
  },
);

crons.interval(
  "waitlist-rate-limit-cleanup",
  {
    minutes: 30,
  },
  cleanupWaitlistRateLimitsRef,
  {},
);

export default crons;
