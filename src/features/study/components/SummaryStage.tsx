import { BookOpen, ArrowRight, Lightbulb } from "lucide-react";

type SummaryStageProps = {
  summary: string;
  onStartQuiz: () => void;
  isLoading?: boolean;
};

export function SummaryStage({
  summary,
  onStartQuiz,
  isLoading = false,
}: SummaryStageProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-3xl space-y-8 duration-700">
      <div className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold tracking-wider text-blue-600 uppercase dark:bg-blue-900/30 dark:text-blue-400">
          <BookOpen size={14} />
          Lernmaterial bereit
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
          Deine Lernzusammenfassung
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Hier sind die wichtigsten Punkte, die du für dieses Modul wissen
          solltest.
        </p>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm transition-all dark:border-gray-800 dark:bg-gray-900">
        <div className="p-8 md:p-10">
          <div className="prose prose-blue dark:prose-invert max-w-none">
            <div className="mb-6 flex items-start gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/20">
              <Lightbulb className="mt-1 shrink-0 text-amber-500" size={20} />
              <p className="text-sm leading-relaxed font-medium text-amber-800 dark:text-amber-200">
                Tipp: Lies dir diese Zusammenfassung aufmerksam durch. Die
                folgenden Quizfragen basieren direkt auf diesen Inhalten.
              </p>
            </div>

            <div className="text-lg leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {summary}
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-gray-100 pt-8 sm:flex-row dark:border-gray-800">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Bereit, dein Wissen zu testen?
            </div>
            <button
              onClick={onStartQuiz}
              disabled={isLoading}
              className="group flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:translate-y-0 disabled:opacity-50"
            >
              Jetzt Quiz starten
              <ArrowRight
                size={20}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
