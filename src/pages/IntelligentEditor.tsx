import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, ListTree, Lightbulb, Type } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const IntelligentEditor = () => {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  // Simulate AI analyzing text as user "types"
  useEffect(() => {
    if (text.length > 20 && text.includes("DNA")) {
      setIsProcessing(true);
      const timer = setTimeout(() => {
        setSuggestions(["Doppelhelix", "Nukleotide", "Watson-Crick-Modell"]);
        setIsProcessing(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [text]);

  return (
    <div className="h-full bg-white flex flex-col overflow-hidden">
      {/* Editor Header */}
      <div className="h-14 border-b border-slate-100 flex items-center justify-between px-8 bg-slate-50/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-500">
            <Type size={14} /> Normaltext
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-3 text-slate-400">
            <ListTree size={18} className="hover:text-brand-primary cursor-pointer" onClick={() => navigate('/3')} />
            <Zap size={18} className="hover:text-brand-primary cursor-pointer" onClick={() => navigate('/4')} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.div 
            animate={{ opacity: isProcessing ? 1 : 0.5 }}
            className="flex items-center gap-2 text-xs font-bold text-brand-primary"
          >
            <Sparkles size={14} className={isProcessing ? "animate-pulse" : ""} />
            {isProcessing ? "KI analysiert..." : "KI bereit"}
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main Editor Area */}
        <div className="flex-1 p-12 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <motion.input
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              placeholder="Titel deiner Notiz..."
              className="w-full text-4xl font-serif font-bold text-slate-900 border-none focus:outline-none mb-8 placeholder:text-slate-200"
            />
            
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Beginne hier zu schreiben... Tippe zum Beispiel über DNA-Strukturen."
              className="w-full h-[60vh] text-lg leading-relaxed text-slate-700 border-none focus:outline-none resize-none placeholder:text-slate-300 font-sans"
            />
          </div>
        </div>

        {/* AI Intelligence Sidebar */}
        <div className="w-96 bg-slate-50 border-l border-slate-100 p-8 flex flex-col gap-8 overflow-y-auto">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Lightbulb size={14} className="text-amber-500" /> Smart Begriffe.
            </h4>
            <div className="space-y-3">
              <AnimatePresence>
                {suggestions.map((s, i) => (
                  <motion.div
                    key={s}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-brand-primary cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{s}</span>
                      <Zap size={14} className="text-slate-300 group-hover:text-brand-primary" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {suggestions.length === 0 && !isProcessing && (
                <p className="text-sm text-slate-400 italic">Schreibe über ein Thema, um KI-Einsichten zu erhalten.</p>
              )}
            </div>
          </div>

          <div className="mt-auto">
            <div className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10">
              <h4 className="font-bold text-brand-primary text-sm mb-2 flex items-center gap-2">
                <Sparkles size={14} /> Struktur-Vorschlag
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Ich erkenne eine Aufzählung von biologischen Prozessen. Soll ich diese in eine Mindmap-Struktur umwandeln?
              </p>
              <button 
                onClick={() => navigate('/3')}
                className="w-full py-2 bg-brand-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-colors shadow-sm"
              >
                In Struktur umwandeln
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating Action Bar */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-30"
      >
        <button className="flex items-center gap-2 text-sm font-bold hover:text-brand-primary transition-colors">
          <Sparkles size={16} /> Zusammenfassen
        </button>
        <div className="w-px h-4 bg-slate-700" />
        <button 
          onClick={() => navigate('/4')}
          className="flex items-center gap-2 text-sm font-bold hover:text-slate-300 transition-colors"
        >
          <Zap size={16} /> Quiz erstellen
        </button>
        <div className="w-px h-4 bg-slate-700" />
        <button 
          onClick={() => navigate('/3')}
          className="flex items-center gap-2 text-sm font-bold hover:text-brand-primary transition-colors"
        >
          <ListTree size={16} /> Mindmap
        </button>
      </motion.div>
    </div>
  );
};
