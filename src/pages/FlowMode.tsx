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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FlowMode = () => {
  const [content, setContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [entities, setEntities] = useState<{ name: string; type: string }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const lastWord = content.trim().split(/\s+/).pop()?.toLowerCase();

    if (lastWord && lastWord.length > 3) {
      setIsAnalyzing(true);
      const timer = setTimeout(() => {
        const mockEntities: Record<string, { name: string; type: string }> = {
          dna: { name: 'DNA', type: 'Biologie' },
          rom: { name: 'R\u00f6misches Reich', type: 'Geschichte' },
          atp: { name: 'ATP', type: 'Biochemie' },
          napoleon: { name: 'Napoleon', type: 'Person' },
          zelle: { name: 'Pflanzenzelle', type: 'Struktur' },
        };

        if (mockEntities[lastWord] && !entities.find((e) => e.name === mockEntities[lastWord].name)) {
          setEntities((prev) => [mockEntities[lastWord], ...prev].slice(0, 8));
        }
        setIsAnalyzing(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [content]);

  const handleImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      setContent(
        (prev) =>
          prev +
          '\n\n--- IMPORTIERTE NOTIZ (Handschrift erkannt) ---\nThema: Energieumwandlung in Chloroplasten.\nDie Lichtreaktion nutzt Photonen zur Spaltung von H2O...\n'
      );
      setIsImporting(false);
    }, 2000);
  };

  return (
    <div className="h-full bg-void flex flex-col overflow-hidden font-sans">
      {/* Header & Toolbar */}
      <header className="h-14 px-8 flex items-center justify-between border-b border-border-subtle bg-deep/80 backdrop-blur-xl z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-elevated rounded-lg text-text-muted text-xs font-medium">
            <Type size={14} /> Fokus-Modus
          </div>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 text-xs font-semibold text-gold hover:text-gold-light transition-colors"
          >
            <FileUp size={16} /> Notizen importieren
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest">
            {isAnalyzing ? (
              <span className="flex items-center gap-2 text-gold">
                <Sparkles size={12} className="animate-pulse" /> KI analysiert...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-text-ghost">
                <CheckCircle2 size={12} className="text-teal" /> Gesichert
              </span>
            )}
          </div>
          <MoreHorizontal size={18} className="text-text-ghost cursor-pointer hover:text-text-muted transition-colors" />
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* Main Typing Canvas */}
        <main className="flex-1 relative overflow-y-auto bg-void flex justify-center">
          <div className="w-full max-w-3xl min-h-full bg-deep/50 border-x border-border-subtle p-16 md:p-24 flex flex-col">
            <input
              type="text"
              placeholder="Titel der Mitschrift..."
              className="w-full text-4xl font-serif text-text-primary bg-transparent border-none outline-none mb-8"
            />

            <textarea
              ref={editorRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder='Schreibe deine Gedanken auf oder importiere Dokumente... (Tippe z.B. "DNA" oder "Rom")'
              className="flex-1 w-full text-lg leading-relaxed text-text-secondary bg-transparent border-none outline-none resize-none font-sans"
            />
          </div>

          {/* Import Overlay */}
          <AnimatePresence>
            {isImporting && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-void/90 backdrop-blur-md z-40 flex flex-col items-center justify-center"
              >
                <div className="w-64 h-1.5 bg-elevated rounded-full overflow-hidden mb-5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2 }}
                    className="h-full bg-gradient-to-r from-gold-muted to-gold rounded-full"
                  />
                </div>
                <p className="text-sm font-semibold text-gold uppercase tracking-widest animate-pulse">Analysiere Handschrift...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Entity & Keyword Sidebar */}
        <aside className="w-80 bg-deep border-l border-border-subtle p-8 flex flex-col z-20">
          <div className="flex items-center gap-2 text-gold mb-8">
            <BrainCircuit size={18} />
            <h4 className="text-xs font-bold uppercase tracking-[0.2em]">Erkennung</h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-8">
            {/* Detected Entities */}
            <div>
              <h5 className="text-[10px] font-semibold text-text-ghost uppercase tracking-widest mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Tag size={12} /> Erkannte Konzepte
                </span>
                <span className="text-[9px] bg-elevated px-1.5 py-0.5 rounded text-text-muted">{entities.length}</span>
              </h5>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {entities.map((entity, i) => (
                    <motion.div
                      key={entity.name}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="p-4 bg-surface border border-border-subtle rounded-xl hover:border-gold/30 transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 bg-elevated text-text-muted rounded-full group-hover:bg-gold/15 group-hover:text-gold transition-colors">
                          {entity.type}
                        </span>
                        <ChevronRight
                          size={12}
                          className="text-text-ghost group-hover:text-gold group-hover:translate-x-1 transition-all"
                        />
                      </div>

                      <h6 className="font-semibold text-text-primary group-hover:text-gold transition-colors">{entity.name}</h6>

                      <p className="text-[10px] text-text-muted leading-relaxed mt-1 opacity-0 group-hover:opacity-100 h-0 group-hover:h-auto transition-all duration-300">
                        Klicke f\u00fcr KI-Zusammenfassung und Verkn\u00fcpfungen im Wissensnetz.
                      </p>

                      {/* Accent glow for new items */}
                      {i === 0 && (
                        <motion.div
                          initial={{ opacity: 0.3, scale: 0.8 }}
                          animate={{ opacity: 0, scale: 1.5 }}
                          transition={{ duration: 1, repeat: 2 }}
                          className="absolute inset-0 bg-gold/[0.06] pointer-events-none rounded-xl"
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {entities.length === 0 && (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 bg-elevated rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search size={20} className="text-text-ghost" />
                    </div>
                    <p className="text-[11px] text-text-muted italic leading-relaxed px-4">
                      Tippe wichtige Begriffe wie <span className="text-gold font-semibold">"DNA"</span> oder{' '}
                      <span className="text-gold font-semibold">"Napoleon"</span>, um die KI-Analyse zu starten.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Smart Suggestions */}
            {entities.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 bg-gold/[0.06] rounded-xl border border-gold/15">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-gold" />
                  <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Empfehlung</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed mb-4">
                  Ich habe <strong className="text-gold">{entities[0].name}</strong> erkannt. M\u00f6chtest du dazu eine bestehende Zusammenfassung laden?
                </p>
                <button
                  onClick={() => navigate('/1')}
                  className="w-full py-2.5 bg-gold text-void rounded-xl text-[10px] font-bold hover:bg-gold-light transition-colors"
                >
                  Im Wissensnetz ansehen
                </button>
              </motion.div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="mt-auto pt-8 border-t border-border-subtle space-y-3">
            <div className="flex items-center justify-between text-[10px] font-medium text-text-muted">
              <span className="flex items-center gap-1.5">
                <Clock size={12} className="text-text-ghost" /> Lesezeit
              </span>
              <span>~ 2 Min</span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-medium text-text-muted">
              <span className="flex items-center gap-1.5">
                <Search size={12} className="text-text-ghost" /> Komplexit\u00e4t
              </span>
              <span className="text-gold">Mittel</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
