import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  Sparkles,
  Network,
  LayoutGrid,
  BookOpen,
  Zap,
  UploadCloud,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight, 
  Layers
} from 'lucide-react';

// --- Types ---
type Category = 'Science' | 'History' | 'Languages' | 'Math';
type ViewMode = 'folders' | 'graph' | 'viewer';

interface NodeData {
  id: string;
  label: string;
  x: number;
  y: number;
  category: Category;
  connections: string[];
  importance: number;
}

const CATEGORY_STYLES: Record<Category, { text: string, bg: string, border: string, hex: string }> = {
  Science: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100", hex: "#047857" },
  History: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100", hex: "#b45309" },
  Languages: { text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-100", hex: "#be123c" },
  Math: { text: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200", hex: "#334155" }
};

// --- Sub-components ---

const Node = ({ node, onClick, active, dimmed }: { node: NodeData, onClick: () => void, active: boolean, dimmed: boolean }) => {
  const scale = 0.8 + (node.importance * 0.2);
  const style = CATEGORY_STYLES[node.category];
  
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ 
        scale: active ? scale * 1.2 : scale,
        opacity: dimmed ? 0.3 : 1,
      }}
      whileHover={{ scale: scale * 1.1, opacity: 1 }}
      onClick={onClick}
      className={`absolute px-4 py-2 rounded-full border shadow-sm cursor-pointer z-10 font-medium text-xs tracking-wide transition-all duration-500
        ${active 
          ? `bg-brand-dark text-white border-brand-dark shadow-xl` 
          : `bg-white ${style.text} ${style.border} hover:border-brand-dark hover:shadow-md`
        }`}
      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className="flex items-center gap-2">
        {active && <Sparkles size={12} className="animate-pulse text-amber-300" />}
        {node.label}
      </div>
    </motion.div>
  );
};

export const Overview = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('folders');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Graph state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeCategory] = useState<Category | 'All'>('All');
  const [graphFocusMode] = useState<'Global' | 'Focus'>('Global');

  // Viewer state
  const [viewingFile, setViewingFile] = useState<{name: string, type: string, content: string} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  const nodes: NodeData[] = [
    { id: '1', label: 'Zellbiologie', x: 50, y: 45, category: 'Science', connections: ['2', '3', '8', '10'], importance: 3 },
    { id: '2', label: 'Photosynthese', x: 38, y: 30, category: 'Science', connections: ['1', '3'], importance: 2 },
    { id: '3', label: 'Genetik', x: 62, y: 35, category: 'Science', connections: ['1', '2', '4', '8'], importance: 2 },
    { id: '4', label: 'Evolution', x: 75, y: 25, category: 'Science', connections: ['3', '7', '9'], importance: 1 },
    { id: '5', label: 'Franz. Revolution', x: 30, y: 70, category: 'History', connections: ['6', '7', '9', '1'], importance: 3 },
    { id: '6', label: 'Napoleon', x: 15, y: 60, category: 'History', connections: ['5', '9', '7'], importance: 2 },
    { id: '7', label: 'Aufklärung', x: 45, y: 80, category: 'History', connections: ['5', '6', '8'], importance: 2 },
    { id: '8', label: 'Differentialrechnung', x: 70, y: 70, category: 'Math', connections: ['1', '3', '10', '7'], importance: 2 },
    { id: '9', label: 'Römische Republik', x: 15, y: 20, category: 'History', connections: ['6', '5', '4'], importance: 2 },
    { id: '10', label: 'Stochastik', x: 85, y: 75, category: 'Math', connections: ['8', '1'], importance: 1 },
  ];

  // Helper to get color for a connection
  const getLineColor = (node1: NodeData, node2: NodeData) => {
    if (node1.category === node2.category) {
      return CATEGORY_STYLES[node1.category].hex;
    }
    return '#cbd5e1'; // slate-300 for cross-disciplinary
  };

  const visibleNodeIds = useMemo(() => {
    if (graphFocusMode === 'Global' || !selectedNodeId) return nodes.map(n => n.id);
    const selected = nodes.find(n => n.id === selectedNodeId);
    return selected ? [selectedNodeId, ...selected.connections] : [];
  }, [selectedNodeId, graphFocusMode, nodes]);

  const filteredNodes = useMemo(() => {
    return nodes.filter(n => 
      visibleNodeIds.includes(n.id) &&
      (activeCategory === 'All' || n.category === activeCategory) &&
      (n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, activeCategory, visibleNodeIds, nodes]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setViewingFile({
        name: "Biologie Zellatmung",
        type: "PDF Dokument",
        content: "Die Zellatmung ist ein Stoffwechselvorgang, bei dem durch Oxidation organischer Stoffe Energie gewonnen wird. In der Glykolyse wird Glucose in Pyruvat umgewandelt. Der Citratzyklus findet in der Mitochondrienmatrix statt. Die Atmungskette an der inneren Mitochondrienmembran erzeugt schließlich das Gros des ATPs."
      });
      setViewMode('viewer');
    }, 1500);
  };

  return (
    <div className="h-full bg-brand-paper flex flex-col overflow-hidden relative">
      
      {/* --- Unified Header --- */}
      <div className="px-10 py-8 z-30 flex flex-col gap-6 bg-brand-paper/80 backdrop-blur-md sticky top-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {viewMode === 'viewer' && (
              <button 
                onClick={() => setViewMode('folders')}
                className="p-2 hover:bg-white rounded-full border border-transparent hover:border-slate-200 text-slate-500 transition-all shadow-sm hover:shadow"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-serif font-bold text-brand-dark tracking-tight">
                {viewMode === 'viewer' ? viewingFile?.name : 'Wissenswelt'}
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {viewMode === 'viewer' ? 'Dokumenten-Analyse aktiv' : 'Organisiere und entdecke deine Notizen.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            
            {/* Search Bar */}
            <div className={`relative transition-all duration-300 ${isSearchFocused ? 'w-96' : 'w-64'}`}>
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Suche..."
                className="w-full pl-11 pr-4 py-2.5 bg-white rounded-full border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary/50 transition-all shadow-sm"
              />
            </div>

            <div className="h-8 w-px bg-slate-200/50" />

            {/* View Toggles */}
            <div className="flex bg-slate-100/50 p-1 rounded-full border border-slate-200/50">
              <button
                onClick={() => setViewMode('folders')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  viewMode === 'folders' ? 'bg-white text-brand-dark shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <LayoutGrid size={14} />
                Ordner
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  viewMode === 'graph' ? 'bg-white text-brand-dark shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Network size={14} />
                Graph
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          
          {/* 1. Folders View */}
          {viewMode === 'folders' && (
            <motion.div
              key="folders"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="h-full px-10 pb-10 flex flex-col overflow-y-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Upload Card */}
                <button 
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="group relative p-8 rounded-xl border border-dashed border-slate-300 hover:border-brand-primary bg-slate-50/50 hover:bg-white transition-all flex flex-col items-center justify-center text-center gap-4 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-14 h-14 bg-white shadow-sm border border-slate-100 text-brand-primary rounded-full flex items-center justify-center group-hover:scale-110 group-hover:shadow-md transition-all z-10">
                    {isUploading ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} strokeWidth={1.5} />}
                  </div>
                  <div className="z-10">
                    <h3 className="font-bold text-brand-dark text-sm">{isUploading ? 'Importiere...' : 'Datei importieren'}</h3>
                    <p className="text-xs text-slate-500 mt-1">PDF, Bilder oder Texte</p>
                  </div>
                </button>

                {[
                  { label: "Biologie", style: CATEGORY_STYLES.Science, count: 12 },
                  { label: "Geschichte", style: CATEGORY_STYLES.History, count: 8 },
                  { label: "Mathematik", style: CATEGORY_STYLES.Math, count: 7 },
                  { label: "Sprachen", style: CATEGORY_STYLES.Languages, count: 4 },
                ].map((folder) => (
                  <div 
                    key={folder.label}
                    onClick={() => {
                      setViewingFile({
                        name: `${folder.label}-Zusammenfassung`,
                        type: "PDF Dokument",
                        content: `Dies ist eine automatisch generierte Zusammenfassung für das Thema ${folder.label}. Alle relevanten Fakten aus deinen Mitschriften wurden hier konsolidiert.`
                      });
                      setViewMode('viewer');
                    }}
                    className="group relative p-8 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all cursor-pointer overflow-hidden"
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full ${folder.style.bg.replace('bg-', 'bg-').replace('50', '400')}`} />
                    
                    <div className="flex justify-between items-start mb-8">
                      <div className={`p-3.5 rounded-xl ${folder.style.bg} ${folder.style.text}`}>
                        <Folder size={24} strokeWidth={1.5} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{folder.count} Notizen</span>
                    </div>
                    
                    <h3 className="font-serif text-xl font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{folder.label}</h3>
                    
                    <div className="mt-6">
                       <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-bold text-slate-400">Fortschritt</span>
                          <span className="text-[10px] font-bold text-slate-900">75%</span>
                       </div>
                       <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${folder.style.bg.replace('bg-', 'bg-').replace('50', '500')} w-3/4`} />
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 2. Graph View */}
          {viewMode === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full relative overflow-hidden"
            >
              <div className="absolute inset-0 z-10">
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {nodes.map(node => 
                    node.connections.map(targetId => {
                      const target = nodes.find(n => n.id === targetId);
                      if (!target || parseInt(node.id) > parseInt(target.id)) return null; 
                      
                      const isHighlighted = selectedNodeId === node.id || selectedNodeId === target.id;
                      const isDimmed = selectedNodeId && !isHighlighted;
                      const lineColor = getLineColor(node, target);

                      return (
                        <motion.line
                          key={`${node.id}-${target.id}`}
                          initial={{ opacity: 0 }} 
                          animate={{ 
                            opacity: isDimmed ? 0.1 : (isHighlighted ? 1 : 0.4),
                            stroke: isHighlighted ? '#1A1C19' : lineColor,
                            strokeWidth: isHighlighted ? 2 : 1
                          }}
                          x1={`${node.x}%`} y1={`${node.y}%`}
                          x2={`${target.x}%`} y2={`${target.y}%`}
                        />
                      );
                    })
                  )}
                </svg>
                {filteredNodes.map(node => (
                  <Node 
                    key={node.id} node={node}
                    active={selectedNodeId === node.id}
                    dimmed={!!selectedNodeId && selectedNodeId !== node.id && !selectedNode?.connections.includes(node.id)}
                    onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)} 
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* 3. Real Viewer View */}
          {viewMode === 'viewer' && viewingFile && (
            <motion.div
              key="viewer"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="h-full flex overflow-hidden relative"
            >
              {/* Floating Toggles */}
              <AnimatePresence>
                {!showLeftSidebar && (
                  <motion.button
                    initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                    onClick={() => setShowLeftSidebar(true)}
                    className="absolute left-6 top-6 z-40 p-3 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-brand-primary shadow-md hover:scale-105 transition-all"
                  >
                    <Layers size={16} />
                  </motion.button>
                )}
                {!showRightSidebar && (
                  <motion.button
                    initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                    onClick={() => setShowRightSidebar(true)}
                    className="absolute right-6 top-6 z-40 p-3 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-brand-primary shadow-md hover:scale-105 transition-all"
                  >
                    <Sparkles size={16} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Document Sidebar */}
              <AnimatePresence>
                {showLeftSidebar && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                    className="bg-white border-r border-slate-100 flex flex-col overflow-hidden shadow-lg z-20"
                  >
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inhalt</span>
                      <button onClick={() => setShowLeftSidebar(false)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
                        <ChevronLeft size={14} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                      {['Übersicht', 'Kernkonzept', 'Analyse', 'Quellen'].map((item, i) => (
                        <div 
                          key={item} 
                          className={`px-4 py-3 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                            i === 0 ? 'bg-brand-primary/5 text-brand-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Reading Area */}
              <div className="flex-1 bg-brand-surface overflow-y-auto p-8 md:p-12 flex justify-center custom-scrollbar">
                <div className="w-full max-w-3xl bg-white shadow-2xl shadow-slate-200/50 rounded-lg min-h-[1000px] relative mx-auto">
                  
                  {/* Paper Texture Overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

                  <div className="p-16 md:p-24 relative z-10">
                    <div className="absolute top-12 right-12 text-[10px] font-bold text-slate-300 font-mono">SEITE 1 / 1</div>
                    
                    <div className="mb-16 border-b border-slate-100 pb-8">
                      <div className="flex items-center gap-3 mb-6">
                         <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold uppercase tracking-wider rounded-full">Verifiziert</span>
                         <span className="text-slate-300 text-[10px] font-mono">UPDATED: TODAY</span>
                      </div>
                      <h1 className="text-5xl font-serif font-bold text-brand-dark mb-6 leading-tight">{viewingFile.name}</h1>
                      <div className="h-1.5 w-24 bg-brand-primary" />
                    </div>

                    <div className="prose prose-slate prose-lg max-w-none">
                      <p className="text-xl leading-8 text-slate-700 font-serif selection:bg-brand-secondary/20 selection:text-brand-dark first-letter:text-5xl first-letter:font-bold first-letter:text-brand-primary first-letter:mr-1 first-letter:float-left">
                        {viewingFile.content}
                      </p>
                      <p className="mt-8 text-xl leading-8 text-slate-700 font-serif">
                        Die Energiegewinnung erfolgt in mehreren Schritten. Zunächst wird in der Glykolyse Glucose abgebaut. Dieser Prozess findet im Cytoplasma statt. Die Produkte werden dann in die Mitochondrien transportiert, wo der Citratzyklus und die Atmungskette ablaufen. 
                      </p>
                      
                      <blockquote className="my-10 pl-6 border-l-4 border-brand-secondary italic text-slate-600 font-serif text-lg">
                        "Die Mitochondrien sind die Kraftwerke der Zelle." – Ein oft zitierter Satz, der die fundamentale Bedeutung dieser Organellen unterstreicht.
                      </blockquote>

                      <div className="mt-16 p-8 bg-brand-primary/5 rounded-2xl border border-brand-primary/10 flex flex-col gap-4 relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles size={64} />
                         </div>
                         <div className="flex items-center gap-3 text-brand-primary">
                            <Sparkles size={20} className="animate-pulse" />
                            <span className="text-xs font-bold uppercase tracking-widest">KI-Analyse</span>
                         </div>
                         <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
                            Basierend auf Ihren Notizen scheint dieser Abschnitt besonders relevant für die kommende Klausur zu sein. Ich empfehle, die Strukturformeln der Glykolyse zusätzlich zu wiederholen.
                         </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Assistant Sidebar */}
              <AnimatePresence>
                {showRightSidebar && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                    className="bg-white border-l border-slate-100 flex flex-col overflow-hidden shadow-lg z-20"
                  >
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                      <div className="flex items-center gap-2 text-brand-primary">
                        <Sparkles size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Co-Pilot</span>
                      </div>
                      <button onClick={() => setShowRightSidebar(false)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                       {/* Context Cards */}
                       <div className="space-y-4">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Verwandte Begriffe</h3>
                          {[
                            { t: 'Mitochondrien', d: 'Ort der Zellatmung', color: 'bg-emerald-500' },
                            { t: 'ATP', d: 'Energieträger', color: 'bg-amber-500' },
                            { t: 'Glykolyse', d: 'Glucose-Abbau', color: 'bg-blue-500' }
                          ].map(f => (
                            <div key={f.t} className="group p-3 rounded-xl border border-slate-100 hover:border-brand-primary/30 hover:shadow-md transition-all cursor-pointer bg-white">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-slate-700 group-hover:text-brand-primary transition-colors">{f.t}</span>
                                <div className={`w-1.5 h-1.5 rounded-full ${f.color}`} />
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed">{f.d}</p>
                            </div>
                          ))}
                       </div>

                       {/* Interactive Modules */}
                       <div>
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Aktionen</h3>
                          <div className="grid grid-cols-2 gap-2">
                            <button className="p-3 bg-amber-50 rounded-xl border border-amber-100 hover:border-amber-200 transition-all text-left group">
                               <Zap size={16} className="text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                               <span className="block text-[10px] font-bold text-amber-900">Quiz starten</span>
                            </button>
                            <button className="p-3 bg-purple-50 rounded-xl border border-purple-100 hover:border-purple-200 transition-all text-left group">
                               <BookOpen size={16} className="text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
                               <span className="block text-[10px] font-bold text-purple-900">Lernkarten</span>
                            </button>
                          </div>
                       </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Frage an den Co-Pilot..."
                          className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all placeholder:text-slate-400 shadow-sm"
                        />
                        <button className="absolute right-2 top-2 p-1 bg-brand-dark text-white rounded-lg hover:bg-brand-primary transition-colors">
                           <Search size={10} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};