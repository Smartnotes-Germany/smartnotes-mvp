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
    <div className="mx-auto max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-wider uppercase">
          <BookOpen size={14} />
          Lernmaterial bereit
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl text-gray-900 dark:text-white">
          Deine Lernzusammenfassung
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Hier sind die wichtigsten Punkte, die du für dieses Modul wissen solltest.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-all">
        <div className="p-8 md:p-10">
          <div className="prose prose-blue dark:prose-invert max-w-none">
            <div className="flex items-start gap-4 mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
              <Lightbulb className="text-amber-500 mt-1 shrink-0" size={20} />
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium leading-relaxed">
                Tipp: Lies dir diese Zusammenfassung aufmerksam durch. Die folgenden Quizfragen basieren direkt auf diesen Inhalten.
              </p>
            </div>
            
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
              {summary}
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Bereit, dein Wissen zu testen?
            </div>
            <button
              onClick={onStartQuiz}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 flex items-center gap-2 group disabled:opacity-50 disabled:translate-y-0"
            >
              Jetzt Quiz starten
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
