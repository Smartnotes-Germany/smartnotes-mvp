import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileUp, 
  Sparkles, 
  BrainCircuit, 
  Tag, 
  Clock, 
  Type, 
  MoreHorizontal, 
  ChevronRight,
  Search,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FlowMode = () => {
  const [content, setContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [entities, setEntities] = useState<{name: string, type: string}[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Simulation der Entitätserkennung beim Tippen
  useEffect(() => {
    const lastWord = content.trim().split(/\s+/).pop()?.toLowerCase();
    
    if (lastWord && lastWord.length > 3) {
      setIsAnalyzing(true);
      const timer = setTimeout(() => {
        const mockEntities: Record<string, {name: string, type: string}> = {
          'dna': { name: 'DNA', type: 'Biologie' },
          'rom': { name: 'Römisches Reich', type: 'Geschichte' },
          'atp': { name: 'ATP', type: 'Biochemie' },
          'napoleon': { name: 'Napoleon', type: 'Person' },
          'zelle': { name: 'Pflanzenzelle', type: 'Struktur' }
        };

        if (mockEntities[lastWord] && !entities.find(e => e.name === mockEntities[lastWord].name)) {
          setEntities(prev => [mockEntities[lastWord], ...prev].slice(0, 8));
        }
        setIsAnalyzing(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [content]);

  const handleImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      setContent(prev => prev + "\n\n--- IMPORTIERTE NOTIZ (Handschrift erkannt) ---\nThema: Energieumwandlung in Chloroplasten.\nDie Lichtreaktion nutzt Photonen zur Spaltung von H2O...\n");
      setIsImporting(false);
    }, 2000);
  };

  return (
    <div className="h-full bg-white flex flex-col overflow-hidden font-sans selection:bg-brand-primary selection:text-white">
      
      {/* 1. Header & Toolbar */}
      <header className="h-14 px-8 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-slate-500 font-medium text-xs">
            <Type size={14} /> Fokus-Modus
          </div>
          <button 
            onClick={handleImport}
            className="flex items-center gap-2 text-xs font-bold text-brand-primary hover:text-brand-primary/80 transition-colors"
          >
            <FileUp size={16} /> Notizen importieren
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            {isAnalyzing ? (
              <span className="flex items-center gap-2 text-brand-primary">
                <Sparkles size={12} className="animate-pulse" /> KI analysiert...
              </span>
            ) : (
              <span className="flex items-center gap-2 italic">
                <CheckCircle2 size={12} className="text-emerald-500" /> Gesichert
              </span>
            )}
          </div>
          <MoreHorizontal size={20} className="text-slate-300 cursor-pointer" />
        </div>
      </header>

      <div className="flex-1 flex relative">
        
        {/* 2. Main Typing Canvas */}
        <main className="flex-1 relative overflow-y-auto bg-slate-50/30 flex justify-center">
          <div className="w-full max-w-3xl min-h-full bg-white shadow-sm border-x border-slate-50 p-16 md:p-24 flex flex-col">
            <input 
              type="text"
              placeholder="Titel der Mitschrift..."
              className="w-full text-4xl font-serif font-bold text-slate-900 border-none outline-none mb-8 placeholder:text-slate-200"
            />
            
            <textarea
              ref={editorRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Schreibe deine Gedanken auf oder importiere Dokumente... (Tippe z.B. 'DNA' oder 'Rom')"
              className="flex-1 w-full text-xl leading-relaxed text-slate-700 border-none outline-none resize-none placeholder:text-slate-200 font-sans"
            />
          </div>

          {/* Import Overlay Animation */}
          <AnimatePresence>
            {isImporting && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/80 backdrop-blur-sm z-40 flex flex-col items-center justify-center text-brand-primary"
              >
                <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2 }}
                    className="h-full bg-brand-primary" 
                  />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Analysiere Handschrift...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* 3. Entity & Keyword Sidebar */}
        <aside className="w-80 bg-white border-l border-slate-100 p-8 flex flex-col z-20">
          <div className="flex items-center gap-2 text-brand-primary mb-8">
            <BrainCircuit size={20} />
            <h4 className="text-xs font-black uppercase tracking-[0.2em]">Erkennung</h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar">
            {/* Detected Entities Section */}
            <div>
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2"><Tag size={12} /> Erkannte Konzepte</span>
                <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">{entities.length}</span>
              </h5>
              
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {entities.map((entity, i) => (
                    <motion.div
                      key={entity.name}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-brand-primary hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                    >
                      {/* Category Badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full group-hover:bg-brand-primary group-hover:text-white transition-colors">
                          {entity.type}
                        </span>
                        <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                      </div>

                      <h6 className="font-bold text-slate-900 group-hover:text-brand-primary transition-colors">
                        {entity.name}
                      </h6>
                      
                      <p className="text-[10px] text-slate-500 leading-relaxed mt-1 opacity-0 group-hover:opacity-100 h-0 group-hover:h-auto transition-all duration-300">
                        Klicke für KI-Zusammenfassung und Verknüpfungen im Wissensnetz.
                      </p>

                      {/* Accent Pulse for new items */}
                      {i === 0 && (
                        <motion.div 
                          initial={{ opacity: 0.5, scale: 0.8 }}
                          animate={{ opacity: 0, scale: 1.5 }}
                          transition={{ duration: 1, repeat: 2 }}
                          className="absolute inset-0 bg-brand-primary/5 pointer-events-none"
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {entities.length === 0 && (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search size={20} className="text-slate-200" />
                    </div>
                    <p className="text-[11px] text-slate-400 italic leading-relaxed px-4">
                      Tippe wichtige Begriffe wie <span className="text-slate-600 font-bold">"DNA"</span> oder <span className="text-slate-600 font-bold">"Napoloen"</span>, um die KI-Analyse zu starten.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Smart Suggestions Based on Entities */}
            {entities.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-brand-primary/5 rounded-2xl border border-brand-primary/10"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-brand-primary" />
                  <span className="text-[10px] font-bold text-brand-primary uppercase">Empfehlung</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-4">
                  Ich habe <strong>{entities[0].name}</strong> erkannt. Möchtest du dazu eine bestehende Zusammenfassung laden?
                </p>
                <button 
                  onClick={() => navigate('/1')}
                  className="w-full py-2.5 bg-brand-primary text-white rounded-xl text-[10px] font-bold shadow-lg shadow-brand-primary/20 hover:opacity-90 transition-opacity"
                >
                  Im Wissensnetz ansehen
                </button>
              </motion.div>
            )}
          </div>

          {/* Quick Stats at Bottom */}
          <div className="mt-auto pt-8 border-t border-slate-50 space-y-3">
             <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><Clock size={12} /> Lesezeit</span>
                <span>~ 2 Min</span>
             </div>
             <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><Search size={12} /> Komplexität</span>
                <span className="text-brand-primary">Mittel</span>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
};