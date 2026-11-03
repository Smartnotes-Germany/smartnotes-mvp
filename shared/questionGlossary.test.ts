import { describe, expect, it } from "vitest";
import { sanitizeGlossary, splitPromptByGlossary } from "./questionGlossary";

const prompt =
  "Ein Server benötigt ein RAID-System mit 4 Festplatten à 4 TB. Berechnen Sie die Nutzkapazität für RAID 5 und RAID 6.";

describe("sanitizeGlossary", () => {
  it("keeps only terms that appear in the prompt", () => {
    expect(
      sanitizeGlossary(prompt, [
        { term: "RAID 5", explanation: "Striping mit verteilter Parität." },
        { term: "RAID 10", explanation: "Stripe über Spiegelpaare." },
      ]),
    ).toEqual([
      { term: "RAID 5", explanation: "Striping mit verteilter Parität." },
    ]);
  });

  it("drops duplicates, empty entries and caps the list at four terms", () => {
    const glossary = sanitizeGlossary(prompt, [
      { term: "RAID 5", explanation: "a" },
      { term: "raid 5", explanation: "b" },
      { term: "RAID 6", explanation: "" },
      { term: "", explanation: "c" },
      { term: "RAID 6", explanation: "d" },
      { term: "Server", explanation: "e" },
      { term: "Festplatten", explanation: "f" },
      { term: "Nutzkapazität", explanation: "g" },
    ]);

    expect(glossary.map((entry) => entry.term)).toEqual([
      "RAID 5",
      "RAID 6",
      "Server",
      "Festplatten",
    ]);
  });

  it("handles a missing glossary", () => {
    expect(sanitizeGlossary(prompt, undefined)).toEqual([]);
  });
});

describe("splitPromptByGlossary", () => {
  it("marks the first occurrence of each term and keeps the text intact", () => {
    const segments = splitPromptByGlossary(prompt, [
      { term: "RAID 6", explanation: "Doppelte Parität." },
      { term: "RAID 5", explanation: "Verteilte Parität." },
    ]);

    expect(segments.map((segment) => segment.text).join("")).toBe(prompt);
    expect(segments.filter((segment) => segment.kind === "term")).toEqual([
      { kind: "term", text: "RAID 5", explanation: "Verteilte Parität." },
      { kind: "term", text: "RAID 6", explanation: "Doppelte Parität." },
    ]);
  });

  it("prefers the longer term when terms overlap", () => {
    const segments = splitPromptByGlossary("Was macht RAID 5?", [
      { term: "RAID", explanation: "Plattenverbund." },
      { term: "RAID 5", explanation: "Verteilte Parität." },
    ]);

    expect(segments).toEqual([
      { kind: "text", text: "Was macht " },
      { kind: "term", text: "RAID 5", explanation: "Verteilte Parität." },
      { kind: "text", text: "?" },
    ]);
  });

  it("returns the plain prompt without a glossary", () => {
    expect(splitPromptByGlossary("Was ist RAID?", undefined)).toEqual([
      { kind: "text", text: "Was ist RAID?" },
    ]);
  });
});
