import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { assertAdminSecret } from "./adminAuth";
import { action, internalMutation, query } from "./errorTracking";
import { getR2ConfigOrThrow, resolveStorageProvider } from "./fileStorage";

const DEFAULT_BATCH_SIZE = 25;

const patchDocumentAfterTransferRef = makeFunctionReference<
  "mutation",
  {
    documentId: string;
    storageId: string;
    storageProvider: "convex" | "r2";
  },
  void
>("storageMigration:patchDocumentAfterTransfer");

const getPendingDocumentsRef = makeFunctionReference<
  "query",
  { adminSecret: string; limit?: number },
  Array<{
    _id: string;
    fileName: string;
    sessionId: string;
    storageId: string;
    storageProvider: "convex" | "r2";
    storageState?: "orphaned";
    updatedAt: number;
  }>
>("storageMigration:getPendingConvexToR2Documents");

const markDocumentAsOrphanedRef = makeFunctionReference<
  "mutation",
  {
    documentId: string;
  },
  void
>("storageMigration:markDocumentAsOrphaned");

const getPendingDocumentsLimit = (limit?: number) =>
  Math.max(1, Math.min(limit ?? DEFAULT_BATCH_SIZE, 100));

const countDocuments = (query: object) =>
  (query as { count(): Promise<number> }).count();

export const getPendingConvexToR2Documents = query({
  args: {
    adminSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);
    const limit = getPendingDocumentsLimit(args.limit);

    const [convexDocuments, unlabeledDocuments] = await Promise.all([
      ctx.db
        .query("sessionDocuments")
        .withIndex("by_storageProvider_storageState_createdAt", (q) =>
          q.eq("storageProvider", "convex").eq("storageState", undefined),
        )
        .order("asc")
        .take(limit),
      ctx.db
        .query("sessionDocuments")
        .withIndex("by_storageProvider_storageState_createdAt", (q) =>
          q.eq("storageProvider", undefined).eq("storageState", undefined),
        )
        .order("asc")
        .take(limit),
    ]);

    return [...convexDocuments, ...unlabeledDocuments]
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(0, limit)
      .map((document) => ({
        _id: document._id,
        sessionId: document.sessionId,
        fileName: document.fileName,
        storageId: String(document.storageId),
        storageProvider: resolveStorageProvider(document.storageProvider),
        storageState: document.storageState,
        updatedAt: document.updatedAt,
      }));
  },
});

export const getStorageMigrationStatus = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const [
      convexDocuments,
      r2Documents,
      unlabeledDocuments,
      orphanedDocuments,
    ] = await Promise.all([
      countDocuments(
        ctx.db
          .query("sessionDocuments")
          .withIndex("by_storageProvider_createdAt", (q) =>
            q.eq("storageProvider", "convex"),
          ),
      ),
      countDocuments(
        ctx.db
          .query("sessionDocuments")
          .withIndex("by_storageProvider_createdAt", (q) =>
            q.eq("storageProvider", "r2"),
          ),
      ),
      countDocuments(
        ctx.db
          .query("sessionDocuments")
          .withIndex("by_storageProvider_createdAt", (q) =>
            q.eq("storageProvider", undefined),
          ),
      ),
      countDocuments(
        ctx.db
          .query("sessionDocuments")
          .withIndex("by_storageState_createdAt", (q) =>
            q.eq("storageState", "orphaned"),
          ),
      ),
    ]);
    const totalDocuments = convexDocuments + r2Documents + unlabeledDocuments;

    return {
      totalDocuments,
      convexDocuments,
      r2Documents,
      unlabeledDocuments,
      orphanedDocuments,
      pendingDocuments:
        convexDocuments + unlabeledDocuments - orphanedDocuments,
      isComplete:
        convexDocuments + unlabeledDocuments - orphanedDocuments === 0,
    };
  },
});

export const patchDocumentAfterTransfer = internalMutation({
  args: {
    documentId: v.id("sessionDocuments"),
    storageId: v.string(),
    storageProvider: v.union(v.literal("convex"), v.literal("r2")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      storageId: args.storageId,
      storageProvider: args.storageProvider,
      updatedAt: Date.now(),
    });
  },
});

export const markDocumentAsOrphaned = internalMutation({
  args: {
    documentId: v.id("sessionDocuments"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      storageState: "orphaned",
      updatedAt: Date.now(),
    });
  },
});

export const migrateDocumentsToR2Batch = action({
  args: {
    adminSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);
    const batchSize = Math.max(
      1,
      Math.min(args.limit ?? DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE),
    );
    const r2Config = getR2ConfigOrThrow();

    const documents = await ctx.runQuery(getPendingDocumentsRef, {
      adminSecret: args.adminSecret,
      limit: batchSize,
    });

    const results: Array<
      | {
          documentId: string;
          fileName: string;
          status: "migrated";
          storageId: string;
          storageProvider: "r2";
        }
      | {
          documentId: string;
          fileName: string;
          status: "skipped";
          reason: string;
        }
      | {
          documentId: string;
          fileName: string;
          status: "orphaned";
          reason: string;
        }
      | {
          documentId: string;
          fileName: string;
          status: "failed";
          reason: string;
        }
    > = [];

    for (const document of documents) {
      if (document.storageProvider === "r2") {
        results.push({
          documentId: document._id,
          fileName: document.fileName,
          status: "skipped",
          reason: "Dokument ist bereits in R2 gespeichert.",
        });
        continue;
      }

      try {
        const transferResult = await ctx.runAction(
          components.convexFilesControl.transfer.transferFile,
          {
            storageId: document.storageId,
            targetProvider: "r2",
            r2Config,
          },
        );

        await ctx.runMutation(patchDocumentAfterTransferRef, {
          documentId: document._id as Id<"sessionDocuments">,
          storageId: transferResult.storageId,
          storageProvider: transferResult.storageProvider,
        });

        results.push({
          documentId: document._id,
          fileName: document.fileName,
          status: "migrated",
          storageId: transferResult.storageId,
          storageProvider: "r2",
        });
      } catch (error) {
        const reason =
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler bei der R2-Migration.";

        if (reason.includes("File not found")) {
          await ctx.runMutation(markDocumentAsOrphanedRef, {
            documentId: document._id as Id<"sessionDocuments">,
          });

          results.push({
            documentId: document._id,
            fileName: document.fileName,
            status: "orphaned",
            reason:
              "Originaldatei in Convex Storage nicht mehr vorhanden. Dokument wird von weiteren R2-Migrationsversuchen ausgeschlossen.",
          });
          continue;
        }

        results.push({
          documentId: document._id,
          fileName: document.fileName,
          status: "failed",
          reason,
        });
      }
    }

    return {
      requested: batchSize,
      processed: documents.length,
      migrated: results.filter((result) => result.status === "migrated").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      orphaned: results.filter((result) => result.status === "orphaned").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    };
  },
});
