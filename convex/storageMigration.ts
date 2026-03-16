"use node";

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
    updatedAt: number;
  }>
>("storageMigration:getPendingConvexToR2Documents");

export const getPendingConvexToR2Documents = query({
  args: {
    adminSecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);

    const documents = await ctx.db
      .query("sessionDocuments")
      .withIndex("by_createdAt")
      .order("asc")
      .collect();

    return documents
      .filter(
        (document) =>
          resolveStorageProvider(document.storageProvider) === "convex",
      )
      .slice(0, Math.max(1, Math.min(args.limit ?? DEFAULT_BATCH_SIZE, 100)))
      .map((document) => ({
        _id: document._id,
        sessionId: document.sessionId,
        fileName: document.fileName,
        storageId: String(document.storageId),
        storageProvider: resolveStorageProvider(document.storageProvider),
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

    const documents = await ctx.db.query("sessionDocuments").collect();
    const totalDocuments = documents.length;
    let convexDocuments = 0;
    let r2Documents = 0;
    let unlabeledDocuments = 0;

    for (const document of documents) {
      if (document.storageProvider === undefined) {
        unlabeledDocuments += 1;
        continue;
      }

      if (document.storageProvider === "r2") {
        r2Documents += 1;
        continue;
      }

      convexDocuments += 1;
    }

    return {
      totalDocuments,
      convexDocuments,
      r2Documents,
      unlabeledDocuments,
      pendingDocuments: convexDocuments + unlabeledDocuments,
      isComplete: convexDocuments === 0 && unlabeledDocuments === 0,
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
        results.push({
          documentId: document._id,
          fileName: document.fileName,
          status: "failed",
          reason:
            error instanceof Error
              ? error.message
              : "Unbekannter Fehler bei der R2-Migration.",
        });
      }
    }

    return {
      requested: batchSize,
      processed: documents.length,
      migrated: results.filter((result) => result.status === "migrated").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    };
  },
});
