import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock("./posthogClient", () => ({
  isPostHogEnabled: () => true,
  posthogClient: {
    capture: captureMock,
  },
}));

import {
  trackFocusedQuizGenerationRequested,
  trackFocusedQuizGenerationSucceeded,
  trackStudyStageViewed,
  trackTopicSelectionPreparationFailed,
} from "./events";

describe("study analytics event contract", () => {
  beforeEach(() => {
    captureMock.mockReset();
  });

  it("tracks mode_selection as its own viewed stage", () => {
    trackStudyStageViewed("mode_selection", {
      documents: 3,
      readyDocuments: 2,
      answeredQuestions: 0,
      totalQuestions: 0,
    });

    expect(captureMock).toHaveBeenCalledWith("study_stage_viewed", {
      stage: "mode_selection",
      status: "viewed",
      documents: 3,
      readyDocuments: 2,
      answeredQuestions: 0,
      totalQuestions: 0,
    });
  });

  it("tracks topic selection preparation failures with upload-stage timing", () => {
    trackTopicSelectionPreparationFailed(1_500, {
      documents: 4,
      readyDocuments: 3,
    });

    expect(captureMock).toHaveBeenCalledWith(
      "topic_selection_preparation_failed",
      {
        stage: "upload",
        status: "failed",
        documents: 4,
        readyDocuments: 3,
        durationMs: 1_500,
        durationBucket: "1s_to_3s",
      },
    );
  });

  it("tracks focused quiz generation with selected topics and output counts", () => {
    trackFocusedQuizGenerationRequested({
      documents: 2,
      readyDocuments: 2,
      selectionMode: "focused",
      selectedTopicCount: 3,
      selectedTopics: "Zellbiologie, Genetik, Evolution",
      questionsPerTopic: 5,
    });
    trackFocusedQuizGenerationSucceeded(12_000, {
      documents: 2,
      readyDocuments: 2,
      selectionMode: "focused",
      selectedTopicCount: 3,
      selectedTopics: "Zellbiologie, Genetik, Evolution",
      questionsPerTopic: 5,
      outputQuestionCount: 15,
    });

    expect(captureMock).toHaveBeenNthCalledWith(
      1,
      "focused_quiz_generation_requested",
      {
        stage: "mode_selection",
        status: "requested",
        documents: 2,
        readyDocuments: 2,
        selectionMode: "focused",
        selectedTopicCount: 3,
        selectedTopics: "Zellbiologie, Genetik, Evolution",
        questionsPerTopic: 5,
      },
    );
    expect(captureMock).toHaveBeenNthCalledWith(
      2,
      "focused_quiz_generation_succeeded",
      {
        stage: "mode_selection",
        status: "succeeded",
        documents: 2,
        readyDocuments: 2,
        selectionMode: "focused",
        selectedTopicCount: 3,
        selectedTopics: "Zellbiologie, Genetik, Evolution",
        questionsPerTopic: 5,
        outputQuestionCount: 15,
        durationMs: 12_000,
        durationBucket: "10s_to_30s",
      },
    );
  });
});
