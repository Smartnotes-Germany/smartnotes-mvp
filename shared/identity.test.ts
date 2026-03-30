import { describe, expect, it } from "vitest";
import {
  buildAnalyticsDistinctId,
  hasMeaningfulIdentityLabel,
} from "./identity";

describe("shared/identity", () => {
  it("erkennt sinnvolle Nutzerkennungen", () => {
    expect(hasMeaningfulIdentityLabel("!!!")).toBe(false);
    expect(hasMeaningfulIdentityLabel("   ???   ")).toBe(false);
    expect(hasMeaningfulIdentityLabel(" Max Mustermann ")).toBe(true);
    expect(hasMeaningfulIdentityLabel("Matrikelnummer 42")).toBe(true);
  });

  it("normalisiert E-Mail-Adressen für analyticsDistinctId", () => {
    expect(
      buildAnalyticsDistinctId({
        grantId: "grant_123",
        identityEmail: " Max@Schule.DE ",
      }),
    ).toBe("smartnotes-user:email:max@schule.de");
  });

  it("verwendet ohne E-Mail eine grantbasierte analyticsDistinctId", () => {
    expect(
      buildAnalyticsDistinctId({
        grantId: "grant_123",
      }),
    ).toBe("smartnotes-user:grant:grant_123");
  });
});
