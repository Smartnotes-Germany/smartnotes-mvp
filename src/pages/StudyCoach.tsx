import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  BookOpen, 
  ArrowRight, 
  Sparkles, 
  RotateCcw,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Trophy
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
    simpleExplanation: "Energie verschwindet nie. Wenn du einen Ball wirfst, wird deine Muskelkraft in Bewegung umgewandelt. Wenn er liegen bleibt, wurde die Bewegung in Wärme umgewandelt. Die Summe bleibt gleich.",
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

  const handlePrev = () => {
    setMode('question');
    setShowNote(false);
    setIndex((prev) => (prev - 1 + MOCK_QUESTIONS.length) % MOCK_QUESTIONS.length);
  };

  return (
    <div className="h-full bg-ivory flex flex-col font-body relative overflow-hidden">
      
      {/* === EDITORIAL HEADER === */}
      <div className="px-10 py-6 flex justify-between items-center border-b border-ivory-muted z-20">
        <div className="flex items-center gap-8">
          <span className="text-caption text-accent-slate">Lernmodus</span>
          <div className="flex gap-1">
            {MOCK_QUESTIONS.map((_, i) => (
              <div 
                key={i} 
                className={`h-0.5 w-8 transition-all ${i === index ? 'bg-accent-gold' : 'bg-ivory-muted'}`} 
              />
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-caption text-text-muted">
            <Trophy size={14} className="text-accent-gold" />
            <span>Frage {index + 1} von {MOCK_QUESTIONS.length}</span>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="p-2 text-text-muted hover:text-ink transition-colors"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 flex items-center justify-center px-10">
        <div className="w-full max-w-4xl">
          
          {/* Topic Badge */}
          <motion.div 
            key={current.topic}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-8"
          >
            <span className="text-caption px-3 py-1 border border-accent-gold text-accent-gold">
              {current.topic}
            </span>
          </motion.div>

          {/* Question */}
          <motion.h2 
            key={current.question}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-display-lg text-ink mb-12 leading-tight"
          >
            {current.question}
          </motion.h2>

          {/* Divider */}
          <div className="h-px bg-ivory-muted mb-12" />

          {/* Dynamic Content */}
          <div className="min-h-[300px]">
            <AnimatePresence mode="wait">
              {mode === 'question' ? (
                <motion.div
                  key="question-view"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col items-center"
                >
                  <motion.button
                    onClick={() => setMode('answer')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="group flex flex-col items-center gap-4"
                  >
                    <div className="w-20 h-20 bg-ink text-ivory flex items-center justify-center group-hover:bg-accent-burnt transition-colors">
                      <ArrowRight size={28} />
                    </div>
                    <span className="text-caption text-text-muted group-hover:text-ink transition-colors">
                      Antwort anzeigen
                    </span>
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div 
                  key="answer-view"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  {/* Answer or Explanation */}
                  <div className="text-body-lg text-text-primary leading-relaxed">
                    {mode === 'explain' ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-8 bg-ivory-warm border border-ivory-muted relative"
                      >
                        <div className="absolute -top-3 -left-3 w-10 h-10 bg-accent-gold flex items-center justify-center text-ink">
                          <Lightbulb size={20} />
                        </div>
                        <span className="text-caption text-accent-gold block mb-4">Einfache Erklärung</span>
                        <p className="font-body text-lg leading-relaxed">{current.simpleExplanation}</p>
                      </motion.div>
                    ) : (
                      <p className="font-body text-xl leading-relaxed italic text-text-primary">
                        "{current.answer}"
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-4 pt-4">
                    <button 
                      onClick={handleNext}
                      className="px-8 py-4 bg-ink text-ivory text-caption hover:bg-accent-burnt transition-all flex items-center gap-3"
                    >
                      <Check size={16} /> 
                      <span>Verstanden</span>
                    </button>
                    
                    {mode !== 'explain' && (
                      <button 
                        onClick={() => setMode('explain')}
                        className="px-8 py-4 border border-ink text-ink text-caption hover:bg-ink hover:text-ivory transition-all flex items-center gap-3"
                      >
                        <Sparkles size={16} /> 
                        <span>Einfacher erklären</span>
                      </button>
                    )}

                    <button 
                      onClick={() => setShowNote(!showNote)}
                      className="px-8 py-4 border border-ivory-muted text-text-secondary text-caption hover:border-ink hover:text-ink transition-all flex items-center gap-3"
                    >
                      <BookOpen size={16} /> 
                      <span>{showNote ? 'Notiz ausblenden' : 'Meine Notizen'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* === NAVIGATION CONTROLS === */}
      <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center">
        <button 
          onClick={handlePrev}
          className="flex items-center gap-2 text-caption text-text-muted hover:text-ink transition-colors"
        >
          <ChevronLeft size={16} />
          <span>Vorherige</span>
        </button>
        
        <button 
          onClick={handleNext}
          className="flex items-center gap-2 text-caption text-text-muted hover:text-ink transition-colors"
        >
          <span>Nächste</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* === NOTE PANEL === */}
      <AnimatePresence>
        {showNote && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 bg-ink text-ivory z-30"
          >
            <div className="max-w-4xl mx-auto p-10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border border-ivory/20 flex items-center justify-center">
                    <BookOpen size={18} className="text-accent-gold" />
                  </div>
                  <div>
                    <h4 className="text-caption text-ivory/60 mb-1">Aus deiner Mitschrift</h4>
                    <p className="font-display text-xl">{current.topic}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowNote(false)}
                  className="text-ivory/40 hover:text-ivory transition-colors text-2xl"
                >
                  ×
                </button>
              </div>
              
              <p className="text-body-lg text-ivory/80 leading-relaxed border-l-2 border-accent-gold pl-6">
                {current.sourceNote}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === DECORATIVE BACKGROUND === */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent-gold/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent-burnt/5 rounded-full blur-[120px]" />
      </div>
    </div>
  );
};
