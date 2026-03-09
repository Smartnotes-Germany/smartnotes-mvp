import {
  ArrowLeft,
  BookOpenText,
  Clock3,
  Lightbulb,
  ListTree,
  Loader2,
  Sparkles,
  Table2,
} from "lucide-react";
import type {
  StudyPdfSummary,
  SummaryComparisonTable,
  SummaryDefinition,
  SummarySubtopic,
  SummaryTimelineEvent,
} from "../types";

type NormalizedSection = {
  title: string;
  summary: string;
  definitions: SummaryDefinition[];
  subtopics: SummarySubtopic[];
  comparisonTables: SummaryComparisonTable[];
  legacyPoints: string[];
};

type NormalizedSummary = {
  title: string;
  overview: string;
  themeOverview: string[];
  timeline: SummaryTimelineEvent[];
  keyTakeaways: string[];
  sections: NormalizedSection[];
};

const normalizeText = (value?: string | null) => value?.trim() ?? "";

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();

  return values
    .map((value) => normalizeText(value))
    .filter((value) => {
      if (!value) {
        return false;
      }

      const key = value.toLocaleLowerCase("de-DE");
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
};

const splitLegacyContent = (value?: string) =>
  uniqueStrings(
    (value ?? "")
      .split("\n")
      .map((entry) => normalizeText(entry))
      .filter(Boolean),
  );

const normalizeSummary = (data: StudyPdfSummary): NormalizedSummary => {
  const sections = data.sections.map((section) => {
    const legacyPoints = uniqueStrings([
      ...splitLegacyContent(section.content),
      ...(section.keyPoints ?? []),
    ]);

    return {
      title: normalizeText(section.title),
      summary:
        normalizeText(section.summary) ||
        legacyPoints[0] ||
        "Dieser Abschnitt bündelt die wichtigsten Inhalte des Themas.",
      definitions: (section.definitions ?? []).filter(
        (definition) =>
          normalizeText(definition.term) &&
          normalizeText(definition.definition),
      ),
      subtopics: (section.subtopics ?? []).filter(
        (subtopic) =>
          normalizeText(subtopic.title) &&
          normalizeText(subtopic.description) &&
          ((subtopic.keyPoints?.length ?? 0) > 0 ||
            (subtopic.examples?.length ?? 0) > 0),
      ),
      comparisonTables: (
        section.comparisonTables ?? (section.table ? [section.table] : [])
      ).filter(
        (table) =>
          normalizeText(table.title) &&
          table.headers.length > 1 &&
          table.rows.length > 0,
      ),
      legacyPoints,
    } satisfies NormalizedSection;
  });

  const themeOverview = uniqueStrings(
    data.themeOverview && data.themeOverview.length > 0
      ? data.themeOverview
      : sections.map((section) => section.title),
  );

  const keyTakeaways = uniqueStrings(
    data.keyTakeaways && data.keyTakeaways.length > 0
      ? data.keyTakeaways
      : sections
          .flatMap((section) => section.legacyPoints.slice(0, 1))
          .slice(0, 6),
  );

  return {
    title: normalizeText(data.title) || "Lernübersicht",
    overview:
      normalizeText(data.overview) ||
      "Die Lernübersicht ordnet die wichtigsten Inhalte deiner Unterlagen in klaren Themenblöcken.",
    themeOverview,
    timeline: (data.timeline ?? []).filter(
      (event) =>
        normalizeText(event.label) &&
        normalizeText(event.period) &&
        normalizeText(event.description),
    ),
    keyTakeaways,
    sections,
  };
};

type PdfSummaryStageProps = {
  data: StudyPdfSummary | undefined;
  onBack: () => Promise<void> | void;
  onContinueToQuiz: () => Promise<void> | void;
  isStartingQuiz?: boolean;
  quizError?: string | null;
};

export function PdfSummaryStage({
  data,
  onBack,
  onContinueToQuiz,
  isStartingQuiz = false,
  quizError,
}: PdfSummaryStageProps) {
  if (!data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div className="relative">
          <div className="border-accent/10 border-t-accent h-20 w-20 animate-spin rounded-full border-4" />
          <Sparkles
            className="text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            size={30}
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-ink text-2xl font-black tracking-tight">
            Lernübersicht wird erstellt
          </h2>
          <p className="text-ink-secondary max-w-md text-sm leading-relaxed">
            Deine Unterlagen werden in Themen, Definitionen, Beispielen und
            relevanten Vergleichen aufbereitet.
          </p>
        </div>
      </div>
    );
  }

  const summary = normalizeSummary(data);

  return (
    <div className="animate-in fade-in space-y-6 duration-500">
      <section className="bg-surface-white border-cream-border overflow-hidden rounded-[2rem] border shadow-sm">
        <div className="border-cream-border flex flex-col gap-5 border-b px-5 py-5 md:px-8 md:py-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => void onBack()}
                className="text-ink-secondary hover:text-ink inline-flex items-center gap-2 rounded-full border border-transparent px-1 py-1 text-xs font-bold tracking-[0.12em] uppercase transition"
              >
                <ArrowLeft size={14} />
                Zurück zur Auswahl
              </button>

              <div className="space-y-3">
                <div className="bg-accent/10 text-accent inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] uppercase">
                  <BookOpenText size={14} />
                  Lernübersicht
                </div>
                <div>
                  <h1 className="text-ink text-3xl font-black tracking-tight md:text-4xl">
                    {summary.title}
                  </h1>
                  <p className="text-ink-secondary mt-3 max-w-3xl text-sm leading-relaxed md:text-base">
                    {summary.overview}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 lg:min-w-[250px]">
              {quizError ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                  {quizError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void onContinueToQuiz()}
                disabled={isStartingQuiz}
                className="bg-accent shadow-accent/20 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:opacity-90 active:scale-95 disabled:translate-y-0 disabled:opacity-60"
              >
                {isStartingQuiz ? (
                  <>
                    Quiz wird vorbereitet{" "}
                    <Loader2 size={16} className="animate-spin" />
                  </>
                ) : (
                  <>
                    Wissen testen <Sparkles size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-5 py-5 md:px-8 md:py-7 xl:grid-cols-[1.8fr_1fr]">
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50/80 p-5 dark:border-sky-900 dark:bg-sky-950/20">
              <div className="mb-3 flex items-center gap-2 text-sky-700 dark:text-sky-300">
                <ListTree size={16} />
                <p className="text-xs font-bold tracking-[0.14em] uppercase">
                  Themenübersicht
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {summary.themeOverview.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-sky-900 shadow-sm dark:bg-slate-900 dark:text-sky-100"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            {summary.timeline.length > 0 ? (
              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900 dark:bg-amber-950/20">
                <div className="mb-4 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <Clock3 size={16} />
                  <p className="text-xs font-bold tracking-[0.14em] uppercase">
                    Zeitliche Einordnung
                  </p>
                </div>
                <div className="space-y-4">
                  {summary.timeline.map((event, index) => (
                    <div key={`${event.label}-${index}`} className="flex gap-4">
                      <div className="flex w-32 shrink-0 flex-col items-center">
                        <span className="rounded-full bg-white px-3 py-1 text-center text-xs font-bold text-amber-800 dark:bg-slate-900 dark:text-amber-200">
                          {event.label}
                        </span>
                        {index < summary.timeline.length - 1 ? (
                          <div className="mt-2 h-full w-px bg-amber-300 dark:bg-amber-800" />
                        ) : null}
                      </div>
                      <div className="min-w-0 pb-2">
                        <p className="text-ink text-sm font-bold">
                          {event.period}
                        </p>
                        <p className="text-ink-secondary mt-1 text-sm leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Lightbulb size={16} />
                <p className="text-xs font-bold tracking-[0.14em] uppercase">
                  Merksätze
                </p>
              </div>
              <div className="space-y-3">
                {summary.keyTakeaways.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-emerald-950 shadow-sm dark:bg-slate-900 dark:text-emerald-100"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="space-y-5">
        {summary.sections.map((section, sectionIndex) => (
          <section
            key={`${section.title}-${sectionIndex}`}
            className="bg-surface-white border-cream-border rounded-[2rem] border p-5 shadow-sm md:p-8"
          >
            <div className="mb-6 space-y-3">
              <p className="text-accent text-[10px] font-bold tracking-[0.16em] uppercase">
                Themenblock
              </p>
              <div>
                <h2 className="text-ink text-2xl font-black tracking-tight md:text-3xl">
                  {section.title}
                </h2>
                <p className="text-ink-secondary mt-3 text-sm leading-relaxed md:text-base">
                  {section.summary}
                </p>
              </div>
            </div>

            {section.definitions.length > 0 ? (
              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300">
                  <BookOpenText size={16} />
                  Begriffsdefinitionen
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {section.definitions.map((definition, definitionIndex) => (
                    <article
                      key={`${section.title}-${definition.term}-${definitionIndex}`}
                      className="rounded-[1.35rem] border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/20"
                    >
                      <h3 className="text-ink text-sm font-bold">
                        {definition.term}
                      </h3>
                      <p className="text-ink-secondary mt-2 text-sm leading-relaxed">
                        {definition.definition}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {section.subtopics.map((subtopic, subtopicIndex) => (
                <article
                  key={`${section.title}-${subtopic.title}-${subtopicIndex}`}
                  className="rounded-[1.5rem] border border-stone-200 bg-stone-50/60 p-4 md:p-5 dark:border-stone-800 dark:bg-stone-900/20"
                >
                  <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-ink text-lg font-black tracking-tight">
                          {subtopic.title}
                        </h3>
                        <p className="text-ink-secondary mt-2 text-sm leading-relaxed md:text-base">
                          {subtopic.description}
                        </p>
                      </div>

                      {subtopic.keyPoints.length > 0 ? (
                        <div>
                          <p className="text-ink-muted text-[10px] font-bold tracking-[0.16em] uppercase">
                            Relevante Inhalte
                          </p>
                          <div className="mt-3 grid gap-2">
                            {subtopic.keyPoints.map((point, pointIndex) => (
                              <div
                                key={`${subtopic.title}-${pointIndex}`}
                                className="flex gap-3 rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-stone-800 shadow-sm dark:bg-slate-900 dark:text-stone-100"
                              >
                                <span className="text-accent mt-0.5 font-black">
                                  •
                                </span>
                                <span>{point}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {subtopic.examples.length > 0 ? (
                      <div>
                        <p className="text-ink-muted text-[10px] font-bold tracking-[0.16em] uppercase">
                          Beispiele
                        </p>
                        <div className="mt-3 space-y-3">
                          {subtopic.examples.map((example, exampleIndex) => (
                            <article
                              key={`${subtopic.title}-${example.title}-${exampleIndex}`}
                              className="rounded-[1.2rem] border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/20"
                            >
                              <h4 className="text-ink text-sm font-bold">
                                {example.title}
                              </h4>
                              <p className="text-ink-secondary mt-2 text-sm leading-relaxed">
                                {example.details}
                              </p>
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {section.comparisonTables.length > 0 ? (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-violet-700 dark:text-violet-300">
                  <Table2 size={16} />
                  Vergleiche
                </div>
                {section.comparisonTables.map((table, tableIndex) => (
                  <div
                    key={`${section.title}-${table.title}-${tableIndex}`}
                    className="rounded-[1.5rem] border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/20"
                  >
                    <h3 className="text-ink mb-3 text-sm font-bold md:text-base">
                      {table.title}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                        <thead>
                          <tr>
                            {table.headers.map((header) => (
                              <th
                                key={`${table.title}-${header}`}
                                className="border-b border-violet-200 px-3 py-2 font-bold text-violet-900 dark:border-violet-900 dark:text-violet-100"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, index) => (
                            <tr key={`${table.title}-${index}`}>
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`${table.title}-${index}-${cellIndex}`}
                                  className="border-b border-violet-100 px-3 py-2 align-top text-stone-700 dark:border-violet-950 dark:text-stone-200"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {section.subtopics.length === 0 &&
            section.legacyPoints.length > 0 ? (
              <div className="mt-6">
                <p className="text-ink-muted text-[10px] font-bold tracking-[0.16em] uppercase">
                  Kernpunkte
                </p>
                <div className="mt-3 grid gap-2">
                  {section.legacyPoints.map((point) => (
                    <div
                      key={`${section.title}-${point}`}
                      className="flex gap-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-800 dark:bg-stone-900/30 dark:text-stone-100"
                    >
                      <span className="text-accent mt-0.5 font-black">•</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
