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
    <div className="h-full bg-brand-paper flex flex-col items-center justify-center font-sans selection:bg-brand-secondary/30 selection:text-brand-dark relative overflow-hidden">
      
      {/* Top Navigation / Progress */}
      <div className="absolute top-0 w-full p-8 flex justify-between items-center z-20">
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-dark opacity-50">Smart Training</span>
          <div className="flex gap-1">
            {MOCK_QUESTIONS.map((_, i) => (
              <div key={i} className={`h-1.5 w-8 rounded-full transition-all ${i === index ? 'bg-brand-primary w-12' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="p-2 hover:bg-white/50 rounded-full hover:text-brand-dark text-slate-400 transition-all">
          <RotateCcw size={18} />
        </button>
      </div>

      <main className="w-full max-w-2xl px-8 flex flex-col items-center z-10">
        
        {/* Topic Badge */}
        <motion.span 
          key={current.topic}
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-4 py-1.5 rounded-full mb-10 uppercase tracking-widest"
        >
          {current.topic}
        </motion.span>

        {/* The Question Area */}
        <div className="w-full text-center space-y-16">
          <motion.h2 
            key={current.question}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-serif font-bold text-brand-dark leading-[1.1] tracking-tight"
          >
            {current.question}
          </motion.h2>

          <div className="h-px w-24 bg-slate-200 mx-auto" />

          {/* Dynamic Content Area */}
          <div className="min-h-[240px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {mode === 'question' ? (
                <motion.button
                  key="check-btn"
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setMode('answer')}
                  className="group flex flex-col items-center gap-6 outline-none"
                >
                  <div className="w-20 h-20 rounded-full bg-brand-dark text-white flex items-center justify-center group-hover:scale-110 group-hover:bg-brand-primary transition-all shadow-2xl shadow-slate-200 border-4 border-white">
                    <ArrowRight size={32} strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest group-hover:text-brand-dark transition-colors">Antwort aufdecken</span>
                </motion.button>
              ) : (
                <motion.div 
                  key="answer-content"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full space-y-10"
                >
                  <div className="text-2xl text-slate-600 leading-relaxed max-w-xl mx-auto font-serif">
                    {mode === 'explain' ? (
                      <div className="bg-amber-50 p-10 rounded-3xl border border-amber-100 relative text-left shadow-sm">
                        <div className="absolute -top-4 -left-4 w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                          <Lightbulb size={20} fill="currentColor" />
                        </div>
                        <span className="block text-[10px] font-black text-amber-700 uppercase mb-4 tracking-widest opacity-50">Einfach erklärt</span>
                        <p className="text-amber-900 font-sans text-lg leading-relaxed">{current.simpleExplanation}</p>
                      </div>
                    ) : (
                      <p className="font-serif">"{current.answer}"</p>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-center gap-4">
                    <button 
                      onClick={handleNext}
                      className="px-8 py-4 bg-brand-dark text-white rounded-full text-xs font-bold flex items-center gap-3 hover:bg-brand-primary hover:scale-105 transition-all shadow-xl shadow-slate-200"
                    >
                      <Check size={18} /> Verstanden
                    </button>
                    
                    {mode !== 'explain' && (
                      <button 
                        onClick={() => setMode('explain')}
                        className="px-8 py-4 bg-white border border-slate-200 text-slate-500 rounded-full text-xs font-bold flex items-center gap-3 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 transition-all shadow-sm"
                      >
                        <Sparkles size={18} /> Erklär es mir einfach
                      </button>
                    )}

                    <button 
                      onClick={() => setShowNote(!showNote)}
                      className="px-6 py-4 text-slate-400 rounded-full text-xs font-bold flex items-center gap-2 hover:text-brand-dark transition-all"
                    >
                      <BookOpen size={18} />
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
          <>
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setShowNote(false)}
               className="absolute inset-0 bg-brand-dark/20 backdrop-blur-sm z-20"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="absolute bottom-0 w-full max-w-xl bg-white border-t border-slate-100 rounded-t-[32px] shadow-2xl z-30 p-12 pb-16"
            >
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-10" />
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
                  <BookOpen size={20} />
                </div>
                <div>
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Quelle</h4>
                   <h3 className="text-sm font-bold text-brand-dark">Aus deiner Mitschrift</h3>
                </div>
              </div>
              <p className="text-xl text-slate-600 leading-relaxed font-serif pl-4 border-l-2 border-brand-primary/30 italic">
                "{current.sourceNote}"
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Background Decor */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden opacity-30 mix-blend-multiply">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-brand-secondary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-[100px]" />
      </div>
    </div>
  );
};