/**
 * Fachbegriffe in Quizfragen, die beim Überfahren mit der Maus erklärt werden.
 * Die KI liefert die Begriffe mit; hier werden sie bereinigt und im Fragetext
 * gefunden.
 */

export type GlossaryTerm = {
  term: string;
  explanation: string;
};

type PromptSegment =
  | { kind: "text"; text: string }
  | { kind: "term"; text: string; explanation: string };

export const MAX_GLOSSARY_TERMS = 4;
const MAX_TERM_LENGTH = 60;
const MAX_EXPLANATION_LENGTH = 280;

const findTermRange = (prompt: string, term: string) => {
  const index = prompt
    .toLocaleLowerCase("de")
    .indexOf(term.toLocaleLowerCase("de"));
  return index === -1 ? null : { start: index, end: index + term.length };
};

/**
 * Behält nur Begriffe, die wirklich im Fragetext vorkommen, entfernt Duplikate
 * und begrenzt Anzahl und Länge.
 */
export const sanitizeGlossary = (
  prompt: string,
  glossary: ReadonlyArray<Partial<GlossaryTerm>> | undefined,
): GlossaryTerm[] => {
  const seenTerms = new Set<string>();
  const result: GlossaryTerm[] = [];

  for (const entry of glossary ?? []) {
    const term = entry.term?.trim() ?? "";
    const explanation = entry.explanation?.trim() ?? "";
    const key = term.toLocaleLowerCase("de");

    if (
      !term ||
      !explanation ||
      term.length > MAX_TERM_LENGTH ||
      seenTerms.has(key) ||
      !findTermRange(prompt, term)
    ) {
      continue;
    }

    seenTerms.add(key);
    result.push({
      term,
      explanation: explanation.slice(0, MAX_EXPLANATION_LENGTH),
    });

    if (result.length >= MAX_GLOSSARY_TERMS) {
      break;
    }
  }

  return result;
};

/**
 * Zerlegt den Fragetext in normale Textstücke und erklärbare Begriffe.
 * Jeder Begriff wird beim ersten Vorkommen markiert; längere Begriffe gewinnen
 * bei Überschneidungen (z. B. „RAID 5“ vor „RAID“).
 */
export const splitPromptByGlossary = (
  prompt: string,
  glossary: ReadonlyArray<GlossaryTerm> | undefined,
): PromptSegment[] => {
  const ranges: Array<{ start: number; end: number; explanation: string }> = [];
  const termsByLength = [...(glossary ?? [])].sort(
    (left, right) => right.term.length - left.term.length,
  );

  for (const { term, explanation } of termsByLength) {
    const range = findTermRange(prompt, term);
    if (
      range &&
      !ranges.some(
        (existing) => range.start < existing.end && existing.start < range.end,
      )
    ) {
      ranges.push({ ...range, explanation });
    }
  }

  ranges.sort((left, right) => left.start - right.start);

  const segments: PromptSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ kind: "text", text: prompt.slice(cursor, range.start) });
    }
    segments.push({
      kind: "term",
      text: prompt.slice(range.start, range.end),
      explanation: range.explanation,
    });
    cursor = range.end;
  }
  if (cursor < prompt.length) {
    segments.push({ kind: "text", text: prompt.slice(cursor) });
  }

  return segments;
};
