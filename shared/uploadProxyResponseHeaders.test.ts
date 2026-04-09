import { describe, expect, it } from "vitest";
import { shouldForwardUploadProxyResponseHeader } from "./uploadProxyResponseHeaders";

describe("shared/uploadProxyResponseHeaders", () => {
  it("blockiert Header, die nach automatischer Dekomprimierung falsch wären", () => {
    expect(shouldForwardUploadProxyResponseHeader("content-encoding")).toBe(
      false,
    );
    expect(shouldForwardUploadProxyResponseHeader("content-length")).toBe(
      false,
    );
  });

  it("blockiert klassische Hop-by-Hop-Header unabhängig von Großschreibung", () => {
    expect(shouldForwardUploadProxyResponseHeader("Connection")).toBe(false);
    expect(shouldForwardUploadProxyResponseHeader("KEEP-ALIVE")).toBe(false);
    expect(shouldForwardUploadProxyResponseHeader("transfer-encoding")).toBe(
      false,
    );
  });

  it("lässt normale End-to-End-Header passieren", () => {
    expect(shouldForwardUploadProxyResponseHeader("content-type")).toBe(true);
    expect(shouldForwardUploadProxyResponseHeader("etag")).toBe(true);
  });
});
