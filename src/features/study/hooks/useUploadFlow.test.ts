import { describe, expect, it } from "vitest";
import { summarizeTopicSelectionForAnalytics } from "./useUploadFlow";

describe("summarizeTopicSelectionForAnalytics", () => {
  it("normalizes the all-selection path", () => {
    expect(
      summarizeTopicSelectionForAnalytics([" all ", "Genetik", "all"]),
    ).toEqual({
      normalizedTopics: ["all"],
      selectionMode: "all",
      selectedTopicCount: 1,
      selectedTopics: "all",
    });
  });

  it("deduplicates focused topics and preserves order", () => {
    expect(
      summarizeTopicSelectionForAnalytics([
        "Zellbiologie",
        " Genetik ",
        "Zellbiologie",
        "Evolution",
      ]),
    ).toEqual({
      normalizedTopics: ["Zellbiologie", "Genetik", "Evolution"],
      selectionMode: "focused",
      selectedTopicCount: 3,
      selectedTopics: "Zellbiologie, Genetik, Evolution",
    });
  });

  it("limits tracked topic labels to six entries", () => {
    expect(
      summarizeTopicSelectionForAnalytics(["A", "B", "C", "D", "E", "F", "G"]),
    ).toEqual({
      normalizedTopics: ["A", "B", "C", "D", "E", "F", "G"],
      selectionMode: "focused",
      selectedTopicCount: 7,
      selectedTopics: "A, B, C, D, E, F",
    });
  });
});
