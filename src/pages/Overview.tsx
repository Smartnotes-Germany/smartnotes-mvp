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
  ChevronRight, Layers
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

// --- Sub-components ---

const Node = ({ node, onClick, active, dimmed }: { node: NodeData, onClick: () => void, active: boolean, dimmed: boolean }) => {
  const scale = 0.8 + (node.importance * 0.2);
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ 
        scale: active ? scale * 1.2 : scale,
        opacity: dimmed ? 0.3 : 1,
      }}
      whileHover={{ scale: scale * 1.1, opacity: 1 }}
      onClick={onClick}
      className={`absolute px-4 py-2 rounded-2xl border-2 shadow-sm cursor-pointer z-10 font-bold text-sm transition-all duration-500
        ${active 
          ? `bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-500/30` 
          : `bg-white text-slate-700 border-slate-100 hover:border-blue-400`
        }`}
      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className="flex items-center gap-2">
        {active && <Sparkles size={14} className="animate-pulse" />}
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
      const colors: Record<string, string> = {
        Science: '#10b981', // emerald-500
        History: '#3b82f6', // blue-500
        Languages: '#f59e0b', // amber-500
        Math: '#a855f7' // purple-500
      };
      return colors[node1.category] || '#cbd5e1';
    }
    return '#f43f5e'; // rose-500 for cross-disciplinary links
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
    <div className="h-full flex flex-col overflow-hidden relative">
      
      {/* --- Unified Header --- */}
      <div className="neo-panel mx-5 mt-5 rounded-[1.5rem] px-8 py-6 z-30 flex flex-col gap-6 border border-white/70 shadow-[0_22px_40px_-34px_rgba(35,22,8,0.9)]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {viewMode === 'viewer' && (
              <button 
                onClick={() => setViewMode('folders')}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-serif font-bold text-slate-900">
                {viewMode === 'viewer' ? viewingFile?.name : 'Meine Wissenswelt'}
              </h1>
              <p className="text-xs text-slate-500">
                {viewMode === 'viewer' ? 'Dokumenten-Analyse aktiv' : 'Organisiere und entdecke deine Notizen.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={viewMode === 'viewer' ? 'hidden sm:block h-8 w-px bg-slate-200' : 'h-8 w-px bg-slate-200'} />

            {/* Search Bar */}
            <div className={`relative w-64 transition-all duration-300 ${isSearchFocused ? 'w-80' : ''}`}>
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Suchen..."
                className="neo-input w-full pl-10 pr-4 py-2 rounded-xl text-sm transition-all"
              />
            </div>

            <div className="h-8 w-px bg-slate-200" />

            {/* View Toggles */}
            <div className="flex p-1 rounded-xl border border-white/80 bg-white/55">
              <button
                onClick={() => setViewMode('folders')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'folders' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutGrid size={14} />
                Ordner
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'graph' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
              className="h-full p-8 pt-6 flex flex-col overflow-y-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Upload Card */}
                <button 
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="neo-panel p-6 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center gap-3 hover:border-brand-primary hover:bg-blue-50/50 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-50 text-brand-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isUploading ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{isUploading ? 'Importiere...' : 'Datei importieren'}</h3>
                    <p className="text-[10px] text-slate-500">PDF, Bilder oder Texte</p>
                  </div>
                </button>

                {[
                  { label: "Biologie", color: "text-emerald-600", bg: "bg-emerald-50", count: 12 },
                  { label: "Geschichte", color: "text-orange-600", bg: "bg-orange-50", count: 8 },
                  { label: "Mathematik", color: "text-blue-600", bg: "bg-blue-50", count: 7 },
                  { label: "Informatik", color: "text-slate-600", bg: "bg-slate-50", count: 4 },
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
                    className="neo-panel p-6 rounded-2xl border border-white/75 hover:shadow-[0_18px_35px_-25px_rgba(30,19,6,0.8)] transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className={`p-3 rounded-xl ${folder.bg} ${folder.color}`}>
                        <Folder size={24} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{folder.count} Notizen</span>
                    </div>
                    <h3 className="font-bold text-slate-900 group-hover:text-brand-primary transition-colors">{folder.label}</h3>
                    <div className="mt-4 flex items-center gap-2">
                       <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 w-3/4" />
                       </div>
                       <span className="text-[9px] font-bold text-slate-400">75%</span>
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
              className="h-full relative overflow-hidden bg-[radial-gradient(circle_at_18%_20%,rgba(29,78,234,0.09),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,107,61,0.12),transparent_40%)]"
            >
              <div className="absolute inset-0 z-10">
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {nodes.map(node => 
                    node.connections.map(targetId => {
                      const target = nodes.find(n => n.id === targetId);
                      if (!target || parseInt(node.id) > parseInt(target.id)) return null; // Avoid duplicate lines
                      
                      const isHighlighted = selectedNodeId === node.id || selectedNodeId === target.id;
                      const isDimmed = selectedNodeId && !isHighlighted;
                      const lineColor = getLineColor(node, target);

                      return (
                        <motion.line
                          key={`${node.id}-${target.id}`}
                          initial={{ opacity: 0 }} 
                          animate={{ 
                            opacity: isDimmed ? 0.05 : (isHighlighted ? 0.8 : 0.3),
                            stroke: isHighlighted ? '#1e293b' : lineColor,
                            strokeWidth: isHighlighted ? 3 : 1.5
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

          {/* 3. Real Viewer View (Full Page Split) */}
          {viewMode === 'viewer' && viewingFile && (
            <motion.div
              key="viewer"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="h-full flex overflow-hidden relative"
            >
              {/* Floating Toggle Buttons (when sidebars are closed) */}
              <AnimatePresence>
                {!showLeftSidebar && (
                  <motion.button
                    initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                    onClick={() => setShowLeftSidebar(true)}
                     className="absolute left-4 top-4 z-40 p-2 neo-panel rounded-lg text-slate-500 hover:text-brand-primary shadow-sm"
                  >
                    <Layers size={14} />
                  </motion.button>
                )}
                {!showRightSidebar && (
                  <motion.button
                    initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                    onClick={() => setShowRightSidebar(true)}
                     className="absolute right-4 top-4 z-40 p-2 neo-panel rounded-lg text-slate-500 hover:text-brand-primary shadow-sm"
                  >
                    <Sparkles size={14} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Document Sidebar (Simplified File/Outline List) */}
              <AnimatePresence>
                {showLeftSidebar && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }} animate={{ width: 192, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                     className="neo-panel border-r border-white/70 flex flex-col overflow-hidden"
                  >
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Inhalt</span>
                      <button onClick={() => setShowLeftSidebar(false)} className="p-1 hover:bg-slate-50 rounded text-slate-300">
                        <ChevronLeft size={12} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                      {['Übersicht', 'Kernkonzept', 'Analyse', 'Quellen'].map((item, i) => (
                        <div 
                          key={item} 
                          className={`px-3 py-2 rounded-lg text-[11px] cursor-pointer transition-colors whitespace-nowrap ${
                            i === 0 ? 'bg-slate-50 text-brand-primary font-bold' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
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
               <div className="flex-1 bg-slate-200/40 overflow-y-auto p-12 flex justify-center custom-scrollbar">
                 <div className="neo-panel w-full max-w-3xl shadow-2xl rounded-sm p-16 md:p-24 min-h-[1200px] relative">
                  {/* Page Indicator */}
                  <div className="absolute top-8 right-8 text-[10px] font-bold text-slate-300">Seite 1 von 1</div>
                  
                  <div className="mb-12">
                    <div className="flex items-center gap-2 mb-4">
                       <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase tracking-tighter rounded">Geprüftes Dokument</span>
                       <span className="text-slate-300 text-[10px]">Zuletzt bearbeitet: Heute</span>
                    </div>
                    <h1 className="text-4xl font-serif font-bold text-slate-900 mb-4">{viewingFile.name}</h1>
                    <div className="h-1 w-20 bg-brand-primary rounded-full" />
                  </div>

                  <div className="prose prose-slate max-w-none">
                    <p className="text-xl leading-relaxed text-slate-700 font-sans selection:bg-brand-primary selection:text-white">
                      {viewingFile.content}
                    </p>
                    <p className="mt-8 text-xl leading-relaxed text-slate-700 font-sans">
                      Die Energiegewinnung erfolgt in mehreren Schritten. Zunächst wird in der Glykolyse Glucose abgebaut. Dieser Prozess findet im Cytoplasma statt. Die Produkte werden dann in die Mitochondrien transportiert, wo der Citratzyklus und die Atmungskette ablaufen. 
                    </p>
                    <div className="mt-12 p-8 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center gap-4">
                       <Sparkles size={24} className="text-brand-primary animate-pulse" />
                       <p className="text-sm text-slate-400 italic">KI generiert zusätzliche Erläuterungen für diesen Abschnitt...</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ultra-Subtle AI Assistant Sidebar */}
              <AnimatePresence>
                {showRightSidebar && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                     className="neo-panel border-l border-white/70 flex flex-col overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-50/50 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Sparkles size={12} />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Assistent</span>
                      </div>
                      <button onClick={() => setShowRightSidebar(false)} className="p-1 hover:bg-slate-50 rounded text-slate-300">
                        <ChevronRight size={12} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                       {/* Insights */}
                       <div className="whitespace-nowrap">
                          <div className="space-y-4">
                             {[
                               { t: 'Mitochondrien', d: 'Zellatmung' },
                               { t: 'ATP', d: 'Energie' },
                               { t: 'Glykolyse', d: 'Abbau' }
                             ].map(f => (
                               <div key={f.t} className="group cursor-pointer">
                                 <div className="flex justify-between items-center">
                                   <span className="text-[10px] font-bold text-slate-500 group-hover:text-brand-primary transition-colors">{f.t}</span>
                                   <div className="w-1 h-1 rounded-full bg-slate-100 group-hover:bg-brand-primary" />
                                 </div>
                                 <p className="text-[9px] text-slate-400">{f.d}</p>
                               </div>
                             ))}
                          </div>
                       </div>

                       {/* Minimal Link */}
                       <div className="py-4 border-y border-slate-50 whitespace-nowrap overflow-hidden">
                          <p className="text-[9px] text-slate-400 leading-tight mb-2">
                            Passend zu <strong>"Zellbiologie"</strong>.
                          </p>
                          <button className="text-[9px] font-bold text-brand-primary/60 hover:text-brand-primary flex items-center gap-1">
                            Verknüpfen <ChevronRight size={8} />
                          </button>
                       </div>

                       {/* Minimal Actions */}
                       <div className="space-y-1">
                          <button className="w-full p-1.5 text-left hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2 text-slate-400 hover:text-brand-primary group">
                             <Zap size={10} className="text-slate-200 group-hover:text-amber-400" />
                             <span className="text-[9px] font-medium">Quiz</span>
                          </button>
                          <button className="w-full p-1.5 text-left hover:bg-slate-50 rounded-lg transition-all flex items-center gap-2 text-slate-400 hover:text-brand-primary group">
                             <BookOpen size={10} className="text-slate-200 group-hover:text-purple-400" />
                             <span className="text-[9px] font-medium">Karten</span>
                          </button>
                       </div>
                    </div>

                    <div className="p-3 bg-slate-50/30">
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Frage..."
                          className="w-full pl-2 pr-6 py-1.5 bg-white border border-slate-100 rounded-md text-[9px] outline-none focus:border-brand-primary/20 transition-all placeholder:text-slate-200"
                        />
                        <Search size={8} className="absolute right-2 top-2 text-slate-200" />
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
