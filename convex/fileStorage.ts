import { components } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./errorTracking";

export type StorageProvider = "convex" | "r2";

export type ManagedStorageReference = {
  storageId: string;
  storageProvider: StorageProvider;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

type ReadUrlContext = {
  runMutation: ActionCtx["runMutation"] | MutationCtx["runMutation"];
};

type DeleteFileContext = {
  runMutation: ActionCtx["runMutation"] | MutationCtx["runMutation"];
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

export const getConfiguredStorageProvider = (): StorageProvider => {
  const configuredValue =
    process.env.FILE_STORAGE_PROVIDER?.trim().toLowerCase();
  if (!configuredValue) {
    return "r2";
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

export const createManagedReadUrl = async (
  ctx: ReadUrlContext,
  reference: ManagedStorageReference,
  accessKey?: string,
  trace?: TraceLogger,
) => {
  if (!accessKey) {
    const grantErrorDetail = {
      message: "Verwaltete Dateizugriffe erfordern einen accessKey.",
    };

    trace?.log("warn", "document_download_grant_access_key_missing", {
      storageId: reference.storageId,
      storageProvider: reference.storageProvider,
      grantErrorDetail,
    });

    return {
      fileUrl: null,
      source: "download_grant" as const,
      status: "missing_access_key",
      grantErrorDetail,
    };
  }

  try {
    const r2Config = maybeGetR2Config(reference.storageProvider);
    const downloadGrant = await ctx.runMutation(
      components.convexFilesControl.download.createDownloadGrant,
      {
        storageId: reference.storageId,
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
      storageId: reference.storageId,
      storageProvider: reference.storageProvider,
      grantErrorDetail,
    });

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
  const r2Config = maybeGetR2Config(reference.storageProvider);
  const deleted = await ctx.runMutation(
    components.convexFilesControl.cleanUp.deleteFile,
    {
      storageId: reference.storageId,
      ...(r2Config ? { r2Config } : {}),
    },
  );

  return { deleted: deleted.deleted, fallbackUsed: false };
};
