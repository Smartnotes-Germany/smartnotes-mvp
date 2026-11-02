import { describe, expect, it } from "vitest";
import {
  resolvePostHogCookieDomain,
  resolvePostHogEnvironment,
} from "./posthogRuntime";

describe("shared/posthogRuntime", () => {
  it("erkennt Produktions-Domains", () => {
    expect(resolvePostHogEnvironment("app.stackprep.de", false)).toBe(
      "production",
    );
    expect(resolvePostHogEnvironment("stackprep.de", false)).toBe("production");
    expect(resolvePostHogEnvironment("app.smartnotes.tech", false)).toBe(
      "production",
    );
    expect(resolvePostHogEnvironment("notstackprep.de", false)).toBe("preview");
    expect(resolvePostHogEnvironment("mvp.vercel.app", false)).toBe("preview");
    expect(resolvePostHogEnvironment("localhost", false)).toBe("development");
  });

  it("setzt die Cookie-Domain nur in Produktion", () => {
    expect(resolvePostHogCookieDomain("app.stackprep.de")).toBe(
      ".stackprep.de",
    );
    expect(resolvePostHogCookieDomain("app.smartnotes.tech")).toBe(
      ".smartnotes.tech",
    );
    expect(resolvePostHogCookieDomain("mvp.vercel.app")).toBeUndefined();
  });
});
