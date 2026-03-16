import type { Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./errorTracking";

export type StorageProvider = "convex" | "r2";

export type ManagedStorageReference = {
  storageId: string | Id<"_storage">;
  storageProvider?: StorageProvider;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

type ReadUrlContext = {
  runMutation: ActionCtx["runMutation"] | MutationCtx["runMutation"];
  storage?: {
    getUrl: (storageId: Id<"_storage">) => Promise<string | null>;
  };
};

type DeleteFileContext = {
  runMutation: MutationCtx["runMutation"];
  storage: {
    delete: (storageId: Id<"_storage">) => Promise<void>;
  };
};

type TraceLogger = {
  log: (
    level: "info" | "warn" | "error",
    event: string,
    details?: Record<string, unknown>,
  ) => void;
};

const STORAGE_PROVIDER_VALUES = new Set<StorageProvider>(["convex", "r2"]);
const DOWNLOAD_GRANT_TTL_MS = 5 * 60 * 1000;

const normalizeStorageId = (storageId: string | Id<"_storage">) =>
  String(storageId);

export const resolveStorageProvider = (
  storageProvider?: StorageProvider,
): StorageProvider => storageProvider ?? "convex";

export const getConfiguredStorageProvider = (): StorageProvider => {
  const configuredValue =
    process.env.FILE_STORAGE_PROVIDER?.trim().toLowerCase();
  if (!configuredValue) {
    return "convex";
  }

  if (!STORAGE_PROVIDER_VALUES.has(configuredValue as StorageProvider)) {
    throw new Error(
      "FILE_STORAGE_PROVIDER muss entweder 'convex' oder 'r2' sein.",
    );
  }

  return configuredValue as StorageProvider;
};

export const getR2ConfigOrThrow = (): R2Config => {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "R2 ist aktiviert, aber R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY oder R2_BUCKET_NAME fehlen.",
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
  };
};

const maybeGetR2Config = (provider: StorageProvider) =>
  provider === "r2" ? getR2ConfigOrThrow() : undefined;

const createStorageFallbackUrl = async (
  ctx: ReadUrlContext,
  storageId: string | Id<"_storage">,
  status: string,
  grantErrorDetail?: Record<string, unknown>,
) => {
  if (!ctx.storage) {
    return {
      fileUrl: null,
      source: "storage" as const,
      status,
      grantErrorDetail,
    };
  }

  return {
    fileUrl: await ctx.storage.getUrl(storageId as Id<"_storage">),
    source: "storage" as const,
    status,
    grantErrorDetail,
  };
};

export const createManagedReadUrl = async (
  ctx: ReadUrlContext,
  reference: ManagedStorageReference,
  accessKey?: string,
  trace?: TraceLogger,
) => {
  const storageProvider = resolveStorageProvider(reference.storageProvider);
  const storageId = normalizeStorageId(reference.storageId);

  if (!accessKey && storageProvider === "convex" && ctx.storage) {
    return createStorageFallbackUrl(ctx, reference.storageId, "direct");
  }

  try {
    const r2Config = maybeGetR2Config(storageProvider);
    const downloadGrant = await ctx.runMutation(
      components.convexFilesControl.download.createDownloadGrant,
      {
        storageId,
        maxUses: 1,
        expiresAt: Date.now() + DOWNLOAD_GRANT_TTL_MS,
      },
    );

    const consumeResult = await ctx.runMutation(
      components.convexFilesControl.download.consumeDownloadGrantForUrl,
      {
        downloadToken: downloadGrant.downloadToken,
        accessKey,
        ...(r2Config ? { r2Config } : {}),
      },
    );

    if (consumeResult.status === "ok" && consumeResult.downloadUrl) {
      return {
        fileUrl: consumeResult.downloadUrl,
        source: "download_grant" as const,
        status: consumeResult.status,
      };
    }

    if (storageProvider === "convex") {
      return createStorageFallbackUrl(
        ctx,
        reference.storageId,
        consumeResult.status,
      );
    }

    return {
      fileUrl: null,
      source: "download_grant" as const,
      status: consumeResult.status,
    };
  } catch (error) {
    const grantErrorDetail =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : {
            type: typeof error,
          };

    trace?.log("warn", "document_download_grant_url_failed", {
      storageId,
      storageProvider,
      grantErrorDetail,
    });

    if (storageProvider === "convex") {
      return createStorageFallbackUrl(
        ctx,
        reference.storageId,
        "grant_error",
        grantErrorDetail,
      );
    }

    return {
      fileUrl: null,
      source: "download_grant" as const,
      status: "grant_error",
      grantErrorDetail,
    };
  }
};

export const deleteManagedFile = async (
  ctx: DeleteFileContext,
  reference: ManagedStorageReference,
) => {
  const storageProvider = resolveStorageProvider(reference.storageProvider);
  const storageId = normalizeStorageId(reference.storageId);

  try {
    const r2Config = maybeGetR2Config(storageProvider);
    const deleted = await ctx.runMutation(
      components.convexFilesControl.cleanUp.deleteFile,
      {
        storageId,
        ...(r2Config ? { r2Config } : {}),
      },
    );

    if (!deleted.deleted && storageProvider === "convex") {
      await ctx.storage.delete(reference.storageId as Id<"_storage">);
      return { deleted: true, fallbackUsed: true };
    }

    return { deleted: deleted.deleted, fallbackUsed: false };
  } catch {
    if (storageProvider === "convex") {
      try {
        await ctx.storage.delete(reference.storageId as Id<"_storage">);
        return { deleted: true, fallbackUsed: true };
      } catch {
        return { deleted: false, fallbackUsed: false };
      }
    }

    return { deleted: false, fallbackUsed: false };
  }
};
