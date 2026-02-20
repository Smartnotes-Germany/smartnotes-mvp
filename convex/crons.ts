import { cronJobs, makeFunctionReference } from "convex/server";

const runDailyRetentionRef = makeFunctionReference<
  "action",
  Record<string, never>,
  {
    redactedDocuments: number;
    redactedResponses: number;
    deletedAnalyticsEvents: number;
    batches: number;
  }
>("retention:runDailyRetention");

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

export default crons;
