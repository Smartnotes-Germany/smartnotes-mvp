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
  simpleExplanation: string; // "ELI5" - Explain like I'm 5
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
    <div className="h-full flex flex-col items-center justify-center font-sans selection:bg-brand-primary/10 relative overflow-hidden">
      
      {/* Top Navigation / Progress */}
      <div className="absolute top-5 w-[calc(100%-2.5rem)] neo-panel rounded-[1.5rem] px-8 py-5 flex justify-between items-center text-slate-400">
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-dark">Smart Training</span>
          <div className="flex gap-1">
            {MOCK_QUESTIONS.map((_, i) => (
              <div key={i} className={`h-1 w-6 rounded-full transition-colors ${i === index ? 'bg-brand-primary' : 'bg-slate-100'}`} />
            ))}
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="hover:text-slate-600 transition-colors rounded-xl p-2 hover:bg-white/70">
          <RotateCcw size={18} />
        </button>
      </div>

      <main className="neo-panel w-full max-w-2xl mx-5 rounded-[2rem] px-8 py-14 md:px-10 flex flex-col items-center">
        
        {/* Topic Badge */}
        <motion.span 
          key={current.topic}
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-bold text-brand-primary bg-blue-50 px-3 py-1 rounded-full mb-8 uppercase tracking-widest"
        >
          {current.topic}
        </motion.span>

        {/* The Question Area */}
        <div className="w-full text-center space-y-12">
          <motion.h2 
            key={current.question}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-4xl md:text-5xl font-serif font-bold text-slate-900 leading-tight"
          >
            {current.question}
          </motion.h2>

          <div className="h-px w-24 bg-slate-100 mx-auto" />

          {/* Dynamic Content Area */}
          <div className="min-h-[200px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {mode === 'question' ? (
                <motion.button
                  key="check-btn"
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setMode('answer')}
                  className="group flex flex-col items-center gap-4 outline-none"
                >
                  <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl shadow-slate-200">
                    <ArrowRight size={24} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">Antwort prüfen</span>
                </motion.button>
              ) : (
                <motion.div 
                  key="answer-content"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full space-y-8"
                >
                  <div className="text-xl text-slate-600 leading-relaxed max-w-xl mx-auto italic font-serif">
                    {mode === 'explain' ? (
                      <div className="bg-amber-50/50 p-8 rounded-3xl border border-amber-100 relative">
                        <div className="absolute -top-3 -left-3 w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center text-white shadow-lg">
                          <Lightbulb size={18} />
                        </div>
                        <span className="block text-[10px] font-black text-amber-600 uppercase mb-4 tracking-widest">Einfache Erklärung</span>
                        {current.simpleExplanation}
                      </div>
                    ) : (
                      <p>"{current.answer}"</p>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <button 
                      onClick={handleNext}
                      className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                      <Check size={16} /> Verstanden
                    </button>
                    
                    {mode !== 'explain' && (
                      <button 
                        onClick={() => setMode('explain')}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-bold flex items-center gap-2 hover:border-brand-primary hover:text-brand-primary transition-all shadow-sm"
                      >
                        <Sparkles size={16} /> Erklär es mir einfach
                      </button>
                    )}

                    <button 
                      onClick={() => setShowNote(!showNote)}
                      className="px-6 py-3 bg-slate-50 text-slate-400 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-slate-100 transition-all"
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
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="neo-panel absolute bottom-0 w-full max-w-xl border-t border-white/80 rounded-t-[40px] shadow-2xl z-30 p-10 pb-16"
          >
            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-50 text-brand-primary rounded-lg flex items-center justify-center">
                <BookOpen size={16} />
              </div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Kontext aus deiner Mitschrift</h4>
            </div>
            <p className="text-lg text-slate-700 leading-relaxed font-serif">
              "{current.sourceNote}"
            </p>
            <button 
              onClick={() => setShowNote(false)}
              className="mt-8 w-full py-4 text-slate-400 text-xs font-bold hover:text-slate-600"
            >
              Schließen
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decor */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[880px] h-[880px] bg-blue-50 rounded-full blur-[120px] opacity-70" />
      </div>
    </div>
  );
};
