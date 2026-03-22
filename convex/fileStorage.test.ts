import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getConfiguredStorageProvider,
  getR2ConfigOrThrow,
} from "./fileStorage";

const STORAGE_ENV_NAMES = [
  "FILE_STORAGE_PROVIDER",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

const originalStorageEnv = new Map(
  STORAGE_ENV_NAMES.map((name) => [name, process.env[name]] as const),
);

const resetStorageEnv = () => {
  for (const name of STORAGE_ENV_NAMES) {
    delete process.env[name];
  }
};

beforeEach(() => {
  resetStorageEnv();
});

afterEach(() => {
  for (const name of STORAGE_ENV_NAMES) {
    const originalValue = originalStorageEnv.get(name);
    if (originalValue === undefined) {
      delete process.env[name];
      continue;
    }

    process.env[name] = originalValue;
  }
});

describe("convex/fileStorage ENV handling", () => {
  it("verwendet standardmäßig R2, wenn kein Provider gesetzt ist", () => {
    expect(getConfiguredStorageProvider()).toBe("r2");
  });

  it("akzeptiert gültige Providerwerte mit umgebenden Leerzeichen", () => {
    process.env.FILE_STORAGE_PROVIDER = " convex ";
    expect(getConfiguredStorageProvider()).toBe("convex");

    process.env.FILE_STORAGE_PROVIDER = " r2 ";
    expect(getConfiguredStorageProvider()).toBe("r2");
  });

  it("lehnt unbekannte Providerwerte mit klarer Fehlermeldung ab", () => {
    process.env.FILE_STORAGE_PROVIDER = "s3";

    expect(() => getConfiguredStorageProvider()).toThrow(
      "FILE_STORAGE_PROVIDER muss entweder 'convex' oder 'r2' sein.",
    );
  });

  it("liefert getrimmte R2-Zugangsdaten zurück", () => {
    process.env.R2_ACCOUNT_ID = " account ";
    process.env.R2_ACCESS_KEY_ID = " key ";
    process.env.R2_SECRET_ACCESS_KEY = " secret ";
    process.env.R2_BUCKET_NAME = " bucket ";

    expect(getR2ConfigOrThrow()).toEqual({
      accountId: "account",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucketName: "bucket",
    });
  });

  it("verlangt alle R2-Zugangsdaten, sobald R2 verwendet wird", () => {
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";

    expect(() => getR2ConfigOrThrow()).toThrow(
      "R2 ist aktiviert, aber R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY oder R2_BUCKET_NAME fehlen.",
    );
  });
});
