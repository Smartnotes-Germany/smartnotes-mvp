import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  BookOpen,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Lightbulb,
} from 'lucide-react';

// --- Types ---
interface Question {
  id: number;
  topic: string;
  question: string;
  answer: string;
  simpleExplanation: string;
  sourceNote: string;
}

const MOCK_QUESTIONS: Question[] = [
  {
    id: 1,
    topic: 'Biologie',
    question: 'Warum ist die Meiose f\u00fcr die genetische Vielfalt so wichtig?',
    answer:
      'Durch die Rekombination (Crossing-over) in der Prophase I und die zuf\u00e4llige Verteilung der Chromosomen entstehen Keimzellen mit einzigartigen Genkombinationen.',
    simpleExplanation:
      'Stell dir vor, du mischst zwei Kartenspiele komplett neu durch. Die Meiose sorgt daf\u00fcr, dass kein Kind exakt die gleiche Mischung wie seine Geschwister bekommt, weil die Gene der Eltern jedes Mal neu kombiniert werden.',
    sourceNote: 'Meiose f\u00fchrt zur Variabilit\u00e4t. Wichtig: Crossing-over findet in der ersten Reifeteilung statt.',
  },
  {
    id: 2,
    topic: 'Physik',
    question: 'Was besagt der Energieerhaltungssatz?',
    answer:
      'In einem abgeschlossenen System ist die Gesamtenergie konstant. Energie kann weder erzeugt noch vernichtet, sondern nur in andere Formen umgewandelt werden.',
    simpleExplanation:
      'Energie verschwindet nie. Wenn du einen Ball wirfst, wird deine Muskelkraft in Bewegung (kinetische Energie) umgewandelt. Wenn er liegen bleibt, wurde die Bewegung in W\u00e4rme (Reibung) umgewandelt. Die Summe bleibt gleich.',
    sourceNote: 'Energieerhaltung: E_ges = E_pot + E_kin + ... = const.',
  },
];

export const StudyCoach = () => {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'question' | 'answer' | 'explain'>('question');
  const [showNote, setShowNote] = useState(false);

  const current = MOCK_QUESTIONS[index];

  const handleNext = () => {
    setMode('question');
    setShowNote(false);
    setIndex((prev) => (prev + 1) % MOCK_QUESTIONS.length);
  };

  return (
    <div className="h-full bg-void flex flex-col items-center justify-center font-sans relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-gold/[0.02] rounded-full blur-[180px]" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-gold/[0.02] to-transparent" />
      </div>

      {/* Top Navigation / Progress */}
      <div className="absolute top-0 w-full p-8 flex justify-between items-center z-20">
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">Smart Training</span>
          <div className="flex gap-1.5">
            {MOCK_QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i === index ? 'w-8 bg-gold' : 'w-4 bg-border-subtle'
                }`}
              />
            ))}
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="text-text-ghost hover:text-text-muted transition-colors"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <main className="w-full max-w-2xl px-6 flex flex-col items-center relative z-10">
        {/* Topic Badge */}
        <motion.span
          key={current.topic}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-semibold text-gold bg-gold/10 border border-gold/20 px-4 py-1.5 rounded-full mb-10 uppercase tracking-widest"
        >
          {current.topic}
        </motion.span>

        {/* The Question Area */}
        <div className="w-full text-center space-y-12">
          <motion.h2
            key={current.question}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl font-serif text-text-primary leading-tight"
          >
            {current.question}
          </motion.h2>

          <div className="line-gold w-16 mx-auto opacity-30" />

          {/* Dynamic Content Area */}
          <div className="min-h-[200px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {mode === 'question' ? (
                <motion.button
                  key="check-btn"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setMode('answer')}
                  className="group flex flex-col items-center gap-5 outline-none"
                >
                  <div className="w-16 h-16 rounded-full bg-gold text-void flex items-center justify-center group-hover:scale-110 transition-transform glow-gold-strong">
                    <ArrowRight size={24} />
                  </div>
                  <span className="text-xs font-semibold text-text-ghost uppercase tracking-widest group-hover:text-text-muted transition-colors">
                    Antwort pr\u00fcfen
                  </span>
                </motion.button>
              ) : (
                <motion.div
                  key="answer-content"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full space-y-8"
                >
                  <div className="text-xl text-text-secondary leading-relaxed max-w-xl mx-auto">
                    {mode === 'explain' ? (
                      <div className="bg-amber/[0.06] p-8 rounded-2xl border border-amber/15 relative text-left">
                        <div className="absolute -top-3 -left-3 w-8 h-8 bg-amber rounded-lg flex items-center justify-center text-void shadow-lg">
                          <Lightbulb size={18} />
                        </div>
                        <span className="block text-[10px] font-bold text-amber uppercase mb-4 tracking-widest">
                          Einfache Erkl\u00e4rung
                        </span>
                        <p className="font-serif italic text-text-secondary">{current.simpleExplanation}</p>
                      </div>
                    ) : (
                      <p className="font-serif italic text-text-secondary">"{current.answer}"</p>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={handleNext}
                      className="px-6 py-3 bg-gold text-void rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-gold-light transition-all glow-gold"
                    >
                      <Check size={16} /> Verstanden
                    </button>

                    {mode !== 'explain' && (
                      <button
                        onClick={() => setMode('explain')}
                        className="px-6 py-3 bg-surface border border-border-visible text-text-secondary rounded-xl text-xs font-semibold flex items-center gap-2 hover:border-gold/30 hover:text-gold transition-all"
                      >
                        <Sparkles size={16} /> Erkl\u00e4r es mir einfach
                      </button>
                    )}

                    <button
                      onClick={() => setShowNote(!showNote)}
                      className="px-6 py-3 bg-elevated text-text-muted rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-raised hover:text-text-secondary transition-all"
                    >
                      <BookOpen size={16} /> {showNote ? 'Notiz ausblenden' : 'In meine Notizen schauen'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Slide-up Note Panel */}
      <AnimatePresence>
        {showNote && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="absolute bottom-0 w-full max-w-xl bg-surface border-t border-border-visible rounded-t-[32px] shadow-2xl shadow-black/40 z-30 p-10 pb-16"
          >
            <div className="w-12 h-1.5 bg-border-visible rounded-full mx-auto mb-8" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gold/10 text-gold rounded-lg flex items-center justify-center">
                <BookOpen size={16} />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted">Kontext aus deiner Mitschrift</h4>
            </div>
            <p className="text-lg text-text-secondary leading-relaxed font-serif italic">"{current.sourceNote}"</p>
            <button
              onClick={() => setShowNote(false)}
              className="mt-8 w-full py-4 text-text-ghost text-xs font-semibold hover:text-text-muted transition-colors"
            >
              Schlie\u00dfen
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
