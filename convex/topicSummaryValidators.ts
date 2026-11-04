import { v, type Infer } from "convex/values";

/** Hochgeladenes Foto, das zum Thema passt. */
const topicSummaryUploadFigureValidator = v.object({
  kind: v.literal("upload"),
  documentId: v.id("sessionDocuments"),
  caption: v.string(),
});

/**
 * KI-Skizzen werden nicht mehr erzeugt und nicht angezeigt, ältere Sitzungen
 * können sie aber noch enthalten.
 */
const topicSummaryFigureValidator = v.union(
  topicSummaryUploadFigureValidator,
  v.object({
    kind: v.literal("diagram"),
    svg: v.string(),
    caption: v.string(),
  }),
);

/**
 * Grafik zum Thema. Die KI liefert nur die Daten, gezeichnet wird in der App,
 * damit Schrift, Farben und Dark Mode stimmen.
 */
const topicSummaryVisualValidator = v.union(
  v.object({
    kind: v.literal("steps"), // Ablauf, z. B. DHCP-Handshake
    title: v.string(),
    steps: v.array(v.string()),
  }),
  v.object({
    kind: v.literal("comparison"), // Vergleich, z. B. RAID-Level
    title: v.string(),
    columns: v.array(v.string()),
    rows: v.array(v.object({ label: v.string(), values: v.array(v.string()) })),
  }),
  v.object({
    kind: v.literal("parts"), // Aufbau oder Schichten, z. B. OSI-Modell
    title: v.string(),
    parts: v.array(v.object({ label: v.string(), detail: v.string() })),
  }),
);

/** Kurzer Erklärblock mit eigener Mini-Überschrift. */
const topicSummaryBlockValidator = v.object({
  heading: v.string(),
  text: v.string(),
});

const topicSummaryExampleValidator = v.object({
  title: v.string(),
  text: v.string(),
});

const topicSummarySectionValidator = v.object({
  topic: v.string(),
  blocks: v.array(topicSummaryBlockValidator),
  visual: v.optional(topicSummaryVisualValidator),
  figure: v.optional(topicSummaryUploadFigureValidator),
  example: topicSummaryExampleValidator,
});

/** Gespeicherter Abschnitt. `explanation` und `keyPoints` stammen aus älteren Sitzungen. */
const storedTopicSummarySectionValidator = v.object({
  topic: v.string(),
  blocks: v.optional(v.array(topicSummaryBlockValidator)),
  visual: v.optional(topicSummaryVisualValidator),
  figure: v.optional(topicSummaryFigureValidator),
  example: topicSummaryExampleValidator,
  explanation: v.optional(v.string()),
  keyPoints: v.optional(v.array(v.string())),
});

/**
 * Zusammenfassung der ausgewählten Themen, die vor dem Quiz angezeigt wird.
 * Die Sitzung hält immer nur die Zusammenfassung der letzten Themenauswahl.
 */
export const topicSummaryValidator = v.object({
  requestId: v.string(), // Verwirft Ergebnisse älterer Anfragen
  status: v.union(
    v.literal("generating"),
    v.literal("ready"),
    v.literal("failed"),
  ),
  focusTopics: v.array(v.string()),
  dismissed: v.boolean(), // Übersprungen oder gelesen, das Quiz läuft
  intro: v.optional(v.string()), // Nur noch in älteren Sitzungen
  sections: v.optional(v.array(storedTopicSummarySectionValidator)),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const topicSummaryContentValidator = v.object({
  sections: v.array(topicSummarySectionValidator),
});

export type TopicSummaryContent = Infer<typeof topicSummaryContentValidator>;

export type TopicSummaryVisual = Infer<typeof topicSummaryVisualValidator>;

type StoredTopicSummarySection = Infer<
  typeof storedTopicSummarySectionValidator
>;

/** Bringt auch ältere Abschnitte in die aktuelle Form für die App. */
export const toTopicSummarySectionSnapshot = (
  section: StoredTopicSummarySection,
): TopicSummaryContent["sections"][number] => ({
  topic: section.topic,
  blocks:
    section.blocks ??
    (section.explanation
      ? [{ heading: "Kurz erklärt", text: section.explanation }]
      : []),
  ...(section.visual ? { visual: section.visual } : {}),
  ...(section.figure?.kind === "upload" ? { figure: section.figure } : {}),
  example: section.example,
});

export type StoredTopicSummary = Infer<typeof topicSummaryValidator>;
