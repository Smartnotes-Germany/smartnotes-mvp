import { useId, useState, type FocusEvent, type PointerEvent } from "react";
import {
  splitPromptByGlossary,
  type GlossaryTerm,
} from "../../../../shared/questionGlossary";

type QuestionPromptProps = {
  prompt: string;
  glossary?: GlossaryTerm[];
};

type TooltipAlign = "start" | "center" | "end";

// Halbe Tooltip-Breite plus Rand: näher am Bildschirmrand wird bündig ausgerichtet.
const EDGE_DISTANCE_PX = 150;

const tooltipAlignClasses: Record<TooltipAlign, string> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

type ExplainedTermProps = {
  text: string;
  explanation: string;
};

function ExplainedTerm({ text, explanation }: ExplainedTermProps) {
  const tooltipId = useId();
  const [align, setAlign] = useState<TooltipAlign>("center");

  const updateAlign = (
    event: PointerEvent<HTMLSpanElement> | FocusEvent<HTMLSpanElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    setAlign(
      center < EDGE_DISTANCE_PX
        ? "start"
        : window.innerWidth - center < EDGE_DISTANCE_PX
          ? "end"
          : "center",
    );
  };

  return (
    <span
      className="group relative"
      onPointerEnter={updateAlign}
      onFocus={updateAlign}
    >
      <span
        tabIndex={0}
        aria-describedby={tooltipId}
        className="text-accent decoration-accent/50 focus-visible:ring-accent/40 cursor-help rounded-sm underline decoration-dotted decoration-2 underline-offset-4 outline-none focus-visible:ring-2"
      >
        {text}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className={`bg-ink text-cream pointer-events-none invisible absolute bottom-full z-20 mb-2 w-max max-w-[min(18rem,80vw)] rounded-xl px-3.5 py-2.5 text-left text-sm leading-snug font-normal tracking-normal whitespace-normal opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${tooltipAlignClasses[align]}`}
      >
        <span className="mb-0.5 block font-semibold">{text}</span>
        {explanation}
      </span>
    </span>
  );
}

/** Fragetext, in dem Fachbegriffe beim Überfahren oder Antippen erklärt werden. */
export function QuestionPrompt({ prompt, glossary }: QuestionPromptProps) {
  return (
    <>
      {splitPromptByGlossary(prompt, glossary).map((segment, index) =>
        segment.kind === "term" ? (
          <ExplainedTerm
            key={index}
            text={segment.text}
            explanation={segment.explanation}
          />
        ) : (
          segment.text
        ),
      )}
    </>
  );
}
