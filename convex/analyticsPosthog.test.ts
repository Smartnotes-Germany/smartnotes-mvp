import { describe, expect, it } from "vitest";
import {
  sanitizePostHogErrorMessageForStorage,
  sanitizePostHogPropertiesForStorage,
} from "./analyticsPosthog";

describe("convex/analyticsPosthog storage sanitization", () => {
  it("hasht personenbezogene und tokenartige Properties vor dem Persistieren", () => {
    const sanitized = sanitizePostHogPropertiesForStorage({
      status: "succeeded",
      latencyMs: 420,
      identityEmail: "max@schule.de",
      normalizedCode: "SMARTNOTES-ABCD1234",
      documentIds: ["doc_123", "doc_456"],
      identity_quality: "email",
    });

    expect(sanitized).toMatchObject({
      status: "succeeded",
      latencyMs: 420,
      identity_quality: "email",
    });
    expect(sanitized.identityEmail).toMatch(/^hash:/);
    expect(sanitized.normalizedCode).toMatch(/^hash:/);
    expect(sanitized.documentIds).toEqual(
      expect.arrayContaining([expect.stringMatching(/^hash:/)]),
    );
  });

  it("redigiert sensible Fehlerdetails und behält nur eine kurze Diagnose", () => {
    const sanitized = sanitizePostHogErrorMessageForStorage(
      "Request für max@schule.de mit smartnotes-user:email:max@schule.de und Token abcdefghijklmnopqrstuvwxyz ist fehlgeschlagen.",
    );

    expect(sanitized).toContain("[redacted-email]");
    expect(sanitized).toContain("[redacted-id]");
    expect(sanitized).toContain("[redacted-token]");
    expect(sanitized).toContain("[hash:");
    expect(sanitized).not.toContain("max@schule.de");
  });
});
