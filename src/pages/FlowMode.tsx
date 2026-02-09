import { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  ListTree,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FlowMode = () => {
  const [content, setContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [entities, setEntities] = useState<{name: string, type: string}[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();
  const editorRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="h-full bg-cream flex flex-col overflow-hidden font-sans">
      
      {/* Header & Toolbar */}
      <header className="h-14 px-8 flex items-center justify-between border-b border-cream-border z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3.5 py-1.5 border border-cream-border rounded-sm text-ink-secondary text-[0.75rem] font-medium">
            <Type size={13} /> Fokus-Modus
          </div>
          <button 
            onClick={handleImport}
            className="flex items-center gap-2 text-[0.75rem] font-semibold text-accent hover:text-accent-dark transition-colors"
          >
            <FileUp size={14} /> Notizen importieren
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[0.6875rem] font-medium text-ink-muted tracking-wider uppercase">
            {isAnalyzing ? (
              <span className="flex items-center gap-2 text-accent">
                <Sparkles size={11} className="animate-pulse" /> KI analysiert...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 size={11} className="text-accent" /> Gesichert
              </span>
            )}
          </div>
          <MoreHorizontal size={16} className="text-ink-muted cursor-pointer hover:text-ink transition-colors" />
        </div>
      </header>

      <div className="flex-1 flex relative">
        
        {/* Main Typing Canvas */}
        <main className="flex-1 relative overflow-y-auto flex justify-center custom-scrollbar">
          <div className="w-full max-w-3xl min-h-full bg-surface-white border-x border-cream-border p-16 md:p-24 flex flex-col">
            <input 
              type="text"
              placeholder="Titel der Mitschrift..."
              className="w-full text-[2.5rem] font-serif font-bold text-ink border-none outline-none mb-8 placeholder:text-ink-faint leading-[1.15] tracking-tight"
            />
            
            <textarea
              ref={editorRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Schreibe deine Gedanken auf oder importiere Dokumente... (Tippe z.B. 'DNA' oder 'Rom')"
              className="flex-1 w-full text-[1.0625rem] leading-[1.85] text-ink-secondary border-none outline-none resize-none placeholder:text-ink-muted font-sans"
            />
          </div>

          {/* Import Overlay */}
          <AnimatePresence>
            {isImporting && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-cream/90 backdrop-blur-sm z-40 flex flex-col items-center justify-center"
              >
                <div className="w-48 h-[2px] bg-cream-dark rounded-full overflow-hidden mb-5">
                  <motion.div 
                    initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2, ease: "easeInOut" }}
                    className="h-full bg-accent" 
                  />
                </div>
                <p className="text-[0.75rem] font-semibold text-ink-secondary tracking-[0.2em] uppercase">Analysiere Handschrift...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Entity & Keyword Sidebar */}
        <aside className="w-80 bg-cream-light border-l border-cream-border p-7 flex flex-col z-20">
          <div className="flex items-center gap-2.5 text-accent mb-7">
            <BrainCircuit size={16} />
            <h4 className="section-label">Erkennung</h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar">
            {/* Detected Entities Section */}
            <div>
              <h5 className="text-[0.625rem] font-semibold text-ink-muted uppercase tracking-[0.15em] mb-5 flex items-center justify-between">
                <span className="flex items-center gap-2"><Tag size={11} /> Erkannte Konzepte</span>
                <span className="text-[0.5625rem] bg-cream-dark/50 px-1.5 py-0.5 rounded-sm">{entities.length}</span>
              </h5>
              
              <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {entities.map((entity, i) => (
                    <motion.div
                      key={entity.name}
                      initial={{ x: 16, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="p-4 bg-surface-white border border-cream-border rounded-sm hover:border-accent transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-ink-muted group-hover:text-accent transition-colors">
                          {entity.type}
                        </span>
                        <ChevronRight size={11} className="text-ink-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                      </div>

                      <h6 className="font-serif font-semibold text-ink text-[0.9375rem] group-hover:text-accent transition-colors">
                        {entity.name}
                      </h6>
                      
                      <p className="text-[0.625rem] text-ink-muted leading-relaxed mt-1 opacity-0 group-hover:opacity-100 h-0 group-hover:h-auto transition-all duration-300">
                        Klicke für KI-Zusammenfassung und Verknüpfungen im Wissensnetz.
                      </p>

                      {i === 0 && (
                        <motion.div 
                          initial={{ opacity: 0.3, scale: 0.9 }}
                          animate={{ opacity: 0, scale: 1.3 }}
                          transition={{ duration: 1, repeat: 2 }}
                          className="absolute inset-0 bg-accent/5 pointer-events-none"
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {entities.length === 0 && (
                  <div className="py-16 text-center">
                    <div className="w-10 h-10 border border-cream-border rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search size={16} className="text-ink-muted" />
                    </div>
                    <p className="text-[0.6875rem] text-ink-muted leading-relaxed px-4">
                      Tippe wichtige Begriffe wie <span className="text-ink font-medium">"DNA"</span> oder <span className="text-ink font-medium">"Napoleon"</span>, um die KI-Analyse zu starten.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Smart Suggestions */}
            {entities.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-cream-dark/20 border border-cream-border rounded-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={12} className="text-accent" />
                  <span className="section-label text-[0.5625rem]">Empfehlung</span>
                </div>
                <p className="text-[0.6875rem] text-ink-secondary leading-relaxed mb-4">
                  Ich habe <strong className="text-ink">{entities[0].name}</strong> erkannt. Möchtest du dazu eine bestehende Zusammenfassung laden?
                </p>
                <button 
                  onClick={() => navigate('/1')}
                  className="w-full py-2.5 bg-ink text-cream rounded-sm text-[0.6875rem] font-semibold hover:bg-ink/90 transition-colors"
                >
                  Im Wissensnetz ansehen
                </button>
              </motion.div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="mt-auto pt-7 border-t border-cream-border space-y-3">
             <div className="flex items-center justify-between text-[0.6875rem] font-medium text-ink-muted">
                <span className="flex items-center gap-1.5"><Clock size={11} /> Lesezeit</span>
                <span className="text-ink-secondary">~ 2 Min</span>
             </div>
             <div className="flex items-center justify-between text-[0.6875rem] font-medium text-ink-muted">
                <span className="flex items-center gap-1.5"><Search size={11} /> Komplexität</span>
                <span className="text-accent font-semibold">Mittel</span>
             </div>
          </div>
        </aside>
      </div>
      
      {/* Floating Action Bar */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-ink text-cream px-6 py-3 rounded-sm shadow-lg flex items-center gap-6 z-30"
      >
        <button className="flex items-center gap-2 text-[0.75rem] font-semibold hover:text-accent transition-colors">
          <Sparkles size={14} /> Zusammenfassen
        </button>
        <div className="w-px h-4 bg-ink-secondary" />
        <button 
          onClick={() => navigate('/4')}
          className="flex items-center gap-2 text-[0.75rem] font-semibold hover:text-cream-dark transition-colors"
        >
          <Zap size={14} /> Quiz erstellen
        </button>
        <div className="w-px h-4 bg-ink-secondary" />
        <button 
          onClick={() => navigate('/5')}
          className="flex items-center gap-2 text-[0.75rem] font-semibold hover:text-accent transition-colors"
        >
          <ListTree size={14} /> Mindmap
        </button>
      </motion.div>
    </div>
  );
};
