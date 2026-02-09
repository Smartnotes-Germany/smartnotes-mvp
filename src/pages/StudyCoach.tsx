import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  BookOpen, 
  ArrowRight, 
  Sparkles, 
  RotateCcw,
  Lightbulb
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
    topic: "Biologie",
    question: "Warum ist die Meiose für die genetische Vielfalt so wichtig?",
    answer: "Durch die Rekombination (Crossing-over) in der Prophase I und die zufällige Verteilung der Chromosomen entstehen Keimzellen mit einzigartigen Genkombinationen.",
    simpleExplanation: "Stell dir vor, du mischst zwei Kartenspiele komplett neu durch. Die Meiose sorgt dafür, dass kein Kind exakt die gleiche Mischung wie seine Geschwister bekommt, weil die Gene der Eltern jedes Mal neu kombiniert werden.",
    sourceNote: "Meiose führt zur Variabilität. Wichtig: Crossing-over findet in der ersten Reifeteilung statt."
  },
  {
    id: 2,
    topic: "Physik",
    question: "Was besagt der Energieerhaltungssatz?",
    answer: "In einem abgeschlossenen System ist die Gesamtenergie konstant. Energie kann weder erzeugt noch vernichtet, sondern nur in andere Formen umgewandelt werden.",
    simpleExplanation: "Energie verschwindet nie. Wenn du einen Ball wirfst, wird deine Muskelkraft in Bewegung (kinetische Energie) umgewandelt. Wenn er liegen bleibt, wurde die Bewegung in Wärme (Reibung) umgewandelt. Die Summe bleibt gleich.",
    sourceNote: "Energieerhaltung: E_ges = E_pot + E_kin + ... = const."
  }
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
    <div className="h-full bg-cream flex flex-col items-center justify-center font-sans relative">
      
      {/* Top Navigation / Progress */}
      <div className="absolute top-0 w-full px-10 py-7 flex justify-between items-center">
        <div className="flex items-center gap-7">
          <span className="section-label">Smart Training</span>
          <div className="flex gap-1.5">
            {MOCK_QUESTIONS.map((_, i) => (
              <div key={i} className={`h-[3px] w-7 rounded-full transition-all duration-500 ${i === index ? 'bg-accent' : 'bg-cream-dark'}`} />
            ))}
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="text-ink-muted hover:text-ink transition-colors">
          <RotateCcw size={16} />
        </button>
      </div>

      <main className="w-full max-w-2xl px-8 flex flex-col items-center">
        
        {/* Topic Badge */}
        <motion.span 
          key={current.topic}
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="section-label mb-10"
        >
          {current.topic}
        </motion.span>

        {/* The Question Area */}
        <div className="w-full text-center space-y-12">
          <motion.h2 
            key={current.question}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="editorial-heading text-[2.75rem] md:text-[3.25rem] leading-[1.12] italic"
          >
            {current.question}
          </motion.h2>

          <div className="h-px w-20 bg-cream-border mx-auto" />

          {/* Dynamic Content Area */}
          <div className="min-h-[200px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {mode === 'question' ? (
                <motion.button
                  key="check-btn"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setMode('answer')}
                  className="group flex flex-col items-center gap-5 outline-none"
                >
                  <div className="w-14 h-14 rounded-full bg-ink text-cream flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ArrowRight size={20} />
                  </div>
                  <span className="text-[0.6875rem] font-semibold text-ink-muted uppercase tracking-[0.2em] group-hover:text-ink transition-colors">Antwort prüfen</span>
                </motion.button>
              ) : (
                <motion.div 
                  key="answer-content"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full space-y-10"
                >
                  <div className="text-[1.1875rem] text-ink-secondary leading-[1.8] max-w-xl mx-auto font-serif">
                    {mode === 'explain' ? (
                      <div className="bg-surface-white p-8 border border-cream-border rounded-sm relative">
                        <div className="absolute -top-3 -left-3 w-7 h-7 bg-accent rounded-sm flex items-center justify-center text-cream">
                          <Lightbulb size={14} />
                        </div>
                        <span className="section-label text-[0.5625rem] block mb-5">Einfache Erklärung</span>
                        <p className="italic">{current.simpleExplanation}</p>
                      </div>
                    ) : (
                      <p className="italic">"{current.answer}"</p>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <button 
                      onClick={handleNext}
                      className="px-7 py-3 bg-ink text-cream rounded-sm text-[0.75rem] font-semibold flex items-center gap-2 hover:bg-ink/90 transition-all tracking-wide"
                    >
                      <Check size={14} /> Verstanden
                    </button>
                    
                    {mode !== 'explain' && (
                      <button 
                        onClick={() => setMode('explain')}
                        className="px-7 py-3 bg-surface-white border border-cream-border text-ink-secondary rounded-sm text-[0.75rem] font-semibold flex items-center gap-2 hover:border-accent hover:text-accent transition-all"
                      >
                         <Sparkles size={14} /> Erklär es mir einfach
                      </button>
                    )}

                    <button 
                      onClick={() => setShowNote(!showNote)}
                      className="px-7 py-3 bg-cream-dark/30 text-ink-muted rounded-sm text-[0.75rem] font-semibold flex items-center gap-2 hover:bg-cream-dark/50 hover:text-ink-secondary transition-all"
                    >
                      <BookOpen size={14} /> {showNote ? 'Notiz ausblenden' : 'In meine Notizen schauen'}
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
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-0 w-full max-w-xl left-1/2 -translate-x-1/2 bg-surface-white border border-cream-border border-b-0 rounded-t-sm z-30 p-10 pb-14"
          >
            <div className="w-10 h-[2px] bg-cream-dark rounded-full mx-auto mb-8" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-7 h-7 bg-cream-dark/30 text-accent rounded-sm flex items-center justify-center">
                <BookOpen size={14} />
              </div>
              <h4 className="section-label text-[0.5625rem]">Kontext aus deiner Mitschrift</h4>
            </div>
            <p className="text-[1.0625rem] text-ink-secondary leading-[1.8] font-serif italic">
              "{current.sourceNote}"
            </p>
            <button 
              onClick={() => setShowNote(false)}
              className="mt-8 w-full py-3 text-ink-muted text-[0.75rem] font-semibold hover:text-ink transition-colors tracking-wider uppercase"
            >
              Schließen
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decor -- subtle warm radial */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cream-dark/30 rounded-full blur-[150px]" />
      </div>
    </div>
  );
};
