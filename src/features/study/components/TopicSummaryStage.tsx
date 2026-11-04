import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft, ArrowRight, Lightbulb, Loader2 } from "lucide-react";
import { createDocumentDownloadUrlRef } from "../convexRefs";
import type {
  StudyDocumentId,
  StudySessionId,
  TopicSummary,
  TopicSummarySection,
  TopicSummaryVisual,
} from "../types";

/**
 * Jedes Thema bekommt bis zu drei kurze Seiten: Erklärung, Grafik (nur wenn
 * das Thema eine hat) und Beispiel.
 */
type SummaryPart = "explanation" | "visual" | "example";

type SummaryPage = {
  topicIndex: number;
  part: SummaryPart;
};

const PART_LABELS: Record<SummaryPart, string> = {
  explanation: "Erklärung",
  visual: "Auf einen Blick",
  example: "Beispiel",
};

// Feste Breite, damit „Weiter“ und „Quiz starten“ gleich groß sind und die
// Leiste darunter nicht verrutscht.
const NEXT_BUTTON_CLASS =
  "pill-button relative min-h-12 w-44 justify-center pr-12 pl-6 sm:w-52 sm:pr-14 sm:pl-10";

const hasVisual = (section: TopicSummarySection) =>
  Boolean(section.visual || section.figure);

/**
 * Findet die gemerkte Seite wieder. Fehlt sie (etwa weil sich die Seiten beim
 * Schreiben verschoben haben), geht es zur letzten Seite davor.
 */
const findPageIndex = (pages: SummaryPage[], selected: SummaryPage) => {
  let fallback = 0;
  for (const [index, page] of pages.entries()) {
    if (
      page.topicIndex === selected.topicIndex &&
      page.part === selected.part
    ) {
      return index;
    }
    if (page.topicIndex <= selected.topicIndex) {
      fallback = index;
    }
  }
  return fallback;
};

type TopicSummaryStageProps = {
  sessionId: StudySessionId;
  summary: TopicSummary;
  isGeneratingQuiz: boolean;
  isDismissing: boolean;
  onStartQuiz: () => Promise<void>;
};

export function TopicSummaryStage({
  sessionId,
  summary,
  isGeneratingQuiz,
  isDismissing,
  onStartQuiz,
}: TopicSummaryStageProps) {
  // Gemerkt wird Thema und Teil, nicht die Seitennummer: kommt beim Schreiben
  // eine Grafikseite dazu, bleibt man trotzdem auf derselben Seite.
  const [selectedPage, setSelectedPage] = useState<SummaryPage>({
    topicIndex: 0,
    part: "explanation",
  });
  const [pageDirection, setPageDirection] = useState<"forward" | "back">(
    "forward",
  );
  const topRef = useRef<HTMLDivElement>(null);
  const isGenerating = summary.status === "generating";

  // Beim Schreiben stehen noch nicht alle Themen fest. Ältere Sitzungen
  // speichern hier "all", dann kommt nur das nächste Thema dazu.
  const topicCount = isGenerating
    ? Math.max(
        summary.sections.length + (summary.focusTopics.includes("all") ? 1 : 0),
        summary.focusTopics.includes("all") ? 0 : summary.focusTopics.length,
        1,
      )
    : summary.sections.length;
  const pages: SummaryPage[] = Array.from(
    { length: topicCount },
    (_, topicIndex) => {
      const section = summary.sections[topicIndex];
      const topicPages: SummaryPage[] = [{ topicIndex, part: "explanation" }];
      if (section && hasVisual(section)) {
        topicPages.push({ topicIndex, part: "visual" });
      }
      // Fertige Themen ohne Beispiel brauchen keine Beispielseite.
      if (isGenerating || !section || section.example.text) {
        topicPages.push({ topicIndex, part: "example" });
      }
      return topicPages;
    },
  ).flat();
  const pageCount = pages.length;
  const currentPage = findPageIndex(pages, selectedPage);
  const isLastPage = currentPage === pageCount - 1;

  const goToPage = (nextPage: number) => {
    const target = pages[nextPage];
    if (!target) {
      return;
    }
    setPageDirection(nextPage > currentPage ? "forward" : "back");
    setSelectedPage(target);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startQuizButton = (label: string) => (
    <button
      type="button"
      onClick={() => void onStartQuiz()}
      disabled={isDismissing}
      className={NEXT_BUTTON_CLASS}
    >
      {label}
      <span
        className="pill-button__arrow absolute top-1/2 right-2 -translate-y-1/2"
        aria-hidden="true"
      >
        {isDismissing ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <ArrowRight size={16} />
        )}
      </span>
    </button>
  );

  if (
    summary.status === "failed" ||
    (!isGenerating && summary.sections.length === 0)
  ) {
    return (
      <section className="flex h-full min-h-full flex-col items-center justify-center py-4 text-center">
        <h1 className="text-ink mb-3 text-2xl font-medium tracking-[-0.04em] md:text-4xl">
          Keine Zusammenfassung verfügbar
        </h1>
        <p className="text-ink-secondary mb-10 max-w-xl md:text-lg">
          {summary.error ?? "Die Zusammenfassung konnte nicht erstellt werden."}{" "}
          Du kannst trotzdem direkt mit dem Quiz loslegen.
        </p>
        {startQuizButton("Quiz starten")}
      </section>
    );
  }

  const page = pages[currentPage] ?? { topicIndex: 0, part: "explanation" };
  const section = summary.sections[page.topicIndex];
  // Geschrieben wird immer am letzten Thema, das schon angekommen ist. Die
  // Erklärung ist fertig, sobald das Beispiel beginnt.
  const isWritingTopic =
    isGenerating && page.topicIndex === summary.sections.length - 1;
  const isWritingExplanation = isWritingTopic && !section?.example.title;
  const focusTopic = summary.focusTopics[page.topicIndex];
  const topic =
    section?.topic ?? (focusTopic === "all" ? undefined : focusTopic);

  return (
    <section
      ref={topRef}
      // Die Seiten gleiten seitlich herein, das soll keinen Scrollbalken auslösen.
      className="flex scroll-mt-6 flex-col items-center overflow-x-clip py-4"
    >
      <div className="w-full max-w-3xl">
        {/* Gleicher Fortschrittsbalken wie im Quiz, ein Segment pro Seite. */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-ink min-w-0 truncate text-sm font-medium">
              Zusammenfassung · {PART_LABELS[page.part]}
            </p>
            <p className="text-ink-secondary shrink-0 text-sm tabular-nums">
              Seite{" "}
              <span className="text-ink font-semibold">{currentPage + 1}</span>{" "}
              von {pageCount}
            </p>
          </div>
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-label="Fortschritt"
            aria-valuemin={0}
            aria-valuemax={pageCount}
            aria-valuenow={currentPage + 1}
          >
            {pages.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                  index < currentPage
                    ? "progress-fill"
                    : index === currentPage
                      ? "bg-accent/40"
                      : "bg-ink/15"
                }`}
              />
            ))}
          </div>
        </div>

        <div
          key={`${page.topicIndex}-${page.part}`}
          className={
            pageDirection === "forward"
              ? "animate-step-forward"
              : "animate-step-back"
          }
        >
          <SummaryCard
            topic={topic}
            isWriting={
              page.part === "explanation"
                ? isWritingExplanation
                : isWritingTopic
            }
          >
            {page.part === "explanation" ? (
              section && section.blocks.length > 0 ? (
                <ExplanationBlocks
                  section={section}
                  isWriting={isWritingExplanation}
                />
              ) : (
                <SkeletonLines lines={3} />
              )
            ) : page.part === "visual" && section?.figure ? (
              <SummaryFigure
                sessionId={sessionId}
                documentId={section.figure.documentId}
                caption={section.figure.caption}
              />
            ) : page.part === "visual" && section?.visual ? (
              <VisualGraphic visual={section.visual} />
            ) : section?.example.text ? (
              <ExampleBox example={section.example} />
            ) : (
              <SkeletonLines lines={2} />
            )}
          </SummaryCard>
        </div>

        <nav
          aria-label="Seiten der Zusammenfassung"
          // Drei feste Spalten: Die Buttons bleiben auf jeder Seite an derselben Stelle.
          className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4"
        >
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 0}
            aria-label="Zurück"
            className="text-ink-secondary hover:text-ink flex min-h-12 items-center gap-2 justify-self-start rounded-full px-3 text-sm font-medium transition disabled:invisible sm:px-4"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Zurück</span>
          </button>

          <button
            type="button"
            onClick={() => void onStartQuiz()}
            disabled={isDismissing}
            className="text-ink-secondary hover:text-ink justify-self-center text-sm font-medium underline-offset-4 transition hover:underline disabled:opacity-60"
          >
            Überspringen
          </button>

          <div className="justify-self-end">
            {isLastPage ? (
              startQuizButton("Quiz starten")
            ) : (
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                className={NEXT_BUTTON_CLASS}
              >
                Weiter
                <span
                  className="pill-button__arrow absolute top-1/2 right-2 -translate-y-1/2"
                  aria-hidden="true"
                >
                  <ArrowRight size={16} />
                </span>
              </button>
            )}
          </div>
        </nav>

        {isLastPage && isGeneratingQuiz && (
          <p className="text-ink-muted mt-4 text-right text-sm">
            Deine Fragen werden gerade noch erstellt.
          </p>
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  topic,
  isWriting,
  children,
}: {
  topic?: string;
  isWriting: boolean;
  children: ReactNode;
}) {
  return (
    // Alle Karten gleich hoch wie Lernkarten, damit die Buttons darunter nie
    // springen. Passt ein Inhalt nicht, scrollt er innerhalb der Karte.
    <article
      className="sp-card flex h-[30rem] flex-col p-6 text-left md:p-10"
      aria-busy={isWriting}
    >
      <div className="mb-6 flex shrink-0 items-start justify-between gap-4">
        {topic ? (
          <h2 className="text-ink text-xl font-medium tracking-[-0.03em] md:text-3xl">
            {topic}
          </h2>
        ) : (
          <div className="bg-cream-light h-8 w-1/2 animate-pulse rounded-full" />
        )}
        {isWriting && <WritingIndicator />}
      </div>
      <div className="custom-scrollbar -mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        {children}
      </div>
    </article>
  );
}

function WritingIndicator() {
  return (
    <span className="text-accent inline-flex shrink-0 items-center gap-2 text-xs font-semibold">
      <span className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full" />
      Wird geschrieben …
    </span>
  );
}

function SkeletonLines({ lines }: { lines: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={`bg-cream-light h-4 animate-pulse rounded-full ${
            index === lines - 1 ? "w-2/3" : "w-full"
          }`}
        />
      ))}
    </div>
  );
}

/** Kurze Blöcke mit Mini-Überschrift statt eines Fließtexts. */
function ExplanationBlocks({
  section,
  isWriting,
}: {
  section: TopicSummarySection;
  isWriting: boolean;
}) {
  return (
    <div className="space-y-5">
      {section.blocks.map((block, index) => (
        <div key={index} className="border-accent/40 border-l-2 pl-4">
          {block.heading && (
            <h3 className="text-accent mb-1 text-sm font-semibold">
              {block.heading}
            </h3>
          )}
          <p className="text-ink leading-relaxed md:text-lg">
            {block.text}
            {/* Cursor am Textende, solange der letzte Block noch wächst. */}
            {isWriting && index === section.blocks.length - 1 && (
              <span
                className="bg-accent ml-1 inline-block h-[1.1em] w-0.5 animate-pulse align-[-0.2em]"
                aria-hidden="true"
              />
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

function ExampleBox({ example }: { example: TopicSummarySection["example"] }) {
  return (
    <div className="border-accent/20 bg-action/5 rounded-2xl border p-5 md:p-6">
      <p className="text-accent mb-2 flex items-center gap-2 text-sm font-semibold">
        <Lightbulb size={16} aria-hidden="true" />
        {example.title || "Beispiel"}
      </p>
      <p className="text-ink leading-relaxed whitespace-pre-line md:text-lg">
        {example.text}
      </p>
    </div>
  );
}

/** Zeichnet die Grafik aus den Daten der KI in den Farben der App. */
function VisualGraphic({ visual }: { visual: TopicSummaryVisual }) {
  return (
    <figure>
      <figcaption className="text-ink-secondary mb-4 text-sm font-medium">
        {visual.title}
      </figcaption>

      {visual.kind === "steps" && (
        <ol>
          {visual.steps.map((step, index) => (
            <li key={index} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="bg-action/15 text-accent grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold">
                  {index + 1}
                </span>
                {index < visual.steps.length - 1 && (
                  <span className="bg-accent/30 my-1 w-0.5 flex-1" />
                )}
              </div>
              <p className="text-ink pt-1 pb-5 leading-snug md:text-lg">
                {step}
              </p>
            </li>
          ))}
        </ol>
      )}

      {visual.kind === "comparison" && (
        <div className="border-cream-border overflow-x-auto rounded-2xl border">
          <table className="w-full text-left text-sm md:text-base">
            <thead className="bg-cream-light">
              <tr>
                <th className="px-4 py-3">
                  <span className="sr-only">Bezeichnung</span>
                </th>
                {visual.columns.map((column) => (
                  <th
                    key={column}
                    className="text-ink-secondary px-4 py-3 font-semibold"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visual.rows.map((row) => (
                <tr key={row.label} className="border-cream-border border-t">
                  <th className="text-accent px-4 py-3 font-semibold">
                    {row.label}
                  </th>
                  {row.values.map((value, index) => (
                    <td key={index} className="text-ink px-4 py-3">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visual.kind === "parts" && (
        <div className="space-y-2">
          {visual.parts.map((part, index) => (
            <div
              key={index}
              className="border-cream-border bg-cream-light flex items-center gap-4 rounded-xl border border-l-4 px-4 py-3"
              // Von oben nach unten etwas kräftiger, wie Schichten.
              style={{
                borderLeftColor: `color-mix(in srgb, var(--color-action) ${Math.round(
                  35 + (index * 55) / Math.max(visual.parts.length - 1, 1),
                )}%, transparent)`,
              }}
            >
              <span className="text-ink w-28 shrink-0 font-semibold md:w-36">
                {part.label}
              </span>
              <span className="text-ink-secondary text-sm md:text-base">
                {part.detail}
              </span>
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}

/** Hochgeladenes Bild zum Thema. */
function SummaryFigure({
  sessionId,
  documentId,
  caption,
}: {
  sessionId: StudySessionId;
  documentId: StudyDocumentId;
  caption: string;
}) {
  const createDocumentDownloadUrl = useMutation(createDocumentDownloadUrlRef);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    // Der Link gilt nur einmal und kurz, deshalb wird er erst hier geholt.
    createDocumentDownloadUrl({ sessionId, documentId })
      .then(({ downloadUrl }) => {
        if (!isCancelled) {
          setImageUrl(downloadUrl);
        }
      })
      .catch((error: unknown) => {
        console.error("Bild konnte nicht geladen werden:", error);
      });

    return () => {
      isCancelled = true;
    };
  }, [createDocumentDownloadUrl, documentId, sessionId]);

  if (!imageUrl) {
    return <SkeletonLines lines={3} />;
  }

  return (
    <figure>
      <div className="border-cream-border overflow-hidden rounded-2xl border bg-white">
        <img
          src={imageUrl}
          alt={caption}
          className="mx-auto max-h-80 w-full object-contain"
        />
      </div>
      <figcaption className="text-ink-muted mt-2 text-center text-sm">
        {caption}
      </figcaption>
    </figure>
  );
}
