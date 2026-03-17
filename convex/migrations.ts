import { Migrations } from "@convex-dev/migrations";
import type { ComponentApi as MigrationsComponentApi } from "@convex-dev/migrations/_generated/component.js";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation } from "./errorTracking";

const migrationsComponent = (
  components as typeof components & { migrations: MigrationsComponentApi }
).migrations;
const internalApi = internal as typeof internal & {
  migrations: {
    backfillSessionDocumentsStorageProvider: unknown;
    normalizeSessionDocumentsStorageIdToString: unknown;
  };
};

export const migrations = new Migrations<DataModel>(migrationsComponent, {
  internalMutation,
  defaultBatchSize: 25,
});

export const backfillSessionDocumentsStorageProvider = migrations.define({
  table: "sessionDocuments",
  batchSize: 25,
  parallelize: false,
  migrateOne: async (_ctx, document) => {
    if (document.storageProvider !== undefined) {
      return;
    }

    return {
      storageProvider: "convex" as const,
    };
  },
});

export const normalizeSessionDocumentsStorageIdToString = migrations.define({
  table: "sessionDocuments",
  batchSize: 25,
  parallelize: false,
  migrateOne: async (_ctx, document) => {
    if (typeof document.storageId === "string") {
      return;
    }

    return {
      storageId: String(document.storageId),
    };
  },
});

export const run = migrations.runner([
  internalApi.migrations.backfillSessionDocumentsStorageProvider as never,
  internalApi.migrations.normalizeSessionDocumentsStorageIdToString as never,
]);
