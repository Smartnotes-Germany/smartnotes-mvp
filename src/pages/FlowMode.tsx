import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileUp, 
  Sparkles, 
  BrainCircuit, 
  Tag, 
  Clock, 
  MoreHorizontal, 
  Search,
  CheckCircle2,
  Feather,
  ArrowRight,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FlowMode = () => {
  const [content, setContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [entities, setEntities] = useState<{name: string, type: string}[]>([]);
  const [title, setTitle] = useState("");
  const navigate = useNavigate();
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Entity detection simulation - using transition to avoid direct setState in effect
  useEffect(() => {
    const lastWord = content.trim().split(/\s+/).pop()?.toLowerCase();
    
    if (lastWord && lastWord.length > 3) {
      // Use startTransition to mark this as a transition update
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
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [content]);

  const handleImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      setContent(prev => prev + "\n\n--- IMPORTIERTE NOTIZ ---\nThema: Energieumwandlung in Chloroplasten.\nDie Lichtreaktion nutzt Photonen zur Spaltung von H2O...");
      setIsImporting(false);
    }, 2000);
  };

  return (
    <div className="h-full bg-ivory flex flex-col overflow-hidden font-body">
      
      {/* === EDITORIAL HEADER === */}
      <header className="h-20 px-10 flex items-center justify-between border-b border-ivory-muted bg-ivory/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-4 py-2 border border-ivory-muted">
            <Feather size={16} className="text-accent-burnt" />
            <span className="text-caption text-text-primary">Fokus-Modus</span>
          </div>
          <button 
            onClick={handleImport}
            className="flex items-center gap-2 text-caption text-text-secondary hover:text-ink transition-colors"
          >
            <FileUp size={14} /> 
            <span>Importieren</span>
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-caption text-text-muted">
              <CheckCircle2 size={12} className="text-accent-forest" /> 
              Gespeichert
            </span>
          </div>
          <button className="text-text-muted hover:text-ink transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex relative">
        
        {/* === MAIN EDITOR === */}
        <main className="flex-1 relative overflow-y-auto bg-ivory flex justify-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-3xl min-h-full bg-ivory shadow-sm border-x border-ivory-muted p-16 md:p-20 flex flex-col"
          >
            {/* Title Input - Editorial Style */}
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel der Mitschrift..."
              className="w-full text-display-md text-ink border-none outline-none mb-8 placeholder:text-ivory-muted bg-transparent"
            />
            
            {/* Content Textarea */}
            <textarea
              ref={editorRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Beginne zu schreiben... (Tippe z.B. 'DNA' oder 'Rom' für KI-Erkennung)"
              className="flex-1 w-full text-body-lg text-text-primary border-none outline-none resize-none placeholder:text-text-muted bg-transparent leading-relaxed"
            />

            {/* Word Count */}
            <div className="mt-8 pt-6 border-t border-ivory-muted flex items-center justify-between">
              <span className="text-caption text-text-muted">
                {content.split(/\s+/).filter(w => w.length > 0).length} Wörter
              </span>
              <span className="text-caption text-text-muted">
                {Math.ceil(content.split(/\s+/).filter(w => w.length > 0).length / 200)} Min. Lesezeit
              </span>
            </div>
          </motion.div>

          {/* Import Overlay */}
          <AnimatePresence>
            {isImporting && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-ivory/95 backdrop-blur-sm z-40 flex flex-col items-center justify-center"
              >
                <div className="w-64 h-0.5 bg-ivory-muted overflow-hidden mb-6">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                    className="h-full bg-accent-gold" 
                  />
                </div>
                <p className="text-caption text-text-primary uppercase tracking-[0.2em]">Analysiere...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* === ENTITY SIDEBAR - EDITORIAL STYLE === */}
        <aside className="w-80 bg-ivory border-l border-ivory-muted flex flex-col z-20">
          <div className="p-8 border-b border-ivory-muted">
            <div className="flex items-center gap-3">
              <BrainCircuit size={18} className="text-accent-burnt" />
              <h4 className="text-caption text-text-primary">Erkennung</h4>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Detected Entities */}
            <div>
              <h5 className="text-caption text-text-muted mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Tag size={12} /> 
                  Konzepte
                </span>
                <span className="px-2 py-0.5 border border-ivory-muted text-[10px]">{entities.length}</span>
              </h5>
              
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {entities.map((entity, i) => (
                    <motion.div
                      key={entity.name}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="p-4 bg-ivory-warm border border-ivory-muted hover:border-ink transition-all cursor-pointer group relative"
                    >
                      {/* Type Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-caption text-text-muted">
                          {entity.type}
                        </span>
                        <ArrowRight size={12} className="text-text-muted group-hover:text-accent-burnt group-hover:translate-x-1 transition-all" />
                      </div>

                      <h6 className="font-display text-lg font-medium text-ink group-hover:text-accent-burnt transition-colors">
                        {entity.name}
                      </h6>
                      
                      <p className="text-caption text-text-muted mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        Klicke für Details
                      </p>

                      {/* New Item Pulse */}
                      {i === 0 && (
                        <motion.div 
                          initial={{ opacity: 0.3 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 1, repeat: 2 }}
                          className="absolute inset-0 bg-accent-gold/10 pointer-events-none"
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {entities.length === 0 && (
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 border border-ivory-muted flex items-center justify-center mx-auto mb-4">
                      <Search size={20} className="text-text-muted" />
                    </div>
                    <p className="text-body-md text-text-muted leading-relaxed px-4">
                      Tippe Begriffe wie <span className="text-ink font-medium">"DNA"</span> oder <span className="text-ink font-medium">"Napoleon"</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Suggestion */}
            {entities.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-ink text-ivory"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-accent-gold" />
                  <span className="text-caption text-accent-gold">Empfehlung</span>
                </div>
                <p className="text-body-md text-ivory/80 mb-4">
                  <strong>{entities[0].name}</strong> erkannt. Möchtest du die Zusammenfassung laden?
                </p>
                <button 
                  onClick={() => navigate('/1')}
                  className="w-full py-3 bg-ivory text-ink text-caption hover:bg-accent-gold transition-colors"
                >
                  Im Wissensnetz ansehen
                </button>
              </motion.div>
            )}
          </div>

          {/* Stats Footer */}
          <div className="p-6 border-t border-ivory-muted space-y-3">
            <div className="flex items-center justify-between text-caption text-text-muted">
              <span className="flex items-center gap-2">
                <Clock size={12} /> 
                Lesezeit
              </span>
              <span>~ 2 Min</span>
            </div>
            <div className="flex items-center justify-between text-caption text-text-muted">
              <span className="flex items-center gap-2">
                <Zap size={12} /> 
                Komplexität
              </span>
              <span className="text-accent-burnt">Mittel</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
